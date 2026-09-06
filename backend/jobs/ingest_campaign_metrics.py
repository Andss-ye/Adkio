"""
Ingesta diaria de métricas Meta hacia `campaign_metrics`.

Existe porque la tabla y el GET (ADK-9) no escriben filas solos. No es tool
del LLM: el cron no debe gastar tokens. Corre en un Cron Job de Render aparte
de uvicorn. Meta en serie — `FacebookAdsApi.init` es global y no thread-safe.
Credenciales solo vía `DBCredentialResolver(account_id)`; sin fallback a env.
"""
from __future__ import annotations

import logging
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Callable, Optional

from backend.db.supabase_client import list_ingestible_campaigns, upsert_campaign_metrics
from backend.integrations.adapter_registry import get_adapter
from backend.integrations.base import CampaignStatus
from backend.services.credential_resolver import CredentialResolver, DBCredentialResolver

logger = logging.getLogger(__name__)

_LOOKBACK_DAYS = (1, 2, 3)


@dataclass
class IngestSummary:
    ingested: int = 0
    skipped: int = 0
    failed: int = 0


def ingest_window(today_utc: Optional[date] = None) -> list[date]:
    """D-1..D-3 UTC. Nunca el día en curso."""
    today = today_utc or datetime.now(timezone.utc).date()
    return [today - timedelta(days=n) for n in _LOOKBACK_DAYS]


def _db_resolver_factory(account_id: str) -> CredentialResolver:
    from backend.db.supabase_client import _get_client

    return DBCredentialResolver(account_id, _get_client())


def _is_ingestible(campaign: dict) -> bool:
    return (
        campaign.get("platform") == "meta"
        and not campaign.get("is_mock")
        and bool(campaign.get("account_id"))
        and bool(campaign.get("campaign_id"))
    )


def run_ingest(
    *,
    list_fn: Optional[Callable[..., list[dict]]] = None,
    upsert_fn: Optional[Callable[[dict], str]] = None,
    resolver_factory: Optional[Callable[[str], CredentialResolver]] = None,
    get_adapter_fn: Optional[Callable[[str], object]] = None,
    today_utc: Optional[date] = None,
) -> IngestSummary:
    """Recorre campañas ingestibles y upserta D-1..D-3. Un fallo no aborta el batch."""
    list_campaigns = list_fn or list_ingestible_campaigns
    upsert = upsert_fn or upsert_campaign_metrics
    make_resolver = resolver_factory or _db_resolver_factory
    adapter_for = get_adapter_fn or get_adapter
    dates = ingest_window(today_utc)
    summary = IngestSummary()

    campaigns = list_campaigns()
    pending = []
    for campaign in campaigns:
        if _is_ingestible(campaign):
            pending.append(campaign)
        else:
            logger.info(
                "ingest skip reason=filter platform=%s is_mock=%s campaign_id=%s",
                campaign.get("platform"),
                campaign.get("is_mock"),
                campaign.get("campaign_id"),
            )
            summary.skipped += 1

    if not pending:
        logger.info(
            "ingest done ingested=%s skipped=%s failed=%s",
            summary.ingested,
            summary.skipped,
            summary.failed,
        )
        return summary

    adapter = adapter_for("meta")
    for campaign in pending:
        _ingest_campaign(
            campaign,
            adapter=adapter,
            dates=dates,
            upsert=upsert,
            make_resolver=make_resolver,
            summary=summary,
        )

    logger.info(
        "ingest done ingested=%s skipped=%s failed=%s",
        summary.ingested,
        summary.skipped,
        summary.failed,
    )
    return summary


def _ingest_campaign(
    campaign: dict,
    *,
    adapter,
    dates: list[date],
    upsert: Callable[[dict], str],
    make_resolver: Callable[[str], CredentialResolver],
    summary: IngestSummary,
) -> None:
    account_id = campaign["account_id"]
    campaign_id = campaign["campaign_id"]
    resolver = make_resolver(account_id)
    creds = resolver.resolve("meta")
    if creds is None:
        logger.info(
            "ingest skip reason=no_creds account_id=%s campaign_id=%s",
            account_id,
            campaign_id,
        )
        summary.skipped += 1
        return

    for metric_date in dates:
        try:
            status: CampaignStatus = adapter.get_campaign(
                creds, campaign_id, metric_date=metric_date
            )
        except Exception:  # noqa: BLE001 — aislar el batch
            logger.exception(
                "ingest fail campaign_id=%s metric_date=%s",
                campaign_id,
                metric_date,
            )
            summary.failed += 1
            continue

        if status.error:
            logger.warning(
                "ingest fail campaign_id=%s metric_date=%s error=%s",
                campaign_id,
                metric_date,
                status.error,
            )
            summary.failed += 1
            continue

        payload = {
            "account_id": account_id,
            "brand_id": campaign.get("brand_id"),
            "platform": "meta",
            "campaign_id": campaign_id,
            "metric_date": metric_date.isoformat(),
            "impressions": status.impressions,
            "reach": status.reach,
            "clicks": status.clicks,
            "spend_usd": status.spend,
        }
        try:
            upsert(payload)
            summary.ingested += 1
        except Exception:  # noqa: BLE001 — aislar el batch
            logger.exception(
                "ingest upsert fail campaign_id=%s metric_date=%s",
                campaign_id,
                metric_date,
            )
            summary.failed += 1


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(name)s %(message)s",
    )
    try:
        run_ingest()
    except Exception:  # noqa: BLE001 — fallar el proceso solo si aborta el walker
        logger.exception("ingest abort")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
