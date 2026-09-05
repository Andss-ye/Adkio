"""
Tests de claims_validator — determinista, sin red ni LLM.

Cubren las cuatro categorías que bloquean, la que solo advierte, las listas
negras por vertical y la integración con campaign_validator.
"""
from unittest.mock import patch

from backend.tools.campaign_validator import campaign_validator
from backend.tools.claims_validator import claims_validator
from tests.conftest import make_text_response

_BODY_NEUTRO = "Conocé la propuesta y escribinos para coordinar una visita."


def _validar(headline: str, body: str = _BODY_NEUTRO, cta: str = "Más información",
             industria: str = "") -> dict:
    return claims_validator(
        {"headline": headline, "body": body, "cta": cta}, industria
    )


def _categorias(resultado: dict) -> set:
    return {c["categoria"] for c in resultado["claims"]}


def _validar_campana(params: dict) -> dict:
    """campaign_validator con el LLM del rationale mockeado — sin red."""
    with patch(
        "backend.tools.campaign_validator.call_llm",
        return_value=make_text_response("Evaluación de prueba."),
    ):
        return campaign_validator(params)


class TestCopyLimpio:
    def test_copy_sin_claims_pasa(self):
        r = _validar("Café de origen tostado en Bogotá")
        assert r["passed"] is True
        assert r["claims"] == []
        assert r["blockers"] == []

    def test_siempre_devuelve_rationale(self):
        r = _validar("Café de origen tostado en Bogotá")
        assert isinstance(r["rationale"], str)
        assert len(r["rationale"]) > 20

    def test_no_marca_texto_publicitario_normal(self):
        """Falsos positivos: el copy honesto tiene que pasar limpio."""
        for headline in [
            "Curso de finanzas para emprendedores",
            "Envíos gratis a todo el país",
            "Agendá tu primera consulta",
            "Diseñado para equipos que crecen rápido",
        ]:
            assert _validar(headline)["claims"] == [], headline


class TestPromesaDeResultado:
    def test_resultados_garantizados_bloquea(self):
        r = _validar("Resultados garantizados en 30 días")
        assert r["passed"] is False
        assert "promesa_de_resultado" in _categorias(r)

    def test_cien_por_ciento_efectivo_bloquea(self):
        assert _validar("Método 100% efectivo")["passed"] is False

    def test_duplicar_ventas_bloquea(self):
        assert _validar("Duplicá tus ventas este trimestre")["passed"] is False

    def test_sin_riesgo_bloquea(self):
        assert _validar("Invertí sin riesgo")["passed"] is False


class TestSalud:
    def test_bajar_kilos_bloquea(self):
        r = _validar("Bajá 10 kilos este verano")
        assert r["passed"] is False
        assert "salud" in _categorias(r)

    def test_milagroso_bloquea(self):
        assert _validar("Tratamiento milagroso para el insomnio")["passed"] is False

    def test_quema_grasa_bloquea(self):
        assert _validar("Quema grasa mientras dormís")["passed"] is False


class TestAntesDespues:
    def test_antes_y_despues_bloquea(self):
        r = _validar("Mirá el antes y después de nuestros clientes")
        assert r["passed"] is False
        assert "antes_despues" in _categorias(r)

    def test_transformacion_con_plazo_bloquea(self):
        assert _validar("Transformación en 15 días")["passed"] is False


class TestAtributoPersonal:
    def test_pregunta_por_condicion_bloquea(self):
        """Es la causa nº1 de rechazo real en el ad review de Meta."""
        r = _validar("¿Sos diabético? Tenemos algo para vos")
        assert r["passed"] is False
        assert "atributo_personal" in _categorias(r)

    def test_estas_deprimido_bloquea(self):
        assert _validar("¿Estás deprimido? Escribinos")["passed"] is False

    def test_para_vos_que_tenes_bloquea(self):
        assert _validar("Para vos que tenés deudas")["passed"] is False

    def test_hablar_del_servicio_no_bloquea(self):
        """La misma vertical, sin atribuirle la condición al lector."""
        r = _validar("Acompañamiento profesional para el manejo de la ansiedad")
        assert "atributo_personal" not in _categorias(r)


class TestSuperlativo:
    def test_superlativo_advierte_pero_no_bloquea(self):
        r = _validar("El mejor café del mercado")
        assert r["passed"] is True
        assert _categorias(r) == {"superlativo"}
        assert len(r["warnings"]) == 1
        assert r["blockers"] == []

    def test_numero_uno_advierte(self):
        assert _categorias(_validar("Somos el número uno en ventas")) == {"superlativo"}


class TestListaNegraPorVertical:
    def test_sin_efectos_secundarios_solo_bloquea_en_salud(self):
        assert _validar("Sin efectos secundarios")["passed"] is True
        r = _validar("Sin efectos secundarios", industria="clínica estética")
        assert r["passed"] is False
        assert "salud" in _categorias(r)

    def test_rentabilidad_garantizada_bloquea_en_finanzas(self):
        r = _validar("Rentabilidad asegurada", industria="fintech de inversiones")
        assert r["passed"] is False

    def test_industria_desconocida_usa_solo_patrones_generales(self):
        r = _validar("Sin efectos secundarios", industria="venta de repuestos")
        assert r["passed"] is True


class TestCamposYForma:
    def test_revisa_body_y_cta_ademas_del_headline(self):
        assert _validar("Titular neutro", body="Resultados garantizados.")["passed"] is False
        assert _validar("Titular neutro", cta="Bajá 20 kilos")["passed"] is False

    def test_el_claim_dice_donde_esta_y_como_arreglarlo(self):
        claim = _validar("Titular neutro", body="Resultados garantizados.")["claims"][0]
        assert claim["campo"] == "body"
        assert claim["categoria"] == "promesa_de_resultado"
        assert claim["severidad"] == "blocker"
        assert claim["sugerencia"]
        assert claim["texto"]

    def test_no_duplica_la_misma_categoria_en_el_mismo_campo(self):
        r = _validar("Resultados garantizados y 100% efectivo")
        assert len([c for c in r["claims"] if c["campo"] == "headline"]) == 1

    def test_el_blocker_humanizado_cita_el_texto(self):
        r = _validar("Resultados garantizados en 30 días")
        assert "garantizados" in r["blockers"][0]


class TestEntradaDegenerada:
    def test_copy_vacio_no_rompe(self):
        r = claims_validator({})
        assert r["passed"] is True
        assert r["rationale"]

    def test_copy_no_dict_no_rompe(self):
        assert claims_validator(None)["passed"] is True
        assert claims_validator("un string")["passed"] is True

    def test_campos_no_string_se_ignoran(self):
        assert claims_validator({"headline": 42, "body": None})["claims"] == []


class TestIntegracionConCampaignValidator:
    _PARAMS_OK = {
        "copy": {"headline": "Café de origen", "body": "Tostado artesanal en Bogotá."},
        "targeting": {"intereses": ["café"], "paises": ["Colombia"]},
        "budget": {"aprobado": True},
        "duracion_dias": 14,
    }

    def test_claims_bloqueados_tumban_el_checklist(self):
        params = dict(self._PARAMS_OK, claims={"passed": False})
        r = _validar_campana(params)
        assert r["passed"] is False
        assert r["checklist_results"]["copy_sin_claims_riesgosos"] is False
        assert any("claims" in b for b in r["blockers"])

    def test_claims_limpios_no_agregan_blocker(self):
        params = dict(self._PARAMS_OK, claims={"passed": True})
        r = _validar_campana(params)
        assert r["checklist_results"]["copy_sin_claims_riesgosos"] is True

    def test_sin_la_clave_claims_el_checklist_sigue_pasando(self):
        """Compat: los callers que no inyectan claims no se rompen."""
        r = _validar_campana(self._PARAMS_OK)
        assert r["checklist_results"]["copy_sin_claims_riesgosos"] is True
