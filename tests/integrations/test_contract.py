"""
Contract test — los 3 adapters deben cumplir `PlatformAdapter`.

Esto NO toca la red ni mockea SDKs — solo verifica la forma del Protocol
y los atributos públicos. Si alguien rompe la firma de un adapter, este
test lo detecta antes que cualquier test de integración.
"""
from __future__ import annotations

import inspect
from datetime import date

import pytest

from backend.integrations.base import CampaignStatus, PlatformAdapter
from backend.integrations.google_ads_adapter import GoogleAdsAdapter
from backend.integrations.meta_adapter import MetaAdapter
from backend.integrations.tiktok_adapter import TikTokAdapter


ADAPTERS = [
    (MetaAdapter, "meta"),
    (TikTokAdapter, "tiktok"),
    (GoogleAdsAdapter, "google_ads"),
]


@pytest.mark.parametrize("adapter_cls,expected_platform", ADAPTERS)
def test_adapter_satisfies_protocol(adapter_cls, expected_platform):
    adapter = adapter_cls()
    assert isinstance(adapter, PlatformAdapter)
    assert adapter.platform == expected_platform


@pytest.mark.parametrize("adapter_cls,_", ADAPTERS)
def test_adapter_exposes_required_methods(adapter_cls, _):
    adapter = adapter_cls()
    for method in ("create_campaign", "delete_campaign", "get_campaign"):
        assert callable(getattr(adapter, method)), (
            f"{adapter_cls.__name__} no expone {method}"
        )


@pytest.mark.parametrize("adapter_cls,_", ADAPTERS)
def test_get_campaign_acepta_metric_date_opcional(adapter_cls, _):
    sig = inspect.signature(adapter_cls.get_campaign)
    assert "metric_date" in sig.parameters
    assert sig.parameters["metric_date"].default is None


def test_campaign_status_clicks_y_metric_date_default():
    status = CampaignStatus(
        platform="meta",
        campaign_id="1",
        status="PAUSED",
        name=None,
        objective=None,
    )
    assert status.clicks == 0
    assert status.metric_date is None
    with_date = CampaignStatus(
        platform="meta",
        campaign_id="1",
        status="PAUSED",
        name=None,
        objective=None,
        clicks=4,
        metric_date=date(2026, 9, 5),
    )
    assert with_date.clicks == 4
    assert with_date.metric_date == date(2026, 9, 5)


def test_platforms_are_unique():
    platforms = [a().platform for a, _ in ADAPTERS]
    assert len(platforms) == len(set(platforms))
