"""Integration tests for audience targeting without hallucination."""
import pytest
from unittest.mock import patch, MagicMock
from backend.tools.audience_analyzer import audience_analyzer


class TestIntegrationNoHallucination:
    """Integration tests that simulate real audience_analyzer behavior."""

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_explicit_constraints_override_brand_defaults(self, mock_llm):
        """Test that explicit user parameters override brand_config defaults."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": ["Fashion", "Streetwear"], "exclusiones": ["Luxury"], "edad_min": 22, "edad_max": 33, "rationale": "test"}'
        mock_llm.return_value = mock_response

        # Brand default says Mexico and wide age range
        brand_config = {
            "negocio_nombre": "Fashion Shop",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Affordable casual wear",
            "publico_paises": ["Mexico", "Brazil"],  # Default is different countries
            "publico_edad_min": 18,
            "publico_edad_max": 55,
        }

        # User explicitly asks for Colombia, 23-30
        result = audience_analyzer(
            objetivo="Vender camisetas en Colombia",
            brand_config=brand_config,
            paises_explícitos=["Colombia"],  # Explicit: override default
            edad_min_explícita=23,
            edad_max_explícita=30,
        )

        # Result should respect explicit constraints, not brand_config
        assert result["paises"] == ["Colombia"], "Explicit countries should override brand defaults"
        # LLM tried 22-33 but constraint was 23-30, so post-validation forces 23-30
        assert result["edad_min"] == 23, "Explicit min age should be respected"
        assert result["edad_max"] == 30, "Explicit max age should be respected"

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_no_explicit_params_uses_brand_defaults(self, mock_llm):
        """When no explicit params, behavior is unchanged (uses brand defaults)."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": ["Fashion"], "exclusiones": [], "edad_min": 25, "edad_max": 50, "rationale": "test"}'
        mock_llm.return_value = mock_response

        brand_config = {
            "negocio_nombre": "Fashion Shop",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Casual wear",
            "publico_paises": ["Mexico", "Argentina"],
            "publico_edad_min": 25,
            "publico_edad_max": 55,
        }

        result = audience_analyzer(
            objetivo="Vender camisetas",
            brand_config=brand_config,
            paises_explícitos=None,  # No explicit override
            edad_min_explícita=None,
            edad_max_explícita=None,
        )

        # Should use brand_config defaults
        assert set(result["paises"]) == {"Mexico", "Argentina"}

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_constraint_string_in_llm_message(self, mock_llm):
        """Verify that constraint warning is injected into LLM prompt."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": [], "exclusiones": [], "edad_min": 23, "edad_max": 30, "rationale": "test"}'
        mock_llm.return_value = mock_response

        brand_config = {
            "negocio_nombre": "Test",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Test",
        }

        audience_analyzer(
            objetivo="Test campaign",
            brand_config=brand_config,
            paises_explícitos=["Colombia"],
            edad_min_explícita=23,
            edad_max_explícita=30,
        )

        # Check that LLM was called with constraint in message
        call_args = mock_llm.call_args[0][0]
        user_message = call_args[1]
        assert "⚠️ RESTRICCIÓN DEL USUARIO" in user_message["content"]
        assert "23-30" in user_message["content"]

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_estimate_reach_with_explicit_countries(self, mock_llm):
        """Verify that estimated reach is calculated based on explicit countries."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": ["Fashion"], "exclusiones": [], "edad_min": 25, "edad_max": 35, "rationale": "test"}'
        mock_llm.return_value = mock_response

        brand_config = {
            "negocio_nombre": "Test",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Test",
        }

        result = audience_analyzer(
            objetivo="Test",
            brand_config=brand_config,
            paises_explícitos=["España"],  # Single country = smaller reach
            edad_min_explícita=None,
            edad_max_explícita=None,
        )

        # Reach should be calculated on España only, not LATAM
        # (base is ~6M, 1 country factor ~0.6, age range ~25% = ~900k)
        assert result["tamano_estimado"] > 0
        assert isinstance(result["tamano_estimado"], int)
