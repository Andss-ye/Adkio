"""
Tests del GoogleAdsAdapter — client inyectado, cero red ni gRPC.
"""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock

import pytest

from backend.integrations.base import AdapterError, CampaignSpec
from backend.integrations.credentials import GoogleAdsCreds
from backend.integrations.google_ads_adapter import GoogleAdsAdapter


@pytest.fixture
def valid_creds():
    return GoogleAdsCreds(
        developer_token="dev",
        client_id="cid",
        client_secret="csecret",
        refresh_token="rtok",
        customer_id="1234567890",
    )


def _make_fake_client(campaign_id: str = "g_999"):
    """Construye un client falso con la forma mínima del google-ads SDK."""
    client = MagicMock()

    # Budget service
    budget_service = MagicMock()
    budget_result = MagicMock()
    budget_result.resource_name = "customers/1234567890/campaignBudgets/b1"
    budget_response = MagicMock()
    budget_response.results = [budget_result]
    budget_service.mutate_campaign_budgets.return_value = budget_response

    # Campaign service
    campaign_service = MagicMock()
    create_result = MagicMock()
    create_result.resource_name = f"customers/1234567890/campaigns/{campaign_id}"
    create_response = MagicMock()
    create_response.results = [create_result]
    campaign_service.mutate_campaigns.return_value = create_response

    # GoogleAdsService (para get_campaign)
    ga_service = MagicMock()

    def _fake_get_service(name):
        return {
            "CampaignBudgetService": budget_service,
            "CampaignService": campaign_service,
            "GoogleAdsService": ga_service,
        }[name]

    client.get_service.side_effect = _fake_get_service

    # get_type devuelve un MagicMock con .create y .remove asignables
    def _fake_get_type(name):
        return MagicMock()

    client.get_type.side_effect = _fake_get_type

    # enums.* devuelve cualquier atributo como MagicMock
    client.enums = MagicMock()
    return client, budget_service, campaign_service, ga_service


def test_create_campaign_builds_budget_then_campaign(valid_creds):
    client, budget_service, campaign_service, _ = _make_fake_client("g_999")
    adapter = GoogleAdsAdapter(client=client)
    spec = CampaignSpec(
        name="Demo GA",
        objective="OUTCOME_LEADS",
        budget_usd=700.0,
        duration_days=10,
    )
    result = adapter.create_campaign(valid_creds, spec)

    assert result.platform == "google_ads"
    assert result.campaign_id == "g_999"
    assert result.status == "PAUSED"
    assert "Google" in result.rationale
    assert result.raw["channel_type"] == "SEARCH"

    budget_service.mutate_campaign_budgets.assert_called_once()
    campaign_service.mutate_campaigns.assert_called_once()


def test_create_campaign_raises_when_credentials_missing():
    client, *_ = _make_fake_client()
    adapter = GoogleAdsAdapter(client=client)
    bad = GoogleAdsCreds(
        developer_token="",
        client_id="",
        client_secret="",
        refresh_token="",
        customer_id="",
    )
    with pytest.raises(AdapterError) as exc:
        adapter.create_campaign(
            bad,
            CampaignSpec(name="X", objective="X", budget_usd=1, duration_days=1),
        )
    assert "credenciales incompletas" in str(exc.value)


def test_create_campaign_propagates_sdk_failure(valid_creds):
    client, budget_service, *_ = _make_fake_client()
    budget_service.mutate_campaign_budgets.side_effect = RuntimeError("quota exceeded")
    adapter = GoogleAdsAdapter(client=client)
    with pytest.raises(AdapterError) as exc:
        adapter.create_campaign(
            valid_creds,
            CampaignSpec(name="X", objective="OUTCOME_LEADS", budget_usd=10, duration_days=1),
        )
    assert "quota exceeded" in str(exc.value)


def test_delete_campaign_hard_deletes(valid_creds):
    client, _, campaign_service, _ = _make_fake_client()
    adapter = GoogleAdsAdapter(client=client)
    result = adapter.delete_campaign(valid_creds, "g_999")

    assert result.deleted is True
    assert result.soft_delete is False
    assert result.platform_status_after == "REMOVED"
    campaign_service.mutate_campaigns.assert_called_once()

    # Verificar que la operación fue REMOVE con el resource_name correcto
    call_kwargs = campaign_service.mutate_campaigns.call_args.kwargs
    ops = call_kwargs["operations"]
    assert ops[0].remove == "customers/1234567890/campaigns/g_999"


def test_delete_campaign_normalizes_dashed_customer_id():
    creds = GoogleAdsCreds(
        developer_token="d",
        client_id="c",
        client_secret="s",
        refresh_token="r",
        customer_id="123-456-7890",
    )
    client, _, campaign_service, _ = _make_fake_client()
    adapter = GoogleAdsAdapter(client=client)
    adapter.delete_campaign(creds, "g_999")
    ops = campaign_service.mutate_campaigns.call_args.kwargs["operations"]
    assert "1234567890" in ops[0].remove


def test_get_campaign_parses_first_row(valid_creds):
    client, _, _, ga_service = _make_fake_client()
    row = MagicMock()
    row.campaign.id = 999
    row.campaign.name = "Camp G"
    row.campaign.status.name = "PAUSED"
    row.campaign.advertising_channel_type.name = "SEARCH"
    row.metrics.impressions = 10
    row.metrics.cost_micros = 5_000_000
    ga_service.search.return_value = iter([row])
    adapter = GoogleAdsAdapter(client=client)
    status = adapter.get_campaign(valid_creds, "999")
    assert status.status == "PAUSED"
    assert status.impressions == 10
    assert status.spend == 5.0


def test_get_campaign_handles_empty_result(valid_creds):
    client, _, _, ga_service = _make_fake_client()
    ga_service.search.return_value = iter([])
    adapter = GoogleAdsAdapter(client=client)
    status = adapter.get_campaign(valid_creds, "999")
    assert status.status == "UNKNOWN"
    assert status.error == "campaign not found"


def test_get_campaign_acepta_metric_date_sin_fallar(valid_creds):
    client, _, _, ga_service = _make_fake_client()
    ga_service.search.return_value = iter([])
    adapter = GoogleAdsAdapter(client=client)
    status = adapter.get_campaign(
        valid_creds, "999", metric_date=date(2026, 9, 5)
    )
    assert status.status == "UNKNOWN"
    assert status.clicks == 0
