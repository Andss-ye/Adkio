"""
Adapter de Meta Ads — implementa `PlatformAdapter` con cadena completa
Campaign → AdSet → Ad usando facebook-business SDK.

Diseño:
- Recibe `MetaCreds` por parámetro: cero lectura de env desde acá.
- Inicializa el SDK por request con `FacebookAdsApi.init(...)`. La inicialización
  es global del SDK (limitación de la lib), así que el adapter NO es thread-safe
  para múltiples accounts simultáneos. Para multitenant alta concurrencia,
  Freddy va a necesitar un pool de FacebookAdsApi sessions — ver
  `docs/HANDOFF_MULTITENANT.md`.
- Todos los recursos se crean con `status=PAUSED` (HITL).
- `create_campaign` hace la cadena completa Campaign → AdSet → Ad y devuelve
  el campaign_id como handle principal (con adset_id y ad_id en `raw`).
- `delete_campaign` hace hard-delete real via `Campaign(id).api_delete()`.
- Si la cuenta no tiene método de pago (Meta error 100), `create_ad` cae
  graciosamente al `creative_id` para que el usuario igual vea el trabajo
  en Ads Manager.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from backend.integrations.base import (
    AdapterError,
    CampaignSpec,
    CampaignStatus,
    CreateResult,
    DeleteResult,
)
from backend.integrations.credentials import MetaCreds

logger = logging.getLogger(__name__)


_OBJECTIVE_FALLBACKS: dict[str, list[str]] = {
    "OUTCOME_LEADS": ["OUTCOME_LEADS", "OUTCOME_TRAFFIC"],
    "OUTCOME_TRAFFIC": ["OUTCOME_TRAFFIC"],
    "OUTCOME_AWARENESS": ["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC"],
    "OUTCOME_ENGAGEMENT": ["OUTCOME_ENGAGEMENT", "OUTCOME_TRAFFIC"],
    "OUTCOME_SALES": ["OUTCOME_SALES", "OUTCOME_TRAFFIC"],
    "OUTCOME_APP_PROMOTION": ["OUTCOME_APP_PROMOTION", "OUTCOME_TRAFFIC"],
}


# Mapeo LATAM-first país → ISO. Si el valor ya parece ISO se pasa tal cual.
_COUNTRY_NAME_TO_ISO: dict[str, str] = {
    "colombia": "CO", "mexico": "MX", "méxico": "MX",
    "peru": "PE", "perú": "PE", "argentina": "AR", "chile": "CL",
    "brazil": "BR", "brasil": "BR", "uruguay": "UY", "ecuador": "EC",
    "bolivia": "BO", "paraguay": "PY", "venezuela": "VE",
    "spain": "ES", "españa": "ES", "espana": "ES",
    "united states": "US", "usa": "US", "estados unidos": "US",
    "panama": "PA", "panamá": "PA", "costa rica": "CR",
    "guatemala": "GT", "honduras": "HN", "nicaragua": "NI",
    "el salvador": "SV", "republica dominicana": "DO",
    "república dominicana": "DO", "dominican republic": "DO",
    "puerto rico": "PR", "cuba": "CU",
}


class MetaAdapter:
    platform = "meta"

    def __init__(self, sdk_module=None):
        # Inyectable para tests. En producción se importa el SDK real lazily.
        self._sdk = sdk_module

    # ── SDK bootstrap ──────────────────────────────────────────────────────

    def _ensure_sdk(self):
        if self._sdk is not None:
            return self._sdk
        try:
            from facebook_business.adobjects.adaccount import AdAccount
            from facebook_business.adobjects.campaign import Campaign
            from facebook_business.adobjects.targetingsearch import TargetingSearch
            from facebook_business.api import FacebookAdsApi
            from facebook_business.exceptions import FacebookRequestError
        except ImportError as exc:
            raise AdapterError(
                self.platform,
                f"facebook-business SDK no instalado: {exc}",
            ) from exc

        class _SDK:
            def __init__(self):
                self.AdAccount = AdAccount
                self.Campaign = Campaign
                self.TargetingSearch = TargetingSearch
                self.FacebookAdsApi = FacebookAdsApi
                self.FacebookRequestError = FacebookRequestError

        self._sdk = _SDK()
        return self._sdk

    def _init_api(self, creds: MetaCreds):
        missing = creds.validate()
        if missing:
            raise AdapterError(
                self.platform,
                f"credenciales incompletas: faltan {', '.join(missing)}",
            )
        sdk = self._ensure_sdk()
        sdk.FacebookAdsApi.init(
            app_id=creds.app_id,
            app_secret=creds.app_secret or "",
            access_token=creds.access_token,
        )
        return sdk

    # ── Targeting helpers ──────────────────────────────────────────────────

    @staticmethod
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
                logger.warning("País sin mapeo ISO: %r — se ignora", raw)
        return out

    def _resolve_interests(self, sdk, queries: list) -> list[dict]:
        """Traduce nombres de intereses a IDs vía TargetingSearch. Si falla
        cualquier query la salta — los intereses son opcionales."""
        if not queries:
            return []
        resolved: list[dict] = []
        for q in queries:
            if not q:
                continue
            try:
                results = sdk.TargetingSearch.search(
                    params={"q": str(q), "type": "adinterest"}
                )
                if results:
                    top = results[0]
                    resolved.append({"id": top["id"], "name": top["name"]})
            except sdk.FacebookRequestError as e:
                logger.warning(
                    "TargetingSearch falló para %r: %s", q, e.api_error_message()
                )
            except Exception as e:  # noqa: BLE001 — SDK puede tirar cosas raras
                logger.warning("TargetingSearch error inesperado para %r: %s", q, e)
        return resolved

    def _build_meta_targeting(self, sdk, targeting: dict) -> dict:
        """Traduce el output del `audience_analyzer` (keys en español) al
        schema de Meta. Si ya viene en formato Meta lo respeta."""
        if "geo_locations" in targeting and "age_min" in targeting:
            meta = dict(targeting)
            meta.setdefault("targeting_automation", {"advantage_audience": 0})
            return meta

        countries = self._to_country_codes(
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
        interests = self._resolve_interests(sdk, interest_queries)
        if interests:
            meta["interests"] = interests

        # Meta v25 (jun 2024) deprecó exclusions detalladas a nivel AdSet.
        exclusion_queries = (
            targeting.get("exclusiones") or targeting.get("exclusions") or []
        )
        if exclusion_queries:
            logger.info(
                "Ignorando %d exclusion(es): Meta v25 ya no las acepta a nivel AdSet",
                len(exclusion_queries),
            )

        return meta

    # ── Campaign hierarchy (interno) ───────────────────────────────────────

    def _create_meta_campaign(self, sdk, account, name: str, objective: str) -> tuple[str, str]:
        """Devuelve (campaign_id, objective_used) con fallback de objective."""
        candidates = _OBJECTIVE_FALLBACKS.get(
            objective.upper(), [objective.upper(), "OUTCOME_TRAFFIC"]
        )
        last_err = None
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
                return (str(campaign["id"]), obj)
            except sdk.FacebookRequestError as e:
                last_err = e
                logger.warning(
                    "create_campaign falló con objective=%s: %s", obj, e.api_error_message()
                )
        raise AdapterError(
            self.platform,
            f"Meta rechazó la creación de campaign: {last_err.api_error_message() if last_err else 'desconocido'}",
        )

    def _create_meta_ad_set(
        self,
        sdk,
        account,
        campaign_id: str,
        targeting: dict,
        daily_budget_cents: int,
        page_id: Optional[str],
        duration_days: int,
    ) -> str:
        now = datetime.now(timezone.utc)
        start = (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S+0000")
        end = (now + timedelta(days=1 + max(duration_days, 1))).strftime(
            "%Y-%m-%dT%H:%M:%S+0000"
        )
        meta_targeting = self._build_meta_targeting(sdk, targeting)

        params: dict = {
            "name": targeting.get("nombre_adset") or "Adkio AdSet",
            "campaign_id": campaign_id,
            "daily_budget": max(int(daily_budget_cents), 1),
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

    def _create_meta_ad(
        self,
        sdk,
        account,
        adset_id: str,
        copy: dict,
        creative_spec: dict,
        page_id: str,
    ) -> tuple[str, bool]:
        """Devuelve (ad_id_or_creative_id, fell_back_to_creative).
        Si la cuenta no tiene método de pago (code 100), devuelve creative_id."""
        headline = (copy.get("headline") or "Adkio").strip()
        body = (copy.get("body") or "").strip()
        cta_raw = (copy.get("cta") or "LEARN_MORE").strip()
        cta = (
            cta_raw.upper().replace(" ", "_")
            if cta_raw.replace(" ", "").isascii() and len(cta_raw) <= 30
            else "LEARN_MORE"
        )

        link_url = creative_spec.get("link") or copy.get("link") or "https://adkio.com"
        description = creative_spec.get("description") or copy.get("description") or ""

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
        image_url = creative_spec.get("image_url") or creative_spec.get("picture")
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
            return (str(ad["id"]), False)
        except sdk.FacebookRequestError as e:
            logger.warning(
                "create_ad falló (code=%s subcode=%s): %s",
                e.api_error_code(),
                e.api_error_subcode(),
                e.api_error_message(),
            )
            # Code 100 / subcode 1359188 = cuenta sin método de pago.
            if e.api_error_code() == 100:
                logger.warning(
                    "Fallback a creative_id=%s (cuenta sin método de pago)",
                    creative_id,
                )
                return (creative_id, True)
            raise

    # ── Protocol API ───────────────────────────────────────────────────────

    def create_campaign(self, credentials: MetaCreds, spec: CampaignSpec) -> CreateResult:
        sdk = self._init_api(credentials)
        account = sdk.AdAccount(credentials.normalized_ad_account_id)

        # 1) Campaign
        campaign_id, objective_used = self._create_meta_campaign(
            sdk,
            account,
            name=spec.name,
            objective=(spec.objective or "OUTCOME_LEADS"),
        )

        # 2) AdSet — solo si hay page_id (requerido por promoted_object/creative)
        adset_id: Optional[str] = None
        ad_id: Optional[str] = None
        creative_fallback = False

        if credentials.page_id and spec.budget_usd > 0:
            daily_usd = max(spec.budget_usd / max(spec.duration_days, 1), 1.0)
            daily_cents = int(daily_usd * 100)
            try:
                adset_id = self._create_meta_ad_set(
                    sdk,
                    account,
                    campaign_id=campaign_id,
                    targeting=spec.targeting,
                    daily_budget_cents=daily_cents,
                    page_id=credentials.page_id,
                    duration_days=spec.duration_days,
                )

                # 3) Ad + AdCreative
                ad_id, creative_fallback = self._create_meta_ad(
                    sdk,
                    account,
                    adset_id=adset_id,
                    copy=spec.copy,
                    creative_spec=spec.creative_spec,
                    page_id=credentials.page_id,
                )
            except sdk.FacebookRequestError as e:
                logger.warning(
                    "Cadena AdSet/Ad parcial — campaign existe pero falló %s",
                    e.api_error_message(),
                )

        # Rationale conciso según qué se logró crear.
        rationale_parts = [
            f"Campaña creada en Meta con objetivo {objective_used}, en PAUSED."
        ]
        if adset_id and ad_id and not creative_fallback:
            rationale_parts.append(
                "AdSet + Ad creados con targeting y copy aplicados. "
                "El usuario revisa y activa desde Ads Manager."
            )
        elif adset_id and creative_fallback:
            rationale_parts.append(
                "AdSet + Creative creados; el Ad no se publicó porque la cuenta "
                "no tiene método de pago. El usuario debe agregarlo en Ads Manager."
            )
        elif adset_id and not ad_id:
            rationale_parts.append(
                "AdSet creado pero el Ad falló — revisar el creative en Ads Manager."
            )
        else:
            rationale_parts.append(
                "Solo campaña shell — el usuario debe agregar AdSets y Ads "
                "en Ads Manager (faltó page_id o presupuesto)."
            )

        return CreateResult(
            platform=self.platform,
            campaign_id=campaign_id,
            status="PAUSED",
            preview_url=_ads_manager_url(
                credentials.normalized_ad_account_id, campaign_id
            ),
            rationale=" ".join(rationale_parts),
            raw={
                "objective_used": objective_used,
                "adset_id": adset_id,
                "ad_id": ad_id,
                "creative_fallback": creative_fallback,
            },
        )

    def delete_campaign(self, credentials: MetaCreds, campaign_id: str) -> DeleteResult:
        sdk = self._init_api(credentials)
        try:
            sdk.Campaign(campaign_id).api_delete()
        except sdk.FacebookRequestError as e:
            raise AdapterError(
                self.platform,
                f"no se pudo eliminar la campaña {campaign_id}: {e.api_error_message()}",
            ) from e

        return DeleteResult(
            platform=self.platform,
            campaign_id=campaign_id,
            deleted=True,
            soft_delete=False,
            platform_status_after="DELETED",
            rationale=(
                f"Campaña {campaign_id} eliminada permanentemente de Meta. "
                f"No se puede recuperar — los insights históricos quedan en Ads Manager."
            ),
        )

    def get_campaign(self, credentials: MetaCreds, campaign_id: str) -> CampaignStatus:
        sdk = self._init_api(credentials)
        try:
            camp = sdk.Campaign(campaign_id).api_get(
                fields=["name", "status", "objective"]
            )
            try:
                insights_list = sdk.Campaign(campaign_id).get_insights(
                    fields=["reach", "impressions", "spend"]
                )
                ins = dict(insights_list[0]) if insights_list else {}
            except sdk.FacebookRequestError:
                ins = {}

            return CampaignStatus(
                platform=self.platform,
                campaign_id=campaign_id,
                status=camp.get("status") or "UNKNOWN",
                name=camp.get("name"),
                objective=camp.get("objective"),
                reach=int(ins.get("reach", 0) or 0),
                impressions=int(ins.get("impressions", 0) or 0),
                spend=float(ins.get("spend", 0) or 0),
            )
        except sdk.FacebookRequestError as e:
            return CampaignStatus(
                platform=self.platform,
                campaign_id=campaign_id,
                status="UNKNOWN",
                name=None,
                objective=None,
                error=e.api_error_message(),
            )


def _ads_manager_url(account_id: str, campaign_id: str) -> str:
    clean = account_id.replace("act_", "")
    return (
        f"https://adsmanager.facebook.com/adsmanager/manage/campaigns"
        f"?act={clean}&selected_campaign_ids={campaign_id}"
    )


__all__ = ["MetaAdapter"]
