"""Tests del walker de ingesta — adapters y client mockeados, sin red ni env real."""
from __future__ import annotations

from datetime import date
from pathlib import Path
from unittest.mock import MagicMock

from backend.integrations.base import CampaignStatus
from backend.jobs.ingest_campaign_metrics import ingest_window, run_ingest
from backend.services.credential_resolver import EnvCredentialResolver


TODAY = date(2026, 9, 6)
WINDOW = [date(2026, 9, 5), date(2026, 9, 4), date(2026, 9, 3)]

META_CAMP = {
    "account_id": "acct-a",
    "brand_id": "brand-1",
    "platform": "meta",
    "campaign_id": "camp_meta",
    "is_mock": False,
}


def _ok_status(campaign_id: str, metric_date: date) -> CampaignStatus:
    return CampaignStatus(
        platform="meta",
        campaign_id=campaign_id,
        status="PAUSED",
        name="Camp",
        objective="OUTCOME_LEADS",
        reach=10,
        impressions=20,
        spend=1.5,
        clicks=4,
        metric_date=metric_date,
    )


def _resolver(creds=None):
    resolver = MagicMock()
    resolver.resolve.return_value = creds if creds is not None else object()
    return resolver


def _run(campaigns, adapter, resolver_factory, upsert=None):
    upserts = upsert if upsert is not None else []

    def _upsert(payload):
        upserts.append(payload)
        return "row-1"

    return run_ingest(
        list_fn=lambda: campaigns,
        upsert_fn=_upsert,
        resolver_factory=resolver_factory,
        get_adapter_fn=lambda platform: adapter,
        today_utc=TODAY,
    ), upserts


def test_ventana_d1_d3_nunca_hoy():
    assert ingest_window(TODAY) == WINDOW
    assert TODAY not in ingest_window(TODAY)


def test_ingesta_meta_upserta_tres_dias():
    adapter = MagicMock()
    adapter.get_campaign.side_effect = lambda creds, cid, metric_date=None: _ok_status(
        cid, metric_date
    )
    summary, upserts = _run([META_CAMP], adapter, lambda _aid: _resolver())

    assert summary.ingested == 3
    assert summary.skipped == 0
    assert summary.failed == 0
    assert [u["metric_date"] for u in upserts] == [d.isoformat() for d in WINDOW]
    assert all(u["platform"] == "meta" for u in upserts)
    assert all(u["clicks"] == 4 for u in upserts)
    assert all(u["account_id"] == "acct-a" for u in upserts)
    assert adapter.get_campaign.call_count == 3
    assert adapter.get_campaign.call_args_list[0].kwargs["metric_date"] == WINDOW[0]


def test_skip_mock_no_llama_adapter():
    adapter = MagicMock()
    mock_camp = {**META_CAMP, "is_mock": True}
    summary, upserts = _run([mock_camp], adapter, lambda _aid: _resolver())

    assert summary.skipped == 1
    assert summary.ingested == 0
    assert upserts == []
    adapter.get_campaign.assert_not_called()


def test_skip_sin_creds():
    adapter = MagicMock()
    resolver = MagicMock()
    resolver.resolve.return_value = None
    summary, upserts = _run([META_CAMP], adapter, lambda _aid: resolver)

    assert summary.skipped == 1
    assert summary.ingested == 0
    assert upserts == []
    adapter.get_campaign.assert_not_called()
    resolver.resolve.assert_called_once_with("meta")


def test_skip_tiktok_y_google():
    adapter = MagicMock()
    others = [
        {**META_CAMP, "platform": "tiktok", "campaign_id": "tt_1"},
        {**META_CAMP, "platform": "google_ads", "campaign_id": "g_1"},
    ]
    adapters_requested = []

    def get_adapter_fn(platform):
        adapters_requested.append(platform)
        return adapter

    summary = run_ingest(
        list_fn=lambda: others,
        upsert_fn=lambda _p: "row",
        resolver_factory=lambda _aid: _resolver(),
        get_adapter_fn=get_adapter_fn,
        today_utc=TODAY,
    )
    assert summary.skipped == 2
    assert summary.ingested == 0
    assert adapters_requested == []
    adapter.get_campaign.assert_not_called()


def test_idempotencia_misma_ventana():
    adapter = MagicMock()
    adapter.get_campaign.side_effect = lambda creds, cid, metric_date=None: _ok_status(
        cid, metric_date
    )
    upserts: list[dict] = []
    _run([META_CAMP], adapter, lambda _aid: _resolver(), upserts)
    _run([META_CAMP], adapter, lambda _aid: _resolver(), upserts)

    keys = [
        (u["account_id"], u["platform"], u["campaign_id"], u["metric_date"])
        for u in upserts
    ]
    assert len(keys) == 6
    assert set(keys) == {
        ("acct-a", "meta", "camp_meta", d.isoformat()) for d in WINDOW
    }


def test_error_de_una_campana_no_aborta_el_batch():
    adapter = MagicMock()

    def get_campaign(creds, cid, metric_date=None):
        if cid == "camp_a":
            return CampaignStatus(
                platform="meta",
                campaign_id=cid,
                status="UNKNOWN",
                name=None,
                objective=None,
                error="rate limited",
                metric_date=metric_date,
            )
        return _ok_status(cid, metric_date)

    adapter.get_campaign.side_effect = get_campaign
    camps = [
        {**META_CAMP, "campaign_id": "camp_a"},
        {**META_CAMP, "campaign_id": "camp_b"},
    ]
    summary, upserts = _run(camps, adapter, lambda _aid: _resolver())

    assert summary.failed == 3
    assert summary.ingested == 3
    assert all(u["campaign_id"] == "camp_b" for u in upserts)


def test_meta_en_serie_no_en_paralelo():
    order = []

    class _SerialAdapter:
        def get_campaign(self, creds, cid, metric_date=None):
            order.append((cid, metric_date))
            return _ok_status(cid, metric_date)

    camps = [
        {**META_CAMP, "campaign_id": "camp_a", "account_id": "acct-1"},
        {**META_CAMP, "campaign_id": "camp_b", "account_id": "acct-2"},
    ]
    run_ingest(
        list_fn=lambda: camps,
        upsert_fn=lambda _p: "row",
        resolver_factory=lambda _aid: _resolver(),
        get_adapter_fn=lambda _p: _SerialAdapter(),
        today_utc=TODAY,
    )
    assert [cid for cid, _ in order] == (["camp_a"] * 3 + ["camp_b"] * 3)


def test_credenciales_por_account_id():
    seen = []

    def factory(account_id):
        seen.append(account_id)
        return _resolver()

    adapter = MagicMock()
    adapter.get_campaign.side_effect = lambda creds, cid, metric_date=None: _ok_status(
        cid, metric_date
    )
    camps = [
        {**META_CAMP, "account_id": "acct-1", "campaign_id": "c1"},
        {**META_CAMP, "account_id": "acct-2", "campaign_id": "c2"},
    ]
    _run(camps, adapter, factory)
    assert seen == ["acct-1", "acct-2"]


def test_resolver_de_producto_no_es_env():
    from backend.jobs import ingest_campaign_metrics as job

    source = Path(job.__file__).read_text()
    assert "EnvCredentialResolver" not in source
    assert job._db_resolver_factory is not EnvCredentialResolver
