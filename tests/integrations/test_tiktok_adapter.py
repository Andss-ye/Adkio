"""
Tests del TikTokAdapter — http client inyectado, cero red.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from backend.integrations.base import AdapterError, CampaignSpec
from backend.integrations.credentials import TikTokCreds
from backend.integrations.tiktok_adapter import TikTokAdapter


@pytest.fixture
def valid_creds():
    return TikTokCreds(
        access_token="tok",
        advertiser_id="adv_123",
        app_id="app",
        app_secret="secret",
    )


def _resp(payload: dict):
    r = MagicMock()
    r.json.return_value = payload
    return r


def test_create_campaign_returns_create_result(valid_creds):
    http = MagicMock()
    http.post.return_value = _resp({"code": 0, "data": {"campaign_id": "tt_999"}})
    adapter = TikTokAdapter(http_client=http)
    spec = CampaignSpec(
        name="Demo TT",
        objective="OUTCOME_LEADS",
        budget_usd=300.0,
        duration_days=10,
    )
    result = adapter.create_campaign(valid_creds, spec)

    assert result.platform == "tiktok"
    assert result.campaign_id == "tt_999"
    assert result.status == "DISABLE"
    assert "TikTok" in result.rationale
    assert "DISABLE" in result.rationale or "activarla" in result.rationale

    # Verificar URL y mapeo de objetivo
    call_args = http.post.call_args
    url = call_args[0][0]
    body = call_args[1]["json"]
    assert "/campaign/create/" in url
    assert body["objective_type"] == "LEAD_GENERATION"
    assert body["operation_status"] == "DISABLE"


def test_create_campaign_raises_on_api_error(valid_creds):
    http = MagicMock()
    http.post.return_value = _resp({"code": 40001, "message": "invalid token"})
    adapter = TikTokAdapter(http_client=http)
    with pytest.raises(AdapterError) as exc:
        adapter.create_campaign(
            valid_creds,
            CampaignSpec(name="X", objective="X", budget_usd=10, duration_days=1),
        )
    assert "invalid token" in str(exc.value)


def test_create_campaign_raises_on_missing_credentials():
    http = MagicMock()
    adapter = TikTokAdapter(http_client=http)
    bad = TikTokCreds(access_token="", advertiser_id="")
    with pytest.raises(AdapterError) as exc:
        adapter.create_campaign(
            bad,
            CampaignSpec(name="X", objective="X", budget_usd=10, duration_days=1),
        )
    assert "credenciales incompletas" in str(exc.value)
    http.post.assert_not_called()


def test_delete_campaign_is_soft(valid_creds):
    """Crítico: TikTok no permite hard-delete, debe marcarse soft_delete=True."""
    http = MagicMock()
    http.post.return_value = _resp({"code": 0, "data": {}})
    adapter = TikTokAdapter(http_client=http)
    result = adapter.delete_campaign(valid_creds, "tt_999")

    assert result.deleted is True
    assert result.soft_delete is True
    assert result.platform_status_after == "DISABLE"
    assert "soft-delete" in result.rationale or "TikTok no permite" in result.rationale

    body = http.post.call_args[1]["json"]
    assert body["campaign_ids"] == ["tt_999"]
    assert body["operation_status"] == "DISABLE"


def test_delete_campaign_url_uses_status_update(valid_creds):
    http = MagicMock()
    http.post.return_value = _resp({"code": 0, "data": {}})
    adapter = TikTokAdapter(http_client=http)
    adapter.delete_campaign(valid_creds, "tt_999")
    url = http.post.call_args[0][0]
    assert "/campaign/status/update/" in url


def test_get_campaign_parses_response(valid_creds):
    http = MagicMock()
    http.get.return_value = _resp({
        "code": 0,
        "data": {
            "list": [
                {
                    "campaign_name": "MyCamp",
                    "objective_type": "LEAD_GENERATION",
                    "operation_status": "ENABLE",
                }
            ]
        },
    })
    adapter = TikTokAdapter(http_client=http)
    status = adapter.get_campaign(valid_creds, "tt_999")
    assert status.name == "MyCamp"
    assert status.objective == "LEAD_GENERATION"
    assert status.status == "ENABLE"


def test_get_campaign_handles_not_found(valid_creds):
    http = MagicMock()
    http.get.return_value = _resp({"code": 0, "data": {"list": []}})
    adapter = TikTokAdapter(http_client=http)
    status = adapter.get_campaign(valid_creds, "tt_999")
    assert status.status == "UNKNOWN"
    assert status.error == "campaign not found"


def test_sandbox_uses_sandbox_base_url():
    creds = TikTokCreds(access_token="t", advertiser_id="a", sandbox=True)
    assert "sandbox-ads.tiktok.com" in creds.base_url
    prod = TikTokCreds(access_token="t", advertiser_id="a", sandbox=False)
    assert "business-api.tiktok.com" in prod.base_url


def test_headers_include_access_token(valid_creds):
    http = MagicMock()
    http.post.return_value = _resp({"code": 0, "data": {"campaign_id": "x"}})
    adapter = TikTokAdapter(http_client=http)
    adapter.create_campaign(
        valid_creds,
        CampaignSpec(name="X", objective="OUTCOME_LEADS", budget_usd=10, duration_days=1),
    )
    headers = http.post.call_args[1]["headers"]
    assert headers["Access-Token"] == "tok"
    assert headers["Content-Type"] == "application/json"
