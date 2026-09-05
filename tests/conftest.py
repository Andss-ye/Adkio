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


# ── Supabase double ────────────────────────────────────────────────────────

class _FakeResult:
    def __init__(self, data):
        self.data = data


class FakeSupabase:
    """Doble del cliente supabase-py: registra cada cadena y devuelve lo pactado.

    `responses` es una cola — una entrada por `execute()`, en orden. Si se agota
    (o no se pasó) devuelve `rows`. Una entrada que sea una excepción se lanza,
    que es como se simula una tabla que no existe.
    """

    def __init__(self, rows=None, responses=None):
        self.rows = rows if rows is not None else []
        self.responses = list(responses) if responses is not None else None
        self.calls = []
        self._current = None

    def table(self, name):
        self._current = {"table": name, "op": None, "payload": None,
                         "on_conflict": None, "filters": []}
        return self

    def select(self, *fields):
        self._current["op"] = "select"
        self._current["fields"] = fields
        return self

    def upsert(self, payload, on_conflict=None):
        self._current.update(op="upsert", payload=payload, on_conflict=on_conflict)
        return self

    def update(self, payload):
        self._current.update(op="update", payload=payload)
        return self

    def delete(self):
        self._current["op"] = "delete"
        return self

    def eq(self, col, val):
        self._current["filters"].append((col, val))
        return self

    def limit(self, n):
        self._current["limit"] = n
        return self

    def execute(self):
        self.calls.append(self._current)
        if self.responses:
            nxt = self.responses.pop(0)
            if isinstance(nxt, Exception):
                raise nxt
            return _FakeResult(nxt)
        return _FakeResult(self.rows)
