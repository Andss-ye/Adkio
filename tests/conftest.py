"""
Shared fixtures and mock helpers for the Adkio test suite.
"""
import json
from unittest.mock import MagicMock

import pytest


# ── Brand config ──────────────────────────────────────────────────────────

DEMO_BRAND_CONFIG = {
    "id": "demo-edu-latam",
    "negocio_nombre": "AcademiaEjecutiva LATAM",
    "negocio_industria": "educacion ejecutiva / networking empresarial",
    "propuesta_de_valor": "Inmersiones para fundadores y CEOs",
    "publico_roles": ["Founder", "CEO"],
    "publico_paises": ["Colombia", "Mexico"],
    "publico_edad_min": 28,
    "publico_edad_max": 52,
    "publico_intereses": ["entrepreneurship", "leadership development"],
    "presupuesto_min_campana_usd": 100.0,
    "presupuesto_max_campana_usd": 500.0,
    "tono_estilo": ["aspiracional", "directo"],
    "tono_evitar": ["lenguaje de autoayuda"],
    "ejemplos_copy_aprobado": ["Los mejores líderes no crecen solos."],
    "pixel_configurado": False,
}


@pytest.fixture
def brand_config() -> dict:
    return DEMO_BRAND_CONFIG


# ── LLM mock helpers ───────────────────────────────────────────────────────

def make_text_response(content: str) -> MagicMock:
    """Simulates a non-tool-call LLM response."""
    msg = MagicMock()
    msg.content = content
    msg.tool_calls = None

    choice = MagicMock()
    choice.message = msg
    choice.finish_reason = "stop"

    resp = MagicMock()
    resp.choices = [choice]
    return resp


def make_tool_call_response(tool_name: str, args: dict) -> MagicMock:
    """Simulates an LLM response that requests one tool call."""
    tc = MagicMock()
    tc.id = f"call_{tool_name}"
    tc.function.name = tool_name
    tc.function.arguments = json.dumps(args)

    msg = MagicMock()
    msg.content = None
    msg.tool_calls = [tc]

    choice = MagicMock()
    choice.message = msg
    choice.finish_reason = "tool_calls"

    resp = MagicMock()
    resp.choices = [choice]
    return resp


def make_json_response(data: dict) -> MagicMock:
    """Simulates an LLM response that returns a JSON payload (used by tools)."""
    return make_text_response(json.dumps(data, ensure_ascii=False))
