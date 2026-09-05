"""
Integration tests for FastAPI endpoints.
Agent and LLM calls are mocked — tests are fast and deterministic.
"""
import json
import os
from unittest.mock import patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("META_AD_ACCOUNT_ID", "act_test123")
os.environ.setdefault("META_USE_SANDBOX", "false")
os.environ.setdefault("GROQ_API_KEY", "test-key")
os.environ.setdefault("LLM_MODEL", "groq/llama-3.3-70b-versatile")

from backend.main import app, _campaigns

# raise_server_exceptions=False: queremos que los errores del servidor lleguen como
# respuestas 500 (vía el exception handler), no que se re-lancen al test —
# comportamiento que cambió en versiones recientes de Starlette.
client = TestClient(app, raise_server_exceptions=False)


# ── /health ────────────────────────────────────────────────────────────────

class TestHealth:
    def test_returns_200(self):
        r = client.get("/health")
        assert r.status_code == 200

    def test_returns_status_ok(self):
        r = client.get("/health")
        assert r.json()["status"] == "ok"

    def test_returns_model_name(self):
        r = client.get("/health")
        assert "model" in r.json()

    def test_returns_environment(self):
        r = client.get("/health")
        assert "environment" in r.json()


# ── POST /campaign ─────────────────────────────────────────────────────────

class TestCreateCampaign:
    def _mock_agent(self, events: list[tuple[str, dict]]):
        async def gen(*args, **kwargs):
            for event_type, data in events:
                yield f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        return gen

    def test_returns_200(self):
        fake_events = [
            ("tool_start", {"tool": "budget_validator", "args": {}}),
            ("plan_ready", {"plan": {"copy": {}, "targeting": {}, "budget": {}, "validation": {}, "duracion_dias": 14}}),
        ]
        with patch("backend.main.run_campaign_agent", self._mock_agent(fake_events)):
            r = client.post("/campaign", json={"user_prompt": "Promocionar nuestro curso a pymes en Mexico, 300 dolares por 14 dias", "brand_id": "demo-edu-latam"})
        assert r.status_code == 200

    def test_content_type_is_event_stream(self):
        fake_events = [("plan_ready", {"plan": {}})]
        with patch("backend.main.run_campaign_agent", self._mock_agent(fake_events)):
            r = client.post("/campaign", json={"user_prompt": "Promocionar nuestro curso a pymes en Mexico, 300 dolares por 14 dias"})
        assert "text/event-stream" in r.headers["content-type"]

    def test_default_brand_id_is_demo(self):
        captured = {}

        async def capture_agent(user_prompt, brand_id, platform_hint=None):
            captured["brand_id"] = brand_id
            yield "event: plan_ready\ndata: {\"plan\": {}}\n\n"

        with patch("backend.main.run_campaign_agent", capture_agent):
            client.post("/campaign", json={"user_prompt": "Promocionar nuestro curso a pymes en Mexico, 300 dolares por 14 dias"})

        assert captured["brand_id"] == "demo-edu-latam"

    def test_streams_tool_events(self):
        fake_events = [
            ("tool_start", {"tool": "budget_validator", "args": {"monto_usd": 200}}),
            ("tool_result", {"tool": "budget_validator", "result": {"aprobado": True}}),
            ("plan_ready", {"plan": {}}),
        ]
        with patch("backend.main.run_campaign_agent", self._mock_agent(fake_events)):
            r = client.post("/campaign", json={"user_prompt": "Promocionar nuestro curso a pymes en Mexico, 300 dolares por 14 dias"})

        content = r.text
        assert "tool_start" in content
        assert "tool_result" in content
        assert "plan_ready" in content

    def test_missing_user_prompt_returns_422(self):
        r = client.post("/campaign", json={})
        assert r.status_code == 422


# ── POST /campaign/approve ─────────────────────────────────────────────────

class TestApproveCampaign:
    def _sample_plan(self):
        return {
            "copy": {"headline": "Lidera", "body": "Cuerpo.", "cta": "Ver más", "rationale": ""},
            "targeting": {
                "intereses": ["entrepreneurship"], "edad_min": 28, "edad_max": 52,
                "paises": ["Colombia"], "tamano_estimado": 600_000, "exclusiones": [],
            },
            "budget": {"aprobado": True, "presupuesto_diario_calculado": 14.29, "warnings": [], "rationale": ""},
            "validation": {"passed": True, "warnings": [], "blockers": [], "checklist_results": {}, "rationale": ""},
            "duracion_dias": 14,
        }

    def test_returns_200(self):
        mock_result = {
            "campaign_id": "act_test123_9999",
            "status": "ACTIVE",
            "estimated_reach": "5K–10K personas",
            "preview_url": None,
            "report": "# Reporte\nOK.",
        }
        with patch("backend.main.approve_and_launch", new_callable=AsyncMock, return_value=mock_result):
            r = client.post("/campaign/approve", json={"plan": self._sample_plan()})
        assert r.status_code == 200

    def test_returns_campaign_id(self):
        mock_result = {
            "campaign_id": "act_test123_9999",
            "status": "ACTIVE",
            "estimated_reach": "5K–10K personas",
            "preview_url": None,
            "report": "# Reporte\nOK.",
        }
        with patch("backend.main.approve_and_launch", new_callable=AsyncMock, return_value=mock_result):
            r = client.post("/campaign/approve", json={"plan": self._sample_plan()})
        assert r.json()["campaign_id"] == "act_test123_9999"

    def test_stores_campaign_in_memory(self):
        _campaigns.clear()
        mock_result = {
            "campaign_id": "act_stored_1234",
            "status": "ACTIVE",
            "estimated_reach": "5K–10K personas",
            "preview_url": None,
            "report": "# R",
        }
        with patch("backend.main.approve_and_launch", new_callable=AsyncMock, return_value=mock_result):
            client.post("/campaign/approve", json={"plan": self._sample_plan()})

        assert "act_stored_1234" in _campaigns

    def test_missing_plan_returns_422(self):
        r = client.post("/campaign/approve", json={})
        assert r.status_code == 422

    def test_agent_error_returns_500(self):
        with patch("backend.main.approve_and_launch", new_callable=AsyncMock, side_effect=Exception("Meta down")):
            r = client.post("/campaign/approve", json={"plan": self._sample_plan()})
        assert r.status_code == 500


# ── GET /campaign/{id} ─────────────────────────────────────────────────────

class TestGetCampaign:
    def setup_method(self):
        _campaigns.clear()

    def test_not_found_returns_404(self):
        r = client.get("/campaign/nonexistent_id")
        assert r.status_code == 404

    def test_found_returns_200(self):
        _campaigns["act_known_5678"] = {
            "campaign_id": "act_known_5678",
            "status": "ACTIVE",
            "estimated_reach": "10K–20K personas",
            "report": "# R",
            "plan": {},
            "created_at": "2026-05-10T00:00:00+00:00",
        }
        r = client.get("/campaign/act_known_5678")
        assert r.status_code == 200

    def test_returns_correct_campaign(self):
        _campaigns["act_correct_999"] = {
            "campaign_id": "act_correct_999",
            "status": "PAUSED",
            "estimated_reach": "3K–6K personas",
            "report": "# Reporte",
            "plan": {},
            "created_at": "2026-05-10T00:00:00+00:00",
        }
        r = client.get("/campaign/act_correct_999")
        body = r.json()
        assert body["campaign_id"] == "act_correct_999"
        assert body["status"] == "PAUSED"

    def test_roundtrip_approve_then_get(self):
        """Approve stores campaign; GET retrieves it."""
        _campaigns.clear()
        mock_result = {
            "campaign_id": "act_roundtrip_111",
            "status": "ACTIVE",
            "estimated_reach": "7K–14K personas",
            "preview_url": None,
            "report": "# Full Report",
        }
        plan = {"copy": {}, "targeting": {}, "budget": {}, "validation": {}, "duracion_dias": 14}

        with patch("backend.main.approve_and_launch", new_callable=AsyncMock, return_value=mock_result):
            client.post("/campaign/approve", json={"plan": plan})

        r = client.get("/campaign/act_roundtrip_111")
        assert r.status_code == 200
        assert r.json()["report"] == "# Full Report"


# ── GET /campaigns/{id}/metrics ────────────────────────────────────────────

_METRICS_JWT = {"type": "access", "account_id": "acct-a", "email": "a@test.com"}


class TestGetCampaignMetrics:
    def test_sin_jwt_devuelve_401(self):
        r = client.get("/campaigns/camp_1/metrics")
        assert r.status_code == 401

    def test_con_jwt_solo_filas_del_tenant(self):
        filas = [{
            "account_id": "acct-a",
            "platform": "meta",
            "campaign_id": "camp_1",
            "metric_date": "2026-08-15",
            "impressions": 10,
            "reach": 8,
            "clicks": 2,
            "spend_usd": 1.5,
        }]
        with patch(
            "backend.middleware.tenant.decode_token",
            return_value=_METRICS_JWT,
        ), patch("backend.main.list_campaign_metrics", return_value=filas) as mock_list:
            r = client.get(
                "/campaigns/camp_1/metrics",
                headers={"Authorization": "Bearer fake-token"},
            )
        assert r.status_code == 200
        assert r.json() == filas
        assert mock_list.call_args.kwargs["account_id"] == "acct-a"
        assert mock_list.call_args.kwargs["campaign_id"] == "camp_1"

    def test_campana_de_otro_tenant_lista_vacia(self):
        with patch(
            "backend.middleware.tenant.decode_token",
            return_value=_METRICS_JWT,
        ), patch("backend.main.list_campaign_metrics", return_value=[]) as mock_list:
            r = client.get(
                "/campaigns/camp_de_b/metrics",
                headers={"Authorization": "Bearer fake-token"},
            )
        assert r.status_code == 200
        assert r.json() == []
        assert mock_list.call_args.kwargs["account_id"] == "acct-a"



# ── /connect/{platform}/assets ─────────────────────────────────────────────

_ASSETS_JWT = {"type": "access", "account_id": "acct-a", "email": "a@test.com"}
_CONN_ROW = {"id": "conn-1", "platform": "meta", "provider_account_id": "act_1"}


def _as_tenant():
    return patch("backend.middleware.tenant.decode_token", return_value=_ASSETS_JWT)


_AUTH = {"Authorization": "Bearer fake-token"}


class TestListAssets:
    def test_sin_jwt_devuelve_401(self):
        r = client.get("/connect/meta/assets")
        assert r.status_code == 401

    def test_devuelve_los_assets_de_la_conexion(self):
        assets = [
            {"external_id": "act_1", "name": "Principal", "asset_type": "ad_account",
             "is_selected": True},
            {"external_id": "act_2", "name": "Agencia", "asset_type": "ad_account",
             "is_selected": False},
        ]
        with _as_tenant(), patch(
            "backend.api.connections.get_connection", return_value=_CONN_ROW
        ) as mock_conn, patch(
            "backend.api.connections.list_assets", return_value=assets
        ) as mock_list:
            r = client.get("/connect/meta/assets", headers=_AUTH)
        assert r.status_code == 200
        assert r.json()["assets"] == assets
        # La tenancy es el filtro por account_id, no RLS.
        assert mock_conn.call_args.args == ("acct-a", "meta")
        assert mock_list.call_args.args[0] == "conn-1"

    def test_filtra_por_asset_type(self):
        with _as_tenant(), patch(
            "backend.api.connections.get_connection", return_value=_CONN_ROW
        ), patch("backend.api.connections.list_assets", return_value=[]) as mock_list:
            r = client.get("/connect/meta/assets?asset_type=page", headers=_AUTH)
        assert r.status_code == 200
        assert mock_list.call_args.args[1] == "page"

    def test_asset_type_invalido_devuelve_400(self):
        with _as_tenant():
            r = client.get("/connect/meta/assets?asset_type=pixel", headers=_AUTH)
        assert r.status_code == 400

    def test_plataforma_sin_conectar_devuelve_404(self):
        with _as_tenant(), patch(
            "backend.api.connections.get_connection", return_value=None
        ):
            r = client.get("/connect/meta/assets", headers=_AUTH)
        assert r.status_code == 404


class TestSelectAsset:
    def test_sin_jwt_devuelve_401(self):
        r = client.post(
            "/connect/meta/assets/select",
            json={"asset_type": "ad_account", "external_id": "act_2"},
        )
        assert r.status_code == 401

    def test_elige_el_asset(self):
        with _as_tenant(), patch(
            "backend.api.connections.get_connection", return_value=_CONN_ROW
        ), patch(
            "backend.api.connections.select_asset", return_value=True
        ) as mock_select:
            r = client.post(
                "/connect/meta/assets/select",
                json={"asset_type": "ad_account", "external_id": "act_2"},
                headers=_AUTH,
            )
        assert r.status_code == 200
        assert r.json()["external_id"] == "act_2"
        assert mock_select.call_args.args == ("conn-1", "ad_account", "act_2")

    def test_asset_ajeno_devuelve_404(self):
        """No se puede elegir un asset que la conexión no alcanza."""
        with _as_tenant(), patch(
            "backend.api.connections.get_connection", return_value=_CONN_ROW
        ), patch("backend.api.connections.select_asset", return_value=False):
            r = client.post(
                "/connect/meta/assets/select",
                json={"asset_type": "ad_account", "external_id": "act_de_otro"},
                headers=_AUTH,
            )
        assert r.status_code == 404

    def test_asset_type_invalido_devuelve_400(self):
        with _as_tenant():
            r = client.post(
                "/connect/meta/assets/select",
                json={"asset_type": "pixel", "external_id": "x1"},
                headers=_AUTH,
            )
        assert r.status_code == 400
