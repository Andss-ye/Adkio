"""Unit tests for constrictive audience targeting."""
import pytest
from unittest.mock import patch, MagicMock
from backend.tools.audience_analyzer import audience_analyzer


class TestAudienceAnalyzerConstraints:
    """Tests for audience_analyzer respecting explicit constraints."""

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_explicit_countries_respected(self, mock_llm):
        """Explicit countries should NOT be modified."""
        # Mock LLM response
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": ["Fashion"], "exclusiones": [], "edad_min": 25, "edad_max": 35, "rationale": "test"}'
        mock_llm.return_value = mock_response

        brand_config = {
            "negocio_nombre": "Test",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Test",
            "publico_paises": ["Mexico", "Brazil"],  # Default has different countries
        }

        result = audience_analyzer(
            objetivo="Vender camisetas",
            brand_config=brand_config,
            paises_explícitos=["Colombia"],  # Explicit: only Colombia
            edad_min_explícita=23,
            edad_max_explícita=30,
        )

        # Result should have ONLY Colombia, not default countries
        assert result["paises"] == ["Colombia"]

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_explicit_age_range_respected(self, mock_llm):
        """Explicit age range should NOT be modified by LLM."""
        # Mock LLM trying to expand the age range (23-30 to 20-32)
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": ["Fashion"], "exclusiones": [], "edad_min": 20, "edad_max": 32, "rationale": "test"}'
        mock_llm.return_value = mock_response

        brand_config = {
            "negocio_nombre": "Test",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Test",
        }

        result = audience_analyzer(
            objetivo="Vender camisetas",
            brand_config=brand_config,
            paises_explícitos=["Colombia"],
            edad_min_explícita=23,  # Explicit: 23-30
            edad_max_explícita=30,
        )

        # Result should be 23-30, NOT LLM's 20-32 (constrained)
        assert result["edad_min"] == 23
        assert result["edad_max"] == 30

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_fallback_to_brand_config_when_no_explicit(self, mock_llm):
        """When no explicit params, should use brand_config defaults."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": ["Fashion"], "exclusiones": [], "edad_min": 30, "edad_max": 50, "rationale": "test"}'
        mock_llm.return_value = mock_response

        brand_config = {
            "negocio_nombre": "Test",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Test",
            "publico_paises": ["Mexico", "Argentina"],
        }

        result = audience_analyzer(
            objetivo="Vender camisetas",
            brand_config=brand_config,
            paises_explícitos=None,  # No explicit countries
            edad_min_explícita=None,
            edad_max_explícita=None,
        )

        # Should use brand_config countries
        assert set(result["paises"]) == {"Mexico", "Argentina"}

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_multiple_explicit_countries(self, mock_llm):
        """Multiple explicit countries should be preserved."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": ["Fashion"], "exclusiones": [], "edad_min": 25, "edad_max": 35, "rationale": "test"}'
        mock_llm.return_value = mock_response

        brand_config = {
            "negocio_nombre": "Test",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Test",
        }

        result = audience_analyzer(
            objetivo="Vender camisetas",
            brand_config=brand_config,
            paises_explícitos=["Colombia", "Argentina", "España"],
            edad_min_explícita=None,
            edad_max_explícita=None,
        )

        # Result should have exactly the 3 countries
        assert set(result["paises"]) == {"Colombia", "Argentina", "España"}

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_constraint_injection_in_llm_prompt(self, mock_llm):
        """LLM prompt should include constraint warning when explicit age range is set."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": ["Fashion"], "exclusiones": [], "edad_min": 23, "edad_max": 30, "rationale": "test"}'
        mock_llm.return_value = mock_response

        brand_config = {
            "negocio_nombre": "Test",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Test",
        }

        audience_analyzer(
            objetivo="Vender camisetas",
            brand_config=brand_config,
            paises_explícitos=["Colombia"],
            edad_min_explícita=23,
            edad_max_explícita=30,
        )

        # Verify LLM was called
        assert mock_llm.called
        # Verify the messages include the constraint
        call_args = mock_llm.call_args[0][0]
        user_message_content = call_args[1]["content"]  # Second message (user)
        assert "⚠️ RESTRICCIÓN DEL USUARIO" in user_message_content
        assert "23-30" in user_message_content
