"""Unit tests for _extract_user_parameters function."""
import pytest
from backend.agents.campaign_agent import _extract_user_parameters


class TestParameterExtraction:
    """Tests for explicit parameter extraction from user prompts."""

    def test_extract_single_country(self):
        prompt = "campaña de camisetas de sol, Colombia 25 años; rango de edad 23-30 años"
        result = _extract_user_parameters(prompt)
        assert result["paises"] == ["Colombia"]
        assert result["edad_min"] == 23
        assert result["edad_max"] == 30

    def test_extract_multiple_countries(self):
        prompt = "vender en Colombia y Argentina"
        result = _extract_user_parameters(prompt)
        assert set(result["paises"]) == {"Colombia", "Argentina"}
        assert result["edad_min"] is None
        assert result["edad_max"] is None

    def test_extract_age_range_only(self):
        prompt = "jóvenes de 18-25 años"
        result = _extract_user_parameters(prompt)
        assert result["paises"] is None
        assert result["edad_min"] == 18
        assert result["edad_max"] == 25

    def test_case_insensitive_country(self):
        prompt = "COLOMBIA, edad 20-35"
        result = _extract_user_parameters(prompt)
        assert result["paises"] == ["Colombia"]
        assert result["edad_min"] == 20
        assert result["edad_max"] == 35

    def test_no_parameters(self):
        prompt = "sin país ni edad"
        result = _extract_user_parameters(prompt)
        assert result["paises"] is None
        assert result["edad_min"] is None
        assert result["edad_max"] is None

    def test_spanish_with_accent(self):
        prompt = "Perú"
        result = _extract_user_parameters(prompt)
        assert "Perú" in result["paises"]  # Prefers accented form

    def test_spain_detected(self):
        prompt = "España y Colombia, 25-40 años"
        result = _extract_user_parameters(prompt)
        assert "España" in result["paises"]
        assert "Colombia" in result["paises"]
        assert result["edad_min"] == 25
        assert result["edad_max"] == 40

    def test_unsupported_country_not_detected(self):
        prompt = "Italia"
        result = _extract_user_parameters(prompt)
        assert result["paises"] is None

    def test_compound_country_name(self):
        prompt = "República Dominicana"
        result = _extract_user_parameters(prompt)
        assert result["paises"] is not None
        assert len(result["paises"]) > 0

    def test_age_clamping_lower_bound(self):
        prompt = "edad 5-25"
        result = _extract_user_parameters(prompt)
        assert result["edad_min"] == 13  # Clamped to minimum

    def test_age_clamping_upper_bound(self):
        prompt = "edad 25-100"
        result = _extract_user_parameters(prompt)
        assert result["edad_max"] == 65  # Clamped to maximum

    def test_invalid_age_range_reversed(self):
        prompt = "edad 30-20"
        result = _extract_user_parameters(prompt)
        assert result["edad_min"] is None
        assert result["edad_max"] is None

    def test_various_age_keywords(self):
        """Test that various age keywords are recognized."""
        test_cases = [
            ("edad 20-30", 20, 30),
            ("años 25-35", 25, 35),
            ("age 30-40", 30, 40),  # English keyword should work
            ("20-30 años", 20, 30),
        ]
        for prompt, expected_min, expected_max in test_cases:
            result = _extract_user_parameters(prompt)
            assert result["edad_min"] == expected_min
            assert result["edad_max"] == expected_max

    def test_mexico_with_accent(self):
        prompt = "México"
        result = _extract_user_parameters(prompt)
        assert "México" in result["paises"]  # Prefers accented form

    def test_multiple_countries_with_conjunctions(self):
        prompt = "Colombia, Argentina y Chile"
        result = _extract_user_parameters(prompt)
        assert set(result["paises"]) == {"Colombia", "Argentina", "Chile"}
