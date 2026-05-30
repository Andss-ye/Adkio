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

# CPL benchmark fallback (USD) — solo si no podemos calcular dinámicamente
_CPL_BENCHMARK_DEFAULT = 15.0


_PLATFORM_OBJECTIVE: dict[str, str] = {
    "meta": "OUTCOME_LEADS",
    "tiktok": "OUTCOME_LEADS",
    "google_ads": "OUTCOME_LEADS",
}


# ── CPL dinámico ───────────────────────────────────────────────────────────
# Multiplicadores construidos con benchmarks públicos (Meta Business, WordStream,
# AdEspresso, LATAM-specific reports). NO son valores garantizados pero dan un
# rango realista que cambia según plataforma + país + perfil de audiencia.

# Base CPL por plataforma (USD) — punto medio del rango típico LATAM B2C
_CPL_BASE: dict[str, float] = {
    "meta": 12.0,       # Meta Ads: $8-20 típico LATAM
    "tiktok": 6.5,      # TikTok: $4-12, audiencia más joven y barata
    "google_ads": 22.0, # Google Search: $15-35, intención alta = más caro
}

# Multiplicador por país (USA es base 1.0, LATAM cuesta menos)
_COUNTRY_COST_INDEX: dict[str, float] = {
    "US": 1.00, "CA": 0.92, "GB": 0.95, "AU": 0.95,
    "MX": 0.55, "CO": 0.45, "AR": 0.40, "PE": 0.45,
    "CL": 0.55, "BR": 0.50, "EC": 0.42, "UY": 0.55, "BO": 0.40,
    "ES": 0.75, "DE": 0.85, "FR": 0.85, "IT": 0.75,
}

# Coeficiente por perfil de audiencia (edad mínima → señal de B2B vs B2C)
def _audience_multiplier(edad_min: int, edad_max: int) -> float:
    avg = (edad_min + edad_max) / 2
    if avg < 28:
        return 0.7  # joven, más barato (más volumen)
    if avg > 45:
        return 1.6  # decisores/ejecutivos, lead más caro
    return 1.0


# Coeficiente por intent del objetivo (heurística por keywords)
def _intent_multiplier(objetivo: str) -> float:
    text = (objetivo or "").lower()
    high_intent = ["b2b", "founder", "ceo", "cfo", "ejecutiv", "enterprise", "saas"]
    low_intent = ["awareness", "branding", "alcance", "video views", "engagement"]
    if any(k in text for k in high_intent):
        return 1.7
    if any(k in text for k in low_intent):
        return 0.5
    return 1.0


def estimate_cpl_range(
    platform: str,
    targeting: dict,
    objetivo: str = "",
) -> tuple[float, float]:
    """Devuelve (cpl_min, cpl_max) en USD basado en plataforma + países + audiencia.

    No es un modelo predictivo real — es una heurística que da un rango plausible
    y, sobre todo, **distinto por contexto** (no más $8-25 universal).
    """
    base = _CPL_BASE.get(platform, _CPL_BENCHMARK_DEFAULT)

    paises = targeting.get("paises") or []
    if paises:
        country_factor = sum(_COUNTRY_COST_INDEX.get(p, 0.6) for p in paises) / len(paises)
    else:
        country_factor = 0.6

    edad_min = int(targeting.get("edad_min") or 25)
    edad_max = int(targeting.get("edad_max") or 55)
    aud_factor = _audience_multiplier(edad_min, edad_max)

    intent_factor = _intent_multiplier(objetivo)

    cpl_center = base * country_factor * aud_factor * intent_factor
    # Banda del ±35% alrededor del centro — refleja incertidumbre real
    return (round(cpl_center * 0.70, 2), round(cpl_center * 1.35, 2))


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

    objetivo = (targeting.get("objetivo") or "") + " " + (copy.get("headline") or "")
    cpl_min, cpl_max = estimate_cpl_range(platform, targeting, objetivo)
    cpl_mid = round((cpl_min + cpl_max) / 2, 2)
    reach = _calculate_reach(targeting, budget, cpl_mid)
    expected_leads = max(1, int(budget / cpl_mid))
    return {
        "campaign_id": result.campaign_id,
        "status": result.status,
        "platform": platform,
        "is_mock": False,
        "estimated_reach": f"{reach // 1000}K–{(reach * 2) // 1000}K personas",
        "preview_url": result.preview_url,
        "rationale": result.rationale,
        "kpis": {
            "expected_leads": expected_leads,
            "cpl_usd": cpl_mid,
            "cpl_min_usd": cpl_min,
            "cpl_max_usd": cpl_max,
            "total_budget_usd": budget,
            "daily_budget_usd": round(budget / max(duracion_dias, 1), 2),
            "duration_days": duracion_dias,
        },
        "next_steps": _next_steps_for(platform, result.status, cpl_max),
    }


def _next_steps_for(platform: str, status: str, cpl_max: float = 25.0) -> list[str]:
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
        "meta": f"Refrescar copy si el CPL supera ${cpl_max:.0f} USD",
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
        import os
        ad_account_id = os.environ.get("META_AD_ACCOUNT_ID", "act_demo")
        clean_id = ad_account_id.replace("act_", "")
        campaign_id = f"act_demo_{clean_id}_{int(time.time())}"
    else:
        campaign_id = f"{platform}_demo_{int(time.time())}"

    objetivo = (targeting.get("objetivo") or "") + " " + (copy.get("headline") or "")
    cpl_min, cpl_max = estimate_cpl_range(platform, targeting, objetivo)
    cpl_mid = round((cpl_min + cpl_max) / 2, 2)
    reach = _calculate_reach(targeting, budget, cpl_mid)
    expected_leads = max(1, int(budget / cpl_mid))

    return {
        "campaign_id": campaign_id,
        "status": "PAUSED",
        "platform": platform,
        "is_mock": True,
        "estimated_reach": f"{reach // 1000}K–{(reach * 2) // 1000}K personas",
        "preview_url": None,
        "rationale": (
            f"Mock de {platform}: la plataforma no está conectada o el SDK falló. "
            f"En producción este paso lanza la campaña real en estado PAUSED."
        ),
        "kpis": {
            "expected_leads": expected_leads,
            "cpl_usd": cpl_mid,
            "cpl_min_usd": cpl_min,
            "cpl_max_usd": cpl_max,
            "total_budget_usd": budget,
            "daily_budget_usd": round(budget / max(duracion_dias, 1), 2),
            "duration_days": duracion_dias,
        },
        "next_steps": _next_steps_for(platform, "PAUSED", cpl_max),
    }


def _calculate_reach(targeting: dict, budget_usd: float, cpl_mid: float = _CPL_BENCHMARK_DEFAULT) -> int:
    tamano = targeting.get("tamano_estimado", 500_000)
    reach = int(tamano * (budget_usd / cpl_mid))
    return max(1_000, min(reach, tamano))
