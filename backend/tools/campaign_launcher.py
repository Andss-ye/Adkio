"""
campaign_launcher — entry point del agente para crear una campaña.

Diseño multi-canal:
- `platform` (meta | tiktok | google_ads) determina qué adapter usar.
- `canal` se mantiene como placement legible (instagram, facebook, tiktok,
  google_search, google_display, youtube). Si no llega `platform`, se infiere
  desde `canal` para compat con el flujo viejo.
- El resolver de credenciales se inyecta (default: EnvCredentialResolver).
  Cuando llegue multitenant, se pasa `DBCredentialResolver(account_id=...)`.
- Si la plataforma no está conectada o el adapter falla, hace fallback a un
  mock calculado para no romper el demo.

Output mantiene la misma forma que esperaba la pipeline anterior, más:
- `platform`: la plataforma usada
- `rationale`: explicación lista para el panel
"""
from __future__ import annotations

import logging
import time

from backend.integrations.adapter_registry import get_adapter, supported_platforms
from backend.integrations.base import AdapterError, CampaignSpec
from backend.services.credential_resolver import EnvCredentialResolver, get_default_resolver

_log = logging.getLogger(__name__)

# CPL benchmark for executive education in LATAM (USD) — usado solo por el mock
_CPL_BENCHMARK_LATAM_EDU = 15.0


_PLATFORM_OBJECTIVE: dict[str, str] = {
    "meta": "OUTCOME_LEADS",
    "tiktok": "OUTCOME_LEADS",
    "google_ads": "OUTCOME_LEADS",
}


def _infer_platform(canal: str) -> str:
    """Mapea canal/placement legible → plataforma técnica."""
    canal = (canal or "").lower().strip()
    if canal in ("instagram", "facebook", "meta", "fb", "ig"):
        return "meta"
    if canal in ("tiktok", "tt"):
        return "tiktok"
    if canal in ("google", "google_search", "google_display", "youtube", "google_ads"):
        return "google_ads"
    return "meta"  # default conservador


def campaign_launcher(
    canal: str,
    copy: dict,
    targeting: dict,
    budget: float,
    duracion_dias: int,
    platform: str | None = None,
    resolver=None,
) -> dict:
    platform = platform or _infer_platform(canal)
    if platform not in supported_platforms():
        _log.warning("Plataforma desconocida %r — fallback a mock", platform)
        return _launch_mock(canal, copy, targeting, budget, duracion_dias, platform)

    resolver = resolver or get_default_resolver()
    creds = resolver.resolve(platform)
    if creds is None:
        _log.info("Sin credenciales para %s — usando mock calculado", platform)
        return _launch_mock(canal, copy, targeting, budget, duracion_dias, platform)

    spec = CampaignSpec(
        name=f"[Adkio] {copy.get('headline', 'Campaña')[:60]}",
        objective=_PLATFORM_OBJECTIVE.get(platform, "OUTCOME_LEADS"),
        budget_usd=float(budget),
        duration_days=int(duracion_dias),
        copy=copy,
        targeting=targeting,
    )

    adapter = get_adapter(platform)
    try:
        result = adapter.create_campaign(creds, spec)
    except AdapterError as exc:
        _log.warning("Adapter %s falló — fallback a mock: %s", platform, exc)
        return _launch_mock(canal, copy, targeting, budget, duracion_dias, platform)

    reach = _calculate_reach(targeting, budget)
    expected_leads = max(1, int(budget / _CPL_BENCHMARK_LATAM_EDU))
    return {
        "campaign_id": result.campaign_id,
        "status": result.status,
        "platform": platform,
        "estimated_reach": f"{reach // 1000}K–{(reach * 2) // 1000}K personas",
        "preview_url": result.preview_url,
        "rationale": result.rationale,
        "kpis": {
            "expected_leads": expected_leads,
            "cpl_usd": _CPL_BENCHMARK_LATAM_EDU,
            "total_budget_usd": budget,
            "daily_budget_usd": round(budget / max(duracion_dias, 1), 2),
            "duration_days": duracion_dias,
        },
        "next_steps": _next_steps_for(platform, result.status),
    }


def _next_steps_for(platform: str, status: str) -> list[str]:
    base_review = {
        "meta": "Revisar la campaña en Meta Ads Manager y activarla cuando esté ok",
        "tiktok": "Revisar y activar la campaña desde TikTok Ads Manager",
        "google_ads": "Revisar ad groups + keywords antes de activar en Google Ads",
    }
    monitor = {
        "meta": "Monitorear las primeras 48h — fase de aprendizaje de Meta (~50 conversiones/semana por AdSet)",
        "tiktok": "Monitorear las primeras 24h — TikTok tiene fase corta de aprendizaje",
        "google_ads": "Monitorear Quality Score y CPC en los primeros 3 días",
    }
    refresh_threshold = {
        "meta": f"Refrescar copy si el CPL supera ${_CPL_BENCHMARK_LATAM_EDU + 6:.0f} USD",
        "tiktok": "Rotar creativos cada 5-7 días (TikTok favorece variedad)",
        "google_ads": "Pausar keywords con CTR < 1% después de 100 impresiones",
    }
    return [
        base_review.get(platform, "Revisar y activar la campaña"),
        monitor.get(platform, "Monitorear las primeras 48h"),
        refresh_threshold.get(platform, "Iterar copy según performance"),
    ]


def _launch_mock(
    canal: str,
    copy: dict,
    targeting: dict,
    budget: float,
    duracion_dias: int,
    platform: str,
) -> dict:
    if platform == "meta":
        # Compat con flujo legacy: id formato act_<account>_<ts>
        import os
        ad_account_id = os.environ.get("META_AD_ACCOUNT_ID", "act_demo")
        clean_id = ad_account_id.replace("act_", "")
        campaign_id = f"act_{clean_id}_{int(time.time())}"
    else:
        campaign_id = f"{platform}_mock_{int(time.time())}"
    reach = _calculate_reach(targeting, budget)
    expected_leads = max(1, int(budget / _CPL_BENCHMARK_LATAM_EDU))

    return {
        "campaign_id": campaign_id,
        "status": "PAUSED",
        "platform": platform,
        "estimated_reach": f"{reach // 1000}K–{(reach * 2) // 1000}K personas",
        "preview_url": None,
        "rationale": (
            f"Mock de {platform}: la plataforma no está conectada o el SDK falló. "
            f"En producción este paso lanza la campaña real en estado PAUSED."
        ),
        "kpis": {
            "expected_leads": expected_leads,
            "cpl_usd": _CPL_BENCHMARK_LATAM_EDU,
            "total_budget_usd": budget,
            "daily_budget_usd": round(budget / max(duracion_dias, 1), 2),
            "duration_days": duracion_dias,
        },
        "next_steps": _next_steps_for(platform, "PAUSED"),
    }


def _calculate_reach(targeting: dict, budget_usd: float) -> int:
    tamano = targeting.get("tamano_estimado", 500_000)
    reach = int(tamano * (budget_usd / _CPL_BENCHMARK_LATAM_EDU))
    return max(1_000, min(reach, tamano))
