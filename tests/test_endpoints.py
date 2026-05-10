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

client = TestClient(app)


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
            r = client.post("/campaign", json={"user_prompt": "test", "brand_id": "demo-edu-latam"})
        assert r.status_code == 200

    def test_content_type_is_event_stream(self):
        fake_events = [("plan_ready", {"plan": {}})]
        with patch("backend.main.run_campaign_agent", self._mock_agent(fake_events)):
            r = client.post("/campaign", json={"user_prompt": "test"})
        assert "text/event-stream" in r.headers["content-type"]

    def test_default_brand_id_is_demo(self):
        captured = {}

        async def capture_agent(user_prompt, brand_id):
            captured["brand_id"] = brand_id
            yield "event: plan_ready\ndata: {\"plan\": {}}\n\n"

        with patch("backend.main.run_campaign_agent", capture_agent):
            client.post("/campaign", json={"user_prompt": "test"})

        assert captured["brand_id"] == "demo-edu-latam"

    def test_streams_tool_events(self):
        fake_events = [
            ("tool_start", {"tool": "budget_validator", "args": {"monto_usd": 200}}),
            ("tool_result", {"tool": "budget_validator", "result": {"aprobado": True}}),
            ("plan_ready", {"plan": {}}),
        ]
        with patch("backend.main.run_campaign_agent", self._mock_agent(fake_events)):
            r = client.post("/campaign", json={"user_prompt": "test"})

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
