"""
Tests del MetaAdapter — SDK inyectado, cero red.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from backend.integrations.base import AdapterError, CampaignSpec
from backend.integrations.credentials import MetaCreds
from backend.integrations.meta_adapter import MetaAdapter


@pytest.fixture
def valid_creds():
    return MetaCreds(
        app_id="123",
        app_secret="secret",
        access_token="token",
        ad_account_id="act_999",
        page_id="page_1",
    )


@pytest.fixture
def fake_sdk():
    """SDK falso con la misma forma del de facebook_business — soporta cadena
    completa Campaign → AdSet → Ad."""
    sdk = MagicMock()

    # AdAccount(...) devuelve un objeto con create_campaign + cadena ads
    account_instance = MagicMock()
    account_instance.create_campaign.return_value = {"id": "1234567890"}
    account_instance.create_ad_set.return_value = {"id": "adset_999"}
    account_instance.create_ad_creative.return_value = {"id": "creative_111"}
    account_instance.create_ad.return_value = {"id": "ad_222"}
    sdk.AdAccount = MagicMock(return_value=account_instance)

    # Campaign(id).api_delete / .api_get / .get_insights
    campaign_instance = MagicMock()
    campaign_instance.api_get.return_value = {
        "name": "Camp",
        "status": "PAUSED",
        "objective": "OUTCOME_LEADS",
    }
    campaign_instance.get_insights.return_value = [
        {"reach": 100, "impressions": 200, "spend": "12.50"}
    ]
    sdk.Campaign = MagicMock(return_value=campaign_instance)

    # TargetingSearch.search → vacío por default (sin intereses resueltos)
    sdk.TargetingSearch = MagicMock()
    sdk.TargetingSearch.search.return_value = []

    sdk.FacebookAdsApi = MagicMock()
    err_attrs = {
        "api_error_message": lambda self: "err",
        "api_error_code": lambda self: 0,
        "api_error_subcode": lambda self: 0,
    }
    sdk.FacebookRequestError = type("FacebookRequestError", (Exception,), err_attrs)

    return sdk


def test_create_campaign_returns_create_result(valid_creds, fake_sdk):
    adapter = MetaAdapter(sdk_module=fake_sdk)
    spec = CampaignSpec(
        name="Demo Bogotá",
        objective="OUTCOME_LEADS",
        budget_usd=200.0,
        duration_days=7,
    )
    result = adapter.create_campaign(valid_creds, spec)

    assert result.platform == "meta"
    assert result.campaign_id == "1234567890"
    assert result.status == "PAUSED"
    assert "Meta" in result.rationale
    assert "PAUSED" in result.rationale
    fake_sdk.FacebookAdsApi.init.assert_called_once()


def test_create_campaign_falls_back_objective(valid_creds, fake_sdk):
    """Si OUTCOME_LEADS falla, debe reintentar con OUTCOME_TRAFFIC."""
    err_class = fake_sdk.FacebookRequestError
    account = fake_sdk.AdAccount.return_value
    account.create_campaign.side_effect = [
        err_class(),  # primer intento falla
        {"id": "fallback_id"},  # segundo OK
    ]
    adapter = MetaAdapter(sdk_module=fake_sdk)
    result = adapter.create_campaign(
        valid_creds,
        CampaignSpec(name="X", objective="OUTCOME_LEADS", budget_usd=100, duration_days=7),
    )
    assert result.campaign_id == "fallback_id"
    assert result.raw["objective_used"] == "OUTCOME_TRAFFIC"


def test_create_campaign_raises_when_credentials_missing(fake_sdk):
    adapter = MetaAdapter(sdk_module=fake_sdk)
    bad_creds = MetaCreds(app_id="", app_secret="", access_token="", ad_account_id="")
    with pytest.raises(AdapterError) as exc:
        adapter.create_campaign(
            bad_creds,
            CampaignSpec(name="X", objective="X", budget_usd=1, duration_days=1),
        )
    assert "credenciales incompletas" in str(exc.value)


def test_delete_campaign_hard_deletes(valid_creds, fake_sdk):
    adapter = MetaAdapter(sdk_module=fake_sdk)
    result = adapter.delete_campaign(valid_creds, "1234567890")

    assert result.deleted is True
    assert result.soft_delete is False
    assert result.platform_status_after == "DELETED"
    fake_sdk.Campaign.assert_called_with("1234567890")
    fake_sdk.Campaign.return_value.api_delete.assert_called_once()


def test_delete_campaign_propagates_api_error(valid_creds, fake_sdk):
    err = fake_sdk.FacebookRequestError()
    fake_sdk.Campaign.return_value.api_delete.side_effect = err
    adapter = MetaAdapter(sdk_module=fake_sdk)
    with pytest.raises(AdapterError):
        adapter.delete_campaign(valid_creds, "123")


def test_get_campaign_returns_status(valid_creds, fake_sdk):
    adapter = MetaAdapter(sdk_module=fake_sdk)
    status = adapter.get_campaign(valid_creds, "1234567890")
    assert status.status == "PAUSED"
    assert status.name == "Camp"
    assert status.reach == 100
    assert status.impressions == 200
    assert status.spend == 12.50


def test_get_campaign_handles_api_error_gracefully(valid_creds, fake_sdk):
    err = fake_sdk.FacebookRequestError()
    fake_sdk.Campaign.return_value.api_get.side_effect = err
    adapter = MetaAdapter(sdk_module=fake_sdk)
    status = adapter.get_campaign(valid_creds, "1234567890")
    assert status.status == "UNKNOWN"
    assert status.error is not None


def test_create_campaign_full_hierarchy_when_page_id_present(valid_creds, fake_sdk):
    """Con page_id en creds, debe crear Campaign + AdSet + Ad."""
    adapter = MetaAdapter(sdk_module=fake_sdk)
    spec = CampaignSpec(
        name="Full hierarchy",
        objective="OUTCOME_LEADS",
        budget_usd=200.0,
        duration_days=7,
        copy={"headline": "Test", "body": "...", "cta": "SIGN_UP"},
        targeting={"paises": ["Colombia"], "edad_min": 28, "edad_max": 52},
    )
    result = adapter.create_campaign(valid_creds, spec)

    account = fake_sdk.AdAccount.return_value
    account.create_campaign.assert_called_once()
    account.create_ad_set.assert_called_once()
    account.create_ad_creative.assert_called_once()
    account.create_ad.assert_called_once()

    assert result.raw["adset_id"] == "adset_999"
    assert result.raw["ad_id"] == "ad_222"
    assert result.raw["creative_fallback"] is False
    assert "AdSet" in result.rationale and "Ad" in result.rationale


def test_create_campaign_skips_hierarchy_without_page_id(fake_sdk):
    """Sin page_id, solo crea el shell de Campaign."""
    no_page = MetaCreds(
        app_id="1", app_secret="s", access_token="t", ad_account_id="act_1"
    )
    adapter = MetaAdapter(sdk_module=fake_sdk)
    result = adapter.create_campaign(
        no_page,
        CampaignSpec(name="X", objective="OUTCOME_LEADS", budget_usd=100, duration_days=7),
    )
    account = fake_sdk.AdAccount.return_value
    account.create_campaign.assert_called_once()
    account.create_ad_set.assert_not_called()
    assert result.raw["adset_id"] is None
    assert "shell" in result.rationale.lower() or "page_id" in result.rationale.lower()


def test_create_campaign_falls_back_to_creative_on_no_payment(valid_creds, fake_sdk):
    """Si la cuenta no tiene método de pago (error code 100), devuelve
    creative_id como ad_id y marca creative_fallback=True."""
    account = fake_sdk.AdAccount.return_value

    err = fake_sdk.FacebookRequestError()
    # Sobrescribir el método api_error_code para simular el error de pago
    type(err).api_error_code = lambda self: 100
    type(err).api_error_subcode = lambda self: 1359188

    account.create_ad.side_effect = err

    adapter = MetaAdapter(sdk_module=fake_sdk)
    result = adapter.create_campaign(
        valid_creds,
        CampaignSpec(
            name="No pay",
            objective="OUTCOME_LEADS",
            budget_usd=100,
            duration_days=7,
            copy={"headline": "Test"},
            targeting={"paises": ["Colombia"]},
        ),
    )
    assert result.raw["creative_fallback"] is True
    assert result.raw["ad_id"] == "creative_111"  # creative_id usado como fallback
    assert "método de pago" in result.rationale


def test_country_mapping_translates_names_to_iso():
    """Helper estático: nombres LATAM se mapean a códigos ISO."""
    codes = MetaAdapter._to_country_codes(
        ["Colombia", "México", "PE", "Brasil", "Inexistente"]
    )
    assert "CO" in codes
    assert "MX" in codes
    assert "PE" in codes
    assert "BR" in codes
    assert "Inexistente" not in codes  # silenciado, no incluido


def test_meta_creds_normalized_ad_account_id():
    c = MetaCreds(app_id="1", app_secret="", access_token="t", ad_account_id="999")
    assert c.normalized_ad_account_id == "act_999"
    c2 = MetaCreds(app_id="1", app_secret="", access_token="t", ad_account_id="act_999")
    assert c2.normalized_ad_account_id == "act_999"
