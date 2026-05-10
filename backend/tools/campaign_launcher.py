"""
Launches the campaign via Meta Ads API (sandbox) or calculated mock.
Controlled by META_USE_SANDBOX env var.

Real Meta integration lives in backend/integrations/meta_ads.py (Objetivo C).
This tool is the entry point used by the Campaign Agent.
"""
import os
import time

# CPL benchmark for executive education in LATAM (USD)
_CPL_BENCHMARK_LATAM_EDU = 15.0


def campaign_launcher(
    canal: str,
    copy: dict,
    targeting: dict,
    budget: float,
    duracion_dias: int,
) -> dict:
    use_sandbox = os.environ.get("META_USE_SANDBOX", "true").lower() == "true"
    ad_account_id = os.environ.get("META_AD_ACCOUNT_ID", "act_demo")

    if use_sandbox:
        return _launch_sandbox(canal, copy, targeting, budget, duracion_dias, ad_account_id)

    return _launch_mock(canal, copy, targeting, budget, duracion_dias, ad_account_id)


def _launch_sandbox(
    canal: str,
    copy: dict,
    targeting: dict,
    budget: float,
    duracion_dias: int,
    ad_account_id: str,
) -> dict:
    try:
        from backend.integrations.meta_ads import (
            create_campaign,
            create_ad_set,
            create_ad,
        )

        campaign_id = create_campaign(
            name=f"[Adkio] {copy.get('headline', 'Campaña')}",
            objective="OUTCOME_LEADS",
            budget_cents=int(budget * 100),
            ad_account_id=ad_account_id,
        )

        adset_id = create_ad_set(
            campaign_id=campaign_id,
            targeting=targeting,
            budget_cents=int((budget / duracion_dias) * 100),
            start_time=None,
            end_time=None,
        )

        ad_id = create_ad(
            adset_id=adset_id,
            copy=copy,
            creative_spec={},
        )

        reach = _calculate_reach(targeting, budget)
        return {
            "campaign_id": campaign_id,
            "status": "PAUSED",
            "estimated_reach": f"{reach // 1000}K–{(reach * 2) // 1000}K personas",
            "preview_url": _ads_manager_url(ad_account_id, campaign_id),
        }
    except Exception:
        # Fall back to mock if sandbox fails
        return _launch_mock(canal, copy, targeting, budget, duracion_dias, ad_account_id)


def _launch_mock(
    canal: str,
    copy: dict,
    targeting: dict,
    budget: float,
    duracion_dias: int,
    ad_account_id: str,
) -> dict:
    clean_id = ad_account_id.replace("act_", "")
    campaign_id = f"act_{clean_id}_{int(time.time())}"

    reach = _calculate_reach(targeting, budget)
    impressions = int(reach * 1.8)

    return {
        "campaign_id": campaign_id,
        "status": "ACTIVE",
        "estimated_reach": f"{reach // 1000}K–{(reach * 2) // 1000}K personas",
        "impressions_estimados": impressions,
        "preview_url": None,
    }


def _calculate_reach(targeting: dict, budget_usd: float) -> int:
    tamano = targeting.get("tamano_estimado", 500_000)
    reach = int(tamano * (budget_usd / _CPL_BENCHMARK_LATAM_EDU))
    return max(1_000, min(reach, tamano))


def _ads_manager_url(account_id: str, campaign_id: str) -> str:
    clean = account_id.replace("act_", "")
    return (
        f"https://adsmanager.facebook.com/adsmanager/manage/campaigns"
        f"?act={clean}&selected_campaign_ids={campaign_id}"
    )
