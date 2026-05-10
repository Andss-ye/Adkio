"""
Tests for campaign_agent.py — mocks call_llm at the agent level.
Simulates the full 4-tool pipeline without Groq or Meta API calls.
"""
import json
import os
from unittest.mock import patch

import pytest

from tests.conftest import make_tool_call_response, make_text_response

os.environ.setdefault("META_AD_ACCOUNT_ID", "act_test123")
os.environ.setdefault("META_USE_SANDBOX", "false")
os.environ.setdefault("GROQ_API_KEY", "test-key")
os.environ.setdefault("LLM_MODEL", "groq/llama-3.3-70b-versatile")


# ── Helpers ────────────────────────────────────────────────────────────────

def _build_llm_sequence():
    """
    4 LLM responses that simulate the full tool-call pipeline,
    followed by a stop response once campaign_validator runs.
    """
    return [
        make_tool_call_response("budget_validator", {"monto_usd": 200.0, "duracion_dias": 14}),
        make_tool_call_response("audience_analyzer", {"objetivo": "Llenar evento Bogota junio"}),
        make_tool_call_response(
            "copy_generator",
            {"producto": "Evento Bogota junio", "canal": "instagram", "nivel_consciencia": "solution_aware"},
        ),
        make_tool_call_response("campaign_validator", {}),
        make_text_response("Plan listo."),
    ]


def _stub_tools():
    """Context managers that replace the 4 tool functions with stubs."""
    return [
        patch("backend.agents.campaign_agent.budget_validator", return_value={
            "aprobado": True, "warnings": [], "presupuesto_diario_calculado": 14.29, "rationale": "OK",
        }),
        patch("backend.agents.campaign_agent.audience_analyzer", return_value={
            "intereses": ["entrepreneurship"], "edad_min": 28, "edad_max": 52,
            "paises": ["Colombia"], "tamano_estimado": 600_000, "exclusiones": [], "rationale": "OK",
        }),
        patch("backend.agents.campaign_agent.copy_generator", return_value={
            "headline": "Lidera", "body": "Cuerpo.", "cta": "Ver más", "rationale": "OK",
        }),
        patch("backend.agents.campaign_agent.campaign_validator", return_value={
            "passed": True, "warnings": [], "blockers": [], "checklist_results": {}, "rationale": "OK",
        }),
    ]


async def _collect_events(user_prompt: str = "test", brand_id: str = "demo-edu-latam"):
    from backend.agents.campaign_agent import run_campaign_agent

    events = []
    async for chunk in run_campaign_agent(user_prompt, brand_id):
        lines = chunk.strip().split("\n")
        event_type = lines[0].replace("event: ", "")
        data = json.loads(lines[1].replace("data: ", ""))
        events.append((event_type, data))
    return events


# ── run_campaign_agent ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_agent_yields_plan_ready():
    patches = _stub_tools()
    with patch("backend.agents.campaign_agent.call_llm", side_effect=_build_llm_sequence()), \
         patches[0], patches[1], patches[2], patches[3]:
        events = await _collect_events("Llenar evento Bogota, 200 dolares")

    types = [e[0] for e in events]
    assert "plan_ready" in types


@pytest.mark.asyncio
async def test_agent_emits_4_tool_starts():
    patches = _stub_tools()
    with patch("backend.agents.campaign_agent.call_llm", side_effect=_build_llm_sequence()), \
         patches[0], patches[1], patches[2], patches[3]:
        events = await _collect_events()

    started = [e[1]["tool"] for e in events if e[0] == "tool_start"]
    assert "budget_validator" in started
    assert "audience_analyzer" in started
    assert "copy_generator" in started
    assert "campaign_validator" in started


@pytest.mark.asyncio
async def test_agent_tool_results_match_starts():
    """Every tool_start must be followed by a tool_result with the same tool name."""
    patches = _stub_tools()
    with patch("backend.agents.campaign_agent.call_llm", side_effect=_build_llm_sequence()), \
         patches[0], patches[1], patches[2], patches[3]:
        events = await _collect_events()

    started = {e[1]["tool"] for e in events if e[0] == "tool_start"}
    finished = {e[1]["tool"] for e in events if e[0] == "tool_result"}
    assert started == finished


@pytest.mark.asyncio
async def test_agent_plan_contains_required_fields():
    patches = _stub_tools()
    with patch("backend.agents.campaign_agent.call_llm", side_effect=_build_llm_sequence()), \
         patches[0], patches[1], patches[2], patches[3]:
        events = await _collect_events()

    plan_events = [e[1]["plan"] for e in events if e[0] == "plan_ready"]
    assert len(plan_events) == 1
    plan = plan_events[0]
    assert "copy" in plan
    assert "targeting" in plan
    assert "budget" in plan
    assert "validation" in plan
    assert "duracion_dias" in plan


@pytest.mark.asyncio
async def test_agent_plan_has_headline():
    patches = _stub_tools()
    with patch("backend.agents.campaign_agent.call_llm", side_effect=_build_llm_sequence()), \
         patches[0], patches[1], patches[2], patches[3]:
        events = await _collect_events()

    plan = next(e[1]["plan"] for e in events if e[0] == "plan_ready")
    assert plan["copy"]["headline"] == "Lidera"


@pytest.mark.asyncio
async def test_agent_error_on_llm_failure():
    with patch("backend.agents.campaign_agent.call_llm", side_effect=Exception("Groq down")):
        events = await _collect_events()

    types = [e[0] for e in events]
    assert "error" in types
    assert "plan_ready" not in types


# ── approve_and_launch ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_approve_and_launch_returns_dict():
    from backend.agents.campaign_agent import approve_and_launch

    plan = {
        "copy": {"headline": "Lidera", "body": "Cuerpo.", "cta": "Ver más", "rationale": "OK"},
        "targeting": {
            "intereses": ["entrepreneurship"], "edad_min": 28, "edad_max": 52,
            "paises": ["Colombia"], "tamano_estimado": 600_000, "exclusiones": [],
        },
        "budget": {"aprobado": True, "presupuesto_diario_calculado": 14.29, "warnings": [], "rationale": "OK"},
        "validation": {"passed": True, "warnings": [], "blockers": [], "checklist_results": {}, "rationale": "OK"},
        "duracion_dias": 14,
    }

    with patch("backend.agents.campaign_agent.report_generator", return_value="# Reporte\nOK."):
        result = await approve_and_launch(plan)

    assert isinstance(result, dict)
    assert "campaign_id" in result
    assert "status" in result
    assert "report" in result


@pytest.mark.asyncio
async def test_approve_campaign_id_starts_with_act():
    from backend.agents.campaign_agent import approve_and_launch

    plan = {
        "copy": {"headline": "T", "body": "B.", "cta": "C", "rationale": ""},
        "targeting": {
            "intereses": [], "edad_min": 28, "edad_max": 52,
            "paises": [], "tamano_estimado": 500_000, "exclusiones": [],
        },
        "budget": {"aprobado": True, "presupuesto_diario_calculado": 10.0, "warnings": [], "rationale": ""},
        "validation": {},
        "duracion_dias": 7,
    }

    with patch("backend.agents.campaign_agent.report_generator", return_value="# R"):
        result = await approve_and_launch(plan)

    assert result["campaign_id"].startswith("act_")


@pytest.mark.asyncio
async def test_approve_report_content_passed_through():
    from backend.agents.campaign_agent import approve_and_launch

    plan = {
        "copy": {"headline": "Lidera", "body": "B.", "cta": "C", "rationale": ""},
        "targeting": {
            "intereses": ["e"], "edad_min": 28, "edad_max": 52,
            "paises": ["CO"], "tamano_estimado": 500_000, "exclusiones": [],
        },
        "budget": {"aprobado": True, "presupuesto_diario_calculado": 10.0, "warnings": [], "rationale": ""},
        "validation": {},
        "duracion_dias": 7,
    }

    with patch("backend.agents.campaign_agent.report_generator", return_value="REPORTE ESPECIFICO"):
        result = await approve_and_launch(plan)

    assert result["report"] == "REPORTE ESPECIFICO"
