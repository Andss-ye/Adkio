"""
Unit tests for all 6 campaign tools.
LLM calls are mocked — tests run without network access.
"""
import os
import json
from unittest.mock import patch

import pytest

from tests.conftest import make_text_response, make_json_response

os.environ.setdefault("META_AD_ACCOUNT_ID", "act_test123")
os.environ.setdefault("META_USE_SANDBOX", "false")


# ── budget_validator ───────────────────────────────────────────────────────

class TestBudgetValidator:
    def test_aprobado_con_presupuesto_normal(self, brand_config):
        from backend.tools.budget_validator import budget_validator

        with patch("backend.tools.budget_validator.call_llm", return_value=make_text_response("Presupuesto viable.")):
            result = budget_validator(monto_usd=200.0, brand_config=brand_config, duracion_dias=14)

        assert result["aprobado"] is True
        assert result["presupuesto_diario_calculado"] == pytest.approx(200.0 / 14, rel=1e-3)
        assert isinstance(result["rationale"], str)
        assert len(result["warnings"]) == 0

    def test_rechazado_presupuesto_diario_insuficiente(self, brand_config):
        from backend.tools.budget_validator import budget_validator

        with patch("backend.tools.budget_validator.call_llm", return_value=make_text_response("Insuficiente.")):
            result = budget_validator(monto_usd=10.0, brand_config=brand_config, duracion_dias=30)

        assert result["aprobado"] is False
        assert any("mínimo" in w.lower() or "minimo" in w.lower() for w in result["warnings"])

    def test_warning_duracion_corta(self, brand_config):
        from backend.tools.budget_validator import budget_validator

        with patch("backend.tools.budget_validator.call_llm", return_value=make_text_response("OK.")):
            result = budget_validator(monto_usd=200.0, brand_config=brand_config, duracion_dias=3)

        assert any("aprendizaje" in w.lower() or "días" in w.lower() or "dias" in w.lower() for w in result["warnings"])

    def test_warning_bajo_minimo_marca(self, brand_config):
        from backend.tools.budget_validator import budget_validator

        with patch("backend.tools.budget_validator.call_llm", return_value=make_text_response("Bajo.")):
            result = budget_validator(monto_usd=50.0, brand_config=brand_config, duracion_dias=14)

        assert any("mínimo recomendado" in w or "minimo" in w.lower() for w in result["warnings"])

    def test_llm_fallback_si_error(self, brand_config):
        from backend.tools.budget_validator import budget_validator

        with patch("backend.tools.budget_validator.call_llm", side_effect=Exception("timeout")):
            result = budget_validator(monto_usd=200.0, brand_config=brand_config, duracion_dias=14)

        assert "rationale" in result
        assert result["rationale"] != ""

    def test_schema_completo(self, brand_config):
        from backend.tools.budget_validator import budget_validator

        with patch("backend.tools.budget_validator.call_llm", return_value=make_text_response("OK.")):
            result = budget_validator(monto_usd=150.0, brand_config=brand_config, duracion_dias=14)

        assert set(result.keys()) == {"aprobado", "warnings", "presupuesto_diario_calculado", "rationale"}


# ── audience_analyzer ─────────────────────────────────────────────────────

class TestAudienceAnalyzer:
    def test_retorna_schema_correcto(self, brand_config):
        from backend.tools.audience_analyzer import audience_analyzer

        llm_payload = {
            "intereses": ["entrepreneurship", "leadership", "startup"],
            "exclusiones": ["students", "job seekers"],
            "rationale": "Segmentación para fundadores latam.",
        }
        with patch("backend.tools.audience_analyzer.call_llm", return_value=make_json_response(llm_payload)):
            result = audience_analyzer(objetivo="Llenar evento Bogota junio", brand_config=brand_config)

        assert set(result.keys()) == {"intereses", "edad_min", "edad_max", "paises", "tamano_estimado", "exclusiones", "rationale"}

    def test_respeta_edad_de_brand_config(self, brand_config):
        from backend.tools.audience_analyzer import audience_analyzer

        payload = {"intereses": ["entrepreneurship"], "exclusiones": [], "rationale": "OK"}
        with patch("backend.tools.audience_analyzer.call_llm", return_value=make_json_response(payload)):
            result = audience_analyzer(objetivo="test", brand_config=brand_config)

        assert result["edad_min"] == brand_config["publico_edad_min"]
        assert result["edad_max"] == brand_config["publico_edad_max"]

    def test_respeta_paises_de_brand_config(self, brand_config):
        from backend.tools.audience_analyzer import audience_analyzer

        payload = {"intereses": ["entrepreneurship"], "exclusiones": [], "rationale": "OK"}
        with patch("backend.tools.audience_analyzer.call_llm", return_value=make_json_response(payload)):
            result = audience_analyzer(objetivo="test", brand_config=brand_config)

        assert result["paises"] == brand_config["publico_paises"]

    def test_tamano_estimado_es_positivo(self, brand_config):
        from backend.tools.audience_analyzer import audience_analyzer

        payload = {"intereses": ["entrepreneurship"], "exclusiones": [], "rationale": "OK"}
        with patch("backend.tools.audience_analyzer.call_llm", return_value=make_json_response(payload)):
            result = audience_analyzer(objetivo="test", brand_config=brand_config)

        assert result["tamano_estimado"] > 0

    def test_fallback_si_json_invalido(self, brand_config):
        from backend.tools.audience_analyzer import audience_analyzer

        with patch("backend.tools.audience_analyzer.call_llm", return_value=make_text_response("no es json")):
            result = audience_analyzer(objetivo="test", brand_config=brand_config)

        assert isinstance(result["intereses"], list)
        assert len(result["intereses"]) > 0

    def test_fallback_si_llm_lanza_error(self, brand_config):
        from backend.tools.audience_analyzer import audience_analyzer

        with patch("backend.tools.audience_analyzer.call_llm", side_effect=Exception("timeout")):
            result = audience_analyzer(objetivo="test", brand_config=brand_config)

        assert result["rationale"] != ""


# ── copy_generator ────────────────────────────────────────────────────────

class TestCopyGenerator:
    def _audience(self):
        return {"intereses": ["entrepreneurship"], "edad_min": 28, "edad_max": 52}

    def _tono(self):
        return {"estilo": ["directo"], "evitar": ["autoayuda"], "ejemplos_aprobados": []}

    def test_retorna_schema_correcto(self):
        from backend.tools.copy_generator import copy_generator

        payload = {
            "headline": "Lidera el cambio",
            "body": "No crecen solos los mejores líderes.",
            "cta": "Reserva tu lugar",
            "rationale": "Copy aspiracional para fundadores.",
        }
        with patch("backend.tools.copy_generator.call_llm", return_value=make_json_response(payload)):
            result = copy_generator(
                producto="Evento Bogota junio",
                audiencia=self._audience(),
                canal="instagram",
                tono=self._tono(),
                nivel_consciencia="solution_aware",
            )

        assert set(result.keys()) == {"headline", "body", "cta", "rationale"}

    def test_headline_existe_y_no_vacio(self):
        from backend.tools.copy_generator import copy_generator

        payload = {"headline": "Lidera hoy", "body": "Cuerpo.", "cta": "Ver más", "rationale": "OK"}
        with patch("backend.tools.copy_generator.call_llm", return_value=make_json_response(payload)):
            result = copy_generator("Evento", self._audience(), "instagram", self._tono(), "solution_aware")

        assert result["headline"] != ""

    def test_fallback_si_json_invalido(self):
        from backend.tools.copy_generator import copy_generator

        with patch("backend.tools.copy_generator.call_llm", return_value=make_text_response("texto sin json")):
            result = copy_generator("Evento", self._audience(), "instagram", self._tono(), "solution_aware")

        assert result["headline"] != ""
        assert result["cta"] != ""

    def test_fallback_si_llm_lanza_error(self):
        from backend.tools.copy_generator import copy_generator

        with patch("backend.tools.copy_generator.call_llm", side_effect=Exception("down")):
            result = copy_generator("Evento", self._audience(), "instagram", self._tono(), "solution_aware")

        assert result["headline"] != ""


# ── campaign_validator ────────────────────────────────────────────────────

class TestCampaignValidator:
    def _valid_params(self):
        return {
            "copy": {"headline": "Lidera el cambio", "body": "Cuerpo del anuncio.", "cta": "Ver más"},
            "targeting": {"intereses": ["entrepreneurship"], "paises": ["Colombia"]},
            "budget": {"aprobado": True},
            "duracion_dias": 14,
        }

    def test_passed_con_params_validos(self):
        from backend.tools.campaign_validator import campaign_validator

        with patch("backend.tools.campaign_validator.call_llm", return_value=make_text_response("Todo OK.")):
            result = campaign_validator(self._valid_params())

        assert result["passed"] is True
        assert result["blockers"] == []
        assert isinstance(result["checklist_results"], dict)

    def test_bloqueado_sin_headline(self):
        from backend.tools.campaign_validator import campaign_validator

        params = self._valid_params()
        params["copy"]["headline"] = ""
        with patch("backend.tools.campaign_validator.call_llm", return_value=make_text_response("Bloqueado.")):
            result = campaign_validator(params)

        assert result["passed"] is False
        assert len(result["blockers"]) > 0

    def test_bloqueado_sin_audiencia(self):
        from backend.tools.campaign_validator import campaign_validator

        params = self._valid_params()
        params["targeting"]["intereses"] = []
        with patch("backend.tools.campaign_validator.call_llm", return_value=make_text_response("Bloqueado.")):
            result = campaign_validator(params)

        assert result["passed"] is False

    def test_warning_duracion_corta(self):
        from backend.tools.campaign_validator import campaign_validator

        params = self._valid_params()
        params["duracion_dias"] = 3
        with patch("backend.tools.campaign_validator.call_llm", return_value=make_text_response("Warning.")):
            result = campaign_validator(params)

        assert any("aprendizaje" in w.lower() or "días" in w.lower() or "dias" in w.lower() for w in result["warnings"])

    def test_schema_completo(self):
        from backend.tools.campaign_validator import campaign_validator

        with patch("backend.tools.campaign_validator.call_llm", return_value=make_text_response("OK.")):
            result = campaign_validator(self._valid_params())

        assert set(result.keys()) == {"passed", "warnings", "blockers", "checklist_results", "rationale"}


# ── campaign_launcher ─────────────────────────────────────────────────────

class TestCampaignLauncher:
    def _targeting(self):
        return {"tamano_estimado": 600_000, "paises": ["Colombia"], "intereses": ["entrepreneurship"]}

    def _copy(self):
        return {"headline": "Lidera", "body": "Cuerpo.", "cta": "Ver más"}

    def test_mock_retorna_schema_correcto(self):
        from backend.tools.campaign_launcher import campaign_launcher

        result = campaign_launcher(
            canal="instagram",
            copy=self._copy(),
            targeting=self._targeting(),
            budget=200.0,
            duracion_dias=14,
        )

        assert "campaign_id" in result
        assert "status" in result
        assert "estimated_reach" in result

    def test_campaign_id_formato_correcto(self):
        from backend.tools.campaign_launcher import campaign_launcher

        result = campaign_launcher("instagram", self._copy(), self._targeting(), 200.0, 14)

        assert result["campaign_id"].startswith("act_")

    def test_reach_calculado_no_random(self):
        from backend.tools.campaign_launcher import campaign_launcher

        r1 = campaign_launcher("instagram", self._copy(), self._targeting(), 200.0, 14)
        r2 = campaign_launcher("instagram", self._copy(), self._targeting(), 200.0, 14)

        assert r1["estimated_reach"] == r2["estimated_reach"]

    def test_reach_escala_con_presupuesto(self):
        from backend.tools.campaign_launcher import campaign_launcher

        r_low = campaign_launcher("instagram", self._copy(), self._targeting(), 50.0, 14)
        r_high = campaign_launcher("instagram", self._copy(), self._targeting(), 300.0, 14)

        def extract_lower(s):
            return int(s.split("K")[0]) * 1000

        assert extract_lower(r_low["estimated_reach"]) <= extract_lower(r_high["estimated_reach"])


# ── report_generator ──────────────────────────────────────────────────────

class TestReportGenerator:
    def _campaign_result(self):
        return {
            "campaign_id": "act_test123_1715308800",
            "status": "ACTIVE",
            "estimated_reach": "13K–26K personas",
            "preview_url": None,
        }

    def _tool_outputs(self):
        return {
            "budget_validator": {"aprobado": True, "presupuesto_diario_calculado": 14.29, "warnings": []},
            "audience_analyzer": {
                "paises": ["Colombia", "Mexico"],
                "intereses": ["entrepreneurship", "leadership"],
                "edad_min": 28,
                "edad_max": 52,
            },
            "copy_generator": {
                "headline": "Lidera el cambio",
                "body": "No crecen solos.",
                "cta": "Reserva tu lugar",
            },
            "campaign_validator": {"passed": True, "warnings": []},
        }

    def test_retorna_markdown(self):
        from backend.tools.report_generator import report_generator

        with patch("backend.tools.report_generator.call_llm", return_value=make_text_response("Resumen corto.")):
            result = report_generator(self._campaign_result(), self._tool_outputs())

        assert isinstance(result, str)
        assert "# Reporte" in result

    def test_contiene_campaign_id(self):
        from backend.tools.report_generator import report_generator

        with patch("backend.tools.report_generator.call_llm", return_value=make_text_response("Resumen.")):
            result = report_generator(self._campaign_result(), self._tool_outputs())

        assert "act_test123_1715308800" in result

    def test_contiene_headline(self):
        from backend.tools.report_generator import report_generator

        with patch("backend.tools.report_generator.call_llm", return_value=make_text_response("Resumen.")):
            result = report_generator(self._campaign_result(), self._tool_outputs())

        assert "Lidera el cambio" in result

    def test_fallback_si_llm_error(self):
        from backend.tools.report_generator import report_generator

        with patch("backend.tools.report_generator.call_llm", side_effect=Exception("down")):
            result = report_generator(self._campaign_result(), self._tool_outputs())

        assert isinstance(result, str)
        assert len(result) > 50
