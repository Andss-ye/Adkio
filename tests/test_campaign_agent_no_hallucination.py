"""End-to-end test for campaign agent - verifying no hallucination on audience parameters."""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from backend.agents.campaign_agent import _extract_user_parameters, _dispatch_tool


class TestNoHallucination:
    """Test that agent respects explicit user parameters in audience targeting."""

    def test_extract_original_problem_case(self):
        """Test the exact case that was causing hallucination."""
        user_prompt = "campaña de camisetas de sol, Colombia 25 años; rango de edad 23-30 años"

        extracted = _extract_user_parameters(user_prompt)

        # This was the bug: Colombia expanded to [Colombia, Mexico], age expanded to 20-32
        assert extracted["paises"] == ["Colombia"], "Should extract only Colombia, not Mexico"
        assert extracted["edad_min"] == 23, "Should respect user's min age 23"
        assert extracted["edad_max"] == 30, "Should respect user's max age 30"

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_dispatch_tool_passes_constraints(self, mock_llm):
        """Test that _dispatch_tool correctly passes extracted params to audience_analyzer."""
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": ["Fashion", "Streetwear"], "exclusiones": [], "edad_min": 23, "edad_max": 30, "rationale": "test"}'
        mock_llm.return_value = mock_response

        brand_config = {
            "negocio_nombre": "T-Shirt Shop",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Casual wear",
            "publico_paises": ["Mexico"],  # Default is different
        }

        tool_outputs = {}

        # Simulate extracted params from user prompt
        extracted_params = {
            "paises": ["Colombia"],
            "edad_min": 23,
            "edad_max": 30,
        }

        # Call _dispatch_tool for audience_analyzer
        result = _dispatch_tool(
            tool_name="audience_analyzer",
            tool_args={"objetivo": "Vender camisetas de sol, Colombia 25 años; rango de edad 23-30 años"},
            brand_config=brand_config,
            tool_outputs=tool_outputs,
            extracted_params=extracted_params,
        )

        # Verify the result respects the constraints
        assert result["paises"] == ["Colombia"], "Should NOT add Mexico despite brand default"
        assert result["edad_min"] == 23, "Should respect explicit age constraint"
        assert result["edad_max"] == 30, "Should respect explicit age constraint"

    @patch("backend.tools.audience_analyzer.call_llm")
    def test_llm_expansion_blocked_by_validation(self, mock_llm):
        """Test that if LLM tries to expand age range, post-validation catches it."""
        # LLM tries to expand 23-30 to 20-32 (the original hallucination)
        mock_response = MagicMock()
        mock_response.choices[0].message.content = '{"intereses": ["Fashion"], "exclusiones": [], "edad_min": 20, "edad_max": 32, "rationale": "Expanded for better reach"}'
        mock_llm.return_value = mock_response

        brand_config = {
            "negocio_nombre": "T-Shirt Shop",
            "negocio_industria": "Retail",
            "propuesta_de_valor": "Casual wear",
        }

        tool_outputs = {}
        extracted_params = {
            "paises": ["Colombia"],
            "edad_min": 23,
            "edad_max": 30,
        }

        result = _dispatch_tool(
            tool_name="audience_analyzer",
            tool_args={"objetivo": "Vender camisetas de sol"},
            brand_config=brand_config,
            tool_outputs=tool_outputs,
            extracted_params=extracted_params,
        )

        # Post-LLM validation should force the values back to 23-30
        assert result["edad_min"] == 23, "Validation should prevent LLM expansion"
        assert result["edad_max"] == 30, "Validation should prevent LLM expansion"

    def test_multiple_countries_respected(self):
        """Test that multiple explicit countries are all respected."""
        user_prompt = "Campaña en Colombia, Argentina y España para jóvenes de 20-35 años"

        extracted = _extract_user_parameters(user_prompt)

        assert set(extracted["paises"]) == {"Colombia", "Argentina", "España"}
        assert extracted["edad_min"] == 20
        assert extracted["edad_max"] == 35
