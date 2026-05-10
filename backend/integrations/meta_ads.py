"""
Meta Ads Marketing API integration (Objetivo C — Adkio).

Funciones públicas (consumidas por backend/tools/campaign_launcher.py):
    create_campaign(name, objective, budget_cents, ad_account_id) -> str
    create_ad_set(campaign_id, targeting, budget_cents, start_time, end_time) -> str
    create_ad(adset_id, copy, creative_spec) -> str
    get_campaign_status(campaign_id) -> dict

Variables de entorno aceptadas (con o sin prefijo ``META_``):
    META_APP_ID         / APP_ID
    META_APP_SECRET     / APP_SECRET
    META_ACCESS_TOKEN   / ACCESS_TOKEN
    META_AD_ACCOUNT_ID  / AD_ACCOUNT_ID
    META_PAGE_ID        / PAGE_ID

Decisiones de diseño:
- Todos los objetos se crean con ``status=PAUSED``. Adkio usa Human-in-the-Loop:
  el operador confirma manualmente desde Meta Ads Manager antes de publicar.
- Si la cuenta no tiene método de pago configurado (Meta error code 100), la
  creación del ``Ad`` falla pero el ``AdCreative`` ya quedó persistido. En ese
  caso devolvemos ``creative_id`` como fallback para que el flujo del agente
  pueda continuar y el usuario aún vea su campaña en el Ads Manager.
- ``targeting`` acepta el schema en español del ``audience_analyzer``
  (``paises``, ``edad_min``, ``edad_max``, ``intereses``, ``exclusiones``)
  y lo traduce al schema oficial de Meta.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from facebook_business.adobjects.ad import Ad
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.adcreative import AdCreative
from facebook_business.adobjects.adset import AdSet
from facebook_business.adobjects.campaign import Campaign
from facebook_business.adobjects.targetingsearch import TargetingSearch
from facebook_business.api import FacebookAdsApi
from facebook_business.exceptions import FacebookRequestError

logger = logging.getLogger(__name__)


# ── Env helpers (aceptan ambos esquemas de naming) ─────────────────────────


def _env(*names: str) -> Optional[str]:
    for n in names:
        v = os.environ.get(n)
        if v:
            return v.strip().strip("'").strip('"')
    return None


def _meta_app_id() -> Optional[str]:
    return _env("META_APP_ID", "APP_ID")


def _meta_app_secret() -> Optional[str]:
    return _env("META_APP_SECRET", "APP_SECRET")


def _meta_access_token() -> Optional[str]:
    return _env("META_ACCESS_TOKEN", "ACCESS_TOKEN")


def _meta_page_id() -> Optional[str]:
    return _env("META_PAGE_ID", "PAGE_ID")


def _meta_ad_account_id() -> Optional[str]:
    raw = _env("META_AD_ACCOUNT_ID", "AD_ACCOUNT_ID")
    if not raw:
        return None
    return raw if raw.startswith("act_") else f"act_{raw}"


# ── SDK init (lazy + idempotente) ──────────────────────────────────────────


_sdk_initialized = False


def _init_sdk() -> None:
    global _sdk_initialized
    if _sdk_initialized:
        return

    app_id = _meta_app_id()
    access_token = _meta_access_token()
    if not (app_id and access_token):
        raise RuntimeError(
            "Meta SDK no inicializable: faltan META_APP_ID/APP_ID o "
            "META_ACCESS_TOKEN/ACCESS_TOKEN en el .env"
        )

    FacebookAdsApi.init(
        app_id=app_id,
        app_secret=_meta_app_secret() or "",
        access_token=access_token,
    )
    _sdk_initialized = True


def _account(ad_account_id: Optional[str] = None) -> AdAccount:
    _init_sdk()

    aid = ad_account_id
    # ``act_demo`` es el sentinel default del campaign_launcher cuando
    # META_AD_ACCOUNT_ID no está seteado. Resolvemos desde env en su lugar.
    if not aid or aid in ("act_demo", "act_"):
        aid = _meta_ad_account_id()

    if not aid:
        raise RuntimeError(
            "Ad Account ID no resolvible: define META_AD_ACCOUNT_ID o "
            "AD_ACCOUNT_ID en el .env"
        )
    if not aid.startswith("act_"):
        aid = f"act_{aid}"

    return AdAccount(aid)


# ── Helpers de targeting ───────────────────────────────────────────────────


# Mapeo LATAM-first. Si el valor ya parece código ISO se pasa tal cual.
_COUNTRY_NAME_TO_ISO: dict[str, str] = {
    "colombia": "CO",
    "mexico": "MX",
    "méxico": "MX",
    "peru": "PE",
    "perú": "PE",
    "argentina": "AR",
    "chile": "CL",
    "brazil": "BR",
    "brasil": "BR",
    "uruguay": "UY",
    "ecuador": "EC",
    "bolivia": "BO",
    "paraguay": "PY",
    "venezuela": "VE",
    "spain": "ES",
    "españa": "ES",
    "espana": "ES",
    "united states": "US",
    "usa": "US",
    "estados unidos": "US",
    "panama": "PA",
    "panamá": "PA",
    "costa rica": "CR",
    "guatemala": "GT",
    "honduras": "HN",
    "nicaragua": "NI",
    "el salvador": "SV",
    "republica dominicana": "DO",
    "república dominicana": "DO",
    "dominican republic": "DO",
    "puerto rico": "PR",
    "cuba": "CU",
}


def _to_country_codes(names: list) -> list[str]:
    out: list[str] = []
    for raw in names or []:
        if not raw:
            continue
        s = str(raw).strip()
        if len(s) == 2 and s.isalpha():
            out.append(s.upper())
            continue
        iso = _COUNTRY_NAME_TO_ISO.get(s.lower())
        if iso:
            out.append(iso)
        else:
            logger.warning("País sin mapeo ISO: '%s' — se ignora", raw)
    return out


def _resolve_interests(queries: list) -> list[dict]:
    if not queries:
        return []
    # TargetingSearch necesita el SDK inicializado aunque no pase por _account().
    _init_sdk()
    resolved: list[dict] = []
    for q in queries:
        if not q:
            continue
        try:
            results = TargetingSearch.search(
                params={"q": str(q), "type": "adinterest"}
            )
            if results:
                top = results[0]
                resolved.append({"id": top["id"], "name": top["name"]})
        except FacebookRequestError as e:
            logger.warning(
                "TargetingSearch falló para '%s': %s", q, e.api_error_message()
            )
    return resolved


def _build_meta_targeting(targeting: dict) -> dict:
    """
    Traduce el output del ``audience_analyzer`` (keys en español)
    al schema de targeting de Meta. Si ya viene en formato Meta lo respeta.
    """
    if "geo_locations" in targeting and "age_min" in targeting:
        # Ya viene en formato Meta — devolver una copia defensiva.
        meta = dict(targeting)
        meta.setdefault("targeting_automation", {"advantage_audience": 0})
        return meta

    countries = _to_country_codes(
        targeting.get("paises") or targeting.get("countries") or []
    )
    age_min_raw = targeting.get("edad_min") or targeting.get("age_min") or 18
    age_max_raw = targeting.get("edad_max") or targeting.get("age_max") or 65

    meta: dict = {
        "geo_locations": {"countries": countries or ["CO"]},
        "age_min": max(13, int(age_min_raw)),
        "age_max": min(65, int(age_max_raw)),
        # Targeting manual — Adkio decide la audiencia, no la IA de Meta.
        "targeting_automation": {"advantage_audience": 0},
    }

    interest_queries = (
        targeting.get("intereses") or targeting.get("interests") or []
    )
    interests = _resolve_interests(interest_queries)
    if interests:
        meta["interests"] = interests

    # Meta API v25 (junio 2024) deprecó las "detailed targeting exclusions"
    # a nivel de AdSet (subcode 3858492). El audience_analyzer puede seguir
    # produciendo `exclusiones` por backwards-compat con el plan, pero no
    # las enviamos a Meta. Se loguea para visibilidad.
    exclusion_queries = (
        targeting.get("exclusiones") or targeting.get("exclusions") or []
    )
    if exclusion_queries:
        logger.info(
            "Ignorando %d exclusion(es) de targeting: Meta v25 ya no las acepta a nivel de AdSet",
            len(exclusion_queries),
        )

    return meta


# ── Public API ─────────────────────────────────────────────────────────────


# OUTCOME_LEADS es el objetivo principal de Adkio. Si no está disponible para
# la cuenta (típico en algunas verticales reguladas) caemos a OUTCOME_TRAFFIC.
_OBJECTIVE_FALLBACKS: dict[str, list[str]] = {
    "OUTCOME_LEADS": ["OUTCOME_LEADS", "OUTCOME_TRAFFIC"],
    "OUTCOME_TRAFFIC": ["OUTCOME_TRAFFIC"],
    "OUTCOME_AWARENESS": ["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC"],
    "OUTCOME_ENGAGEMENT": ["OUTCOME_ENGAGEMENT", "OUTCOME_TRAFFIC"],
    "OUTCOME_SALES": ["OUTCOME_SALES", "OUTCOME_TRAFFIC"],
    "OUTCOME_APP_PROMOTION": ["OUTCOME_APP_PROMOTION", "OUTCOME_TRAFFIC"],
}


def create_campaign(
    name: str,
    objective: str,
    budget_cents: int,  # noqa: ARG001 — reservado: presupuesto va en el ad set
    ad_account_id: Optional[str] = None,
) -> str:
    """
    Crea una Campaign en estado PAUSED. Devuelve ``campaign_id``.

    El parámetro ``budget_cents`` se acepta por compat con el contrato del
    schema de Adkio pero no se aplica al nivel de campaña: con
    ``is_adset_budget_sharing_enabled=False`` el presupuesto vive en el AdSet.
    """
    account = _account(ad_account_id)
    candidates = _OBJECTIVE_FALLBACKS.get(
        (objective or "OUTCOME_LEADS").upper(),
        [(objective or "OUTCOME_LEADS").upper(), "OUTCOME_TRAFFIC"],
    )

    last_err: Optional[FacebookRequestError] = None
    for obj in candidates:
        try:
            campaign = account.create_campaign(
                params={
                    "name": name or "Adkio Campaign",
                    "objective": obj,
                    "status": "PAUSED",
                    "buying_type": "AUCTION",
                    "special_ad_categories": [],
                    "is_adset_budget_sharing_enabled": False,
                }
            )
            return str(campaign["id"])
        except FacebookRequestError as e:
            last_err = e
            logger.warning(
                "create_campaign falló con objective=%s: %s",
                obj,
                e.api_error_message(),
            )

    assert last_err is not None
    raise last_err


def create_ad_set(
    campaign_id: str,
    targeting: dict,
    budget_cents: int,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> str:
    """
    Crea un AdSet en estado PAUSED dentro de la Campaign. Devuelve ``adset_id``.

    - ``targeting`` acepta el schema del ``audience_analyzer`` (español)
      o un dict ya en formato Meta.
    - ``budget_cents`` es el presupuesto diario en unidades menores de la
      moneda de la ad account (ej: USD cents, COP cents).
    - ``start_time`` / ``end_time`` deben venir en ISO 8601 con offset
      (``YYYY-MM-DDTHH:MM:SS+0000``). Si vienen ``None`` se default a una
      ventana de 7 días empezando mañana.
    """
    account = _account()

    now = datetime.now(timezone.utc)
    start = start_time or (now + timedelta(days=1)).strftime(
        "%Y-%m-%dT%H:%M:%S+0000"
    )
    end = end_time or (now + timedelta(days=8)).strftime(
        "%Y-%m-%dT%H:%M:%S+0000"
    )

    meta_targeting = _build_meta_targeting(targeting)
    page_id = _meta_page_id()

    params: dict = {
        "name": targeting.get("nombre_adset") or "Adkio AdSet",
        "campaign_id": campaign_id,
        # Meta exige >=1 — si llega 0 forzamos el mínimo para no romper.
        "daily_budget": max(int(budget_cents), 1),
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "LEAD_GENERATION",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "start_time": start,
        "end_time": end,
        "targeting": meta_targeting,
        "status": "PAUSED",
    }

    if page_id:
        params["promoted_object"] = {"page_id": page_id}

    adset = account.create_ad_set(params=params)
    return str(adset["id"])


def create_ad(
    adset_id: str,
    copy: dict,
    creative_spec: Optional[dict] = None,
) -> str:
    """
    Crea un AdCreative + Ad en estado PAUSED. Devuelve ``ad_id``.

    Si la cuenta no tiene método de pago (Meta error code 100), la creación
    del Ad falla pero el AdCreative ya está persistido — en ese caso
    devolvemos ``creative_id`` como fallback. Esto mantiene el flujo del
    agente operativo y permite al usuario ver la campaña real en Ads Manager.
    """
    account = _account()
    page_id = _meta_page_id()
    if not page_id:
        raise RuntimeError(
            "META_PAGE_ID / PAGE_ID no configurado en .env — necesario para crear el creative"
        )

    spec = creative_spec or {}
    headline = (copy.get("headline") or "Adkio").strip()
    body = (copy.get("body") or "").strip()
    cta_raw = (copy.get("cta") or "LEARN_MORE").strip()
    # Meta espera el CTA como enum (LEARN_MORE, SIGN_UP, ...). Si el LLM
    # generó texto en español ("Reserva tu lugar"), default a LEARN_MORE.
    cta = (
        cta_raw.upper().replace(" ", "_")
        if cta_raw.replace(" ", "").isascii() and len(cta_raw) <= 30
        else "LEARN_MORE"
    )

    link_url = (
        spec.get("link") or copy.get("link") or "https://adkio.com"
    )
    description = spec.get("description") or copy.get("description") or ""

    object_story_spec: dict = {
        "page_id": page_id,
        "link_data": {
            "link": link_url,
            "message": body,
            "name": headline,
            "description": description,
            "call_to_action": {"type": cta, "value": {"link": link_url}},
        },
    }

    image_url = spec.get("image_url") or spec.get("picture")
    if image_url:
        object_story_spec["link_data"]["picture"] = image_url

    creative = account.create_ad_creative(
        params={
            "name": f"[Adkio] {headline[:40]}",
            "object_story_spec": object_story_spec,
        }
    )
    creative_id = str(creative["id"])

    try:
        ad = account.create_ad(
            params={
                "name": f"[Adkio] {headline[:40]}",
                "adset_id": adset_id,
                "creative": {"creative_id": creative_id},
                "status": "PAUSED",
            }
        )
        return str(ad["id"])
    except FacebookRequestError as e:
        logger.warning(
            "create_ad falló (code=%s subcode=%s): %s",
            e.api_error_code(),
            e.api_error_subcode(),
            e.api_error_message(),
        )
        # 100 / subcode 1359188 = "ad account sin método de pago".
        # Devolvemos creative_id para no perder el trabajo ya hecho.
        if e.api_error_code() == 100:
            logger.warning(
                "Devolviendo creative_id=%s como fallback (cuenta sin método de pago)",
                creative_id,
            )
            return creative_id
        raise


def get_campaign_status(campaign_id: str) -> dict:
    """
    Lee el estado vivo de una Campaign desde Meta + insights agregados.

    Devuelve:
        {
            "campaign_id": str,
            "name": str,
            "status": str,        # ACTIVE | PAUSED | DELETED | ...
            "objective": str,
            "reach": int,
            "impressions": int,
            "spend": float,
        }

    Si la API falla devuelve un dict con ``status="UNKNOWN"`` y el mensaje
    de error en ``error`` — el caller decide qué hacer.
    """
    _init_sdk()
    try:
        camp = Campaign(campaign_id).api_get(
            fields=["name", "status", "objective"]
        )
        try:
            insights_list = Campaign(campaign_id).get_insights(
                fields=["reach", "impressions", "spend"]
            )
            ins = dict(insights_list[0]) if insights_list else {}
        except FacebookRequestError:
            # Insights pueden no existir todavía si la campaña está PAUSED.
            ins = {}

        return {
            "campaign_id": campaign_id,
            "name": camp.get("name"),
            "status": camp.get("status"),
            "objective": camp.get("objective"),
            "reach": int(ins.get("reach", 0) or 0),
            "impressions": int(ins.get("impressions", 0) or 0),
            "spend": float(ins.get("spend", 0) or 0),
        }
    except FacebookRequestError as e:
        logger.warning(
            "get_campaign_status falló para %s: %s",
            campaign_id,
            e.api_error_message(),
        )
        return {
            "campaign_id": campaign_id,
            "status": "UNKNOWN",
            "name": None,
            "objective": None,
            "reach": 0,
            "impressions": 0,
            "spend": 0.0,
            "error": e.api_error_message(),
        }


__all__ = [
    "create_campaign",
    "create_ad_set",
    "create_ad",
    "get_campaign_status",
]
