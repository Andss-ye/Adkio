"""Tests del repositorio platform_assets — client doble, sin red."""
from __future__ import annotations

import pytest

from backend.db import platform_assets as pa
from tests.conftest import FakeSupabase

CONN = "conn-1"


class TestUpsertAssets:
    def test_arma_el_payload_con_on_conflict(self):
        db = FakeSupabase(rows=[{"id": "a1"}])
        pa.upsert_assets(
            CONN,
            [{"asset_type": "ad_account", "external_id": "act_1", "name": "Principal"}],
            client=db,
        )
        call = db.calls[0]
        assert call["table"] == "platform_assets"
        assert call["on_conflict"] == "connection_id,asset_type,external_id"
        assert call["payload"] == [
            {
                "connection_id": CONN,
                "asset_type": "ad_account",
                "external_id": "act_1",
                "name": "Principal",
                "parent_external_id": None,
                "extra_jsonb": {},
            }
        ]

    def test_no_manda_is_selected(self):
        """Re-descubrir no puede mover el asset que el cliente eligió."""
        db = FakeSupabase(rows=[{"id": "a1"}])
        pa.upsert_assets(
            CONN, [{"asset_type": "page", "external_id": "p1"}], client=db
        )
        assert "is_selected" not in db.calls[0]["payload"][0]

    def test_descarta_tipos_invalidos_y_externals_vacios(self):
        db = FakeSupabase(rows=[{"id": "a1"}])
        pa.upsert_assets(
            CONN,
            [
                {"asset_type": "pixel", "external_id": "x1"},
                {"asset_type": "page", "external_id": "  "},
                {"asset_type": "page", "external_id": "p1"},
            ],
            client=db,
        )
        assert [a["external_id"] for a in db.calls[0]["payload"]] == ["p1"]

    def test_sin_assets_validos_no_toca_la_db(self):
        db = FakeSupabase()
        assert pa.upsert_assets(CONN, [{"asset_type": "pixel", "external_id": "x"}], client=db) == []
        assert pa.upsert_assets(CONN, [], client=db) == []
        assert db.calls == []

    def test_instagram_guarda_la_pagina_padre(self):
        db = FakeSupabase(rows=[{"id": "a1"}])
        pa.upsert_assets(
            CONN,
            [{"asset_type": "instagram", "external_id": "ig1", "parent_external_id": "p1"}],
            client=db,
        )
        assert db.calls[0]["payload"][0]["parent_external_id"] == "p1"


class TestListAssets:
    def test_filtra_por_conexion(self):
        db = FakeSupabase(rows=[{"external_id": "act_1"}])
        pa.list_assets(CONN, client=db)
        assert db.calls[0]["filters"] == [("connection_id", CONN)]

    def test_filtra_por_tipo_cuando_se_pide(self):
        db = FakeSupabase(rows=[])
        pa.list_assets(CONN, asset_type="page", client=db)
        assert db.calls[0]["filters"] == [("connection_id", CONN), ("asset_type", "page")]

    def test_no_expone_columnas_internas(self):
        db = FakeSupabase(rows=[])
        pa.list_assets(CONN, client=db)
        fields = db.calls[0]["fields"][0]
        assert "connection_id" not in fields
        assert "extra_jsonb" not in fields


class TestSelectAsset:
    def test_limpia_antes_de_marcar(self):
        """El índice único parcial no admite dos elegidos del mismo tipo."""
        db = FakeSupabase(responses=[[{"id": "a1"}], [{"id": "a2"}]])
        assert pa.select_asset(CONN, "ad_account", "act_2", client=db) is True

        limpiar, marcar = db.calls
        assert limpiar["payload"] == {"is_selected": False}
        assert limpiar["filters"] == [("connection_id", CONN), ("asset_type", "ad_account")]
        assert marcar["payload"] == {"is_selected": True}
        assert ("external_id", "act_2") in marcar["filters"]

    def test_devuelve_false_si_el_asset_no_existe(self):
        db = FakeSupabase(responses=[[{"id": "a1"}], []])
        assert pa.select_asset(CONN, "ad_account", "act_ajeno", client=db) is False

    def test_rechaza_asset_type_invalido(self):
        db = FakeSupabase()
        with pytest.raises(ValueError):
            pa.select_asset(CONN, "pixel", "x1", client=db)
        assert db.calls == []


class TestSelectedAssets:
    def test_indexa_por_tipo(self):
        db = FakeSupabase(rows=[
            {"asset_type": "ad_account", "external_id": "act_1", "is_selected": True},
            {"asset_type": "page", "external_id": "p1", "is_selected": True},
        ])
        selected = pa.selected_assets(CONN, client=db)
        assert selected["ad_account"]["external_id"] == "act_1"
        assert selected["page"]["external_id"] == "p1"
        assert ("is_selected", True) in db.calls[0]["filters"]

    def test_sin_elegidos_devuelve_vacio(self):
        assert pa.selected_assets(CONN, client=FakeSupabase(rows=[])) == {}


class TestSelectDefaultIfNone:
    def test_elige_cuando_no_hay_nada(self):
        db = FakeSupabase(responses=[[], [{"id": "a1"}], [{"id": "a1"}]])
        pa.select_default_if_none(CONN, "ad_account", "act_1", client=db)
        assert [c["op"] for c in db.calls] == ["select", "update", "update"]

    def test_respeta_la_eleccion_previa_del_cliente(self):
        db = FakeSupabase(responses=[
            [{"asset_type": "ad_account", "external_id": "act_elegida", "is_selected": True}]
        ])
        pa.select_default_if_none(CONN, "ad_account", "act_otra", client=db)
        assert len(db.calls) == 1  # solo el select, ningún update
