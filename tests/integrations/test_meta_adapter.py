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
    """SDK falso con la misma forma del de facebook_business."""
    sdk = MagicMock()

    # AdAccount(...) devuelve un objeto con create_campaign
    account_instance = MagicMock()
    account_instance.create_campaign.return_value = {"id": "1234567890"}
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

    sdk.FacebookAdsApi = MagicMock()
    sdk.FacebookRequestError = type("FacebookRequestError", (Exception,), {
        "api_error_message": lambda self: "err",
    })

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


def test_meta_creds_normalized_ad_account_id():
    c = MetaCreds(app_id="1", app_secret="", access_token="t", ad_account_id="999")
    assert c.normalized_ad_account_id == "act_999"
    c2 = MetaCreds(app_id="1", app_secret="", access_token="t", ad_account_id="act_999")
    assert c2.normalized_ad_account_id == "act_999"
