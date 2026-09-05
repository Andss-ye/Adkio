"""Descubrimiento y persistencia de assets en el callback de Meta — sin red."""
from __future__ import annotations

from unittest.mock import patch

import httpx
import pytest

from backend.api.connections import _discover_meta_assets, _persist_assets


class _FakeResponse:
    def __init__(self, payload, error: bool = False):
        self._payload = payload
        self._error = error

    def raise_for_status(self):
        if self._error:
            raise httpx.HTTPError("boom")

    def json(self):
        return self._payload


class _FakeGraph:
    """Doble de httpx.AsyncClient: mapea el final de la URL a una respuesta."""

    def __init__(self, by_path: dict):
        self.by_path = by_path
        self.requested: list[str] = []

    async def get(self, url, params=None):
        path = url.split("/")[-1]
        self.requested.append(path)
        return self.by_path[path]


_ADACCOUNTS = _FakeResponse({"data": [
    {"id": "act_1", "name": "Principal", "account_status": 1},
    {"id": "act_2", "name": "Agencia"},
]})

_PAGES = _FakeResponse({"data": [
    {"id": "p1", "name": "Los Andes Café",
     "instagram_business_account": {"id": "ig1", "username": "losandes"}},
    {"id": "p2", "name": "Sin Instagram"},
]})


class TestDiscoverMetaAssets:
    async def test_devuelve_ad_accounts_paginas_e_instagram(self):
        graph = _FakeGraph({"adaccounts": _ADACCOUNTS, "accounts": _PAGES})
        assets = await _discover_meta_assets(graph, "tok")

        por_tipo = {}
        for a in assets:
            por_tipo.setdefault(a["asset_type"], []).append(a["external_id"])
        assert por_tipo["ad_account"] == ["act_1", "act_2"]
        assert por_tipo["page"] == ["p1", "p2"]
        assert por_tipo["instagram"] == ["ig1"]

    async def test_la_cuenta_ig_cuelga_de_su_pagina(self):
        graph = _FakeGraph({"adaccounts": _ADACCOUNTS, "accounts": _PAGES})
        assets = await _discover_meta_assets(graph, "tok")
        ig = next(a for a in assets if a["asset_type"] == "instagram")
        assert ig["parent_external_id"] == "p1"
        assert ig["name"] == "losandes"

    async def test_sin_permiso_de_paginas_conserva_los_ad_accounts(self):
        """`pages_show_list` sin aprobar no puede tumbar la conexión entera."""
        graph = _FakeGraph({
            "adaccounts": _ADACCOUNTS,
            "accounts": _FakeResponse({}, error=True),
        })
        assets = await _discover_meta_assets(graph, "tok")
        assert [a["asset_type"] for a in assets] == ["ad_account", "ad_account"]

    async def test_si_fallan_los_ad_accounts_propaga(self):
        """Sin ad account no hay dónde publicar: el callback tiene que avisar."""
        graph = _FakeGraph({"adaccounts": _FakeResponse({}, error=True)})
        with pytest.raises(httpx.HTTPError):
            await _discover_meta_assets(graph, "tok")


class TestPersistAssets:
    def test_elige_el_primero_de_cada_tipo(self):
        assets = [
            {"asset_type": "ad_account", "external_id": "act_1"},
            {"asset_type": "ad_account", "external_id": "act_2"},
            {"asset_type": "page", "external_id": "p1"},
        ]
        with patch("backend.api.connections.upsert_assets"), patch(
            "backend.api.connections.select_default_if_none"
        ) as mock_default:
            _persist_assets("conn-1", assets)
        elegidos = [c.args[1:] for c in mock_default.call_args_list]
        assert elegidos == [("ad_account", "act_1"), ("page", "p1")]

    def test_force_select_pisa_la_eleccion_anterior(self):
        with patch("backend.api.connections.upsert_assets"), patch(
            "backend.api.connections.select_asset"
        ) as mock_select, patch(
            "backend.api.connections.select_default_if_none"
        ) as mock_default:
            _persist_assets(
                "conn-1",
                [{"asset_type": "ad_account", "external_id": "act_9"}],
                force_select=True,
            )
        assert mock_select.call_args.args == ("conn-1", "ad_account", "act_9")
        assert mock_default.call_count == 0

    def test_sin_la_migracion_007_no_rompe_la_conexion(self):
        """La conexión ya se guardó: perder los assets degrada, no falla."""
        with patch(
            "backend.api.connections.upsert_assets",
            side_effect=RuntimeError("relation platform_assets does not exist"),
        ):
            _persist_assets("conn-1", [{"asset_type": "ad_account", "external_id": "act_1"}])
