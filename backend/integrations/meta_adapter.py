"""
Adapter de Meta Ads — implementa `PlatformAdapter` usando facebook-business SDK.

Diseño:
- Recibe `MetaCreds` por parámetro: cero lectura de env desde acá.
- Inicializa el SDK por request con `FacebookAdsApi.init(...)`. La inicialización
  es global del SDK (limitación de la lib), así que el adapter NO es thread-safe
  para múltiples accounts simultáneos. Para multitenant alta concurrencia,
  Freddy va a necesitar un pool de FacebookAdsApi sessions; ver
  `docs/HANDOFF_MULTITENANT.md`.
- Todos los recursos se crean con `status=PAUSED` (HITL).
- delete_campaign hace hard-delete real via Campaign(id).api_delete().
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
}


class MetaAdapter:
    platform = "meta"

    def __init__(self, sdk_module=None):
        # Inyectable para tests. En producción se importa el SDK real.
        self._sdk = sdk_module

    def _ensure_sdk(self):
        if self._sdk is not None:
            return self._sdk
        try:
            from facebook_business.adobjects.adaccount import AdAccount
            from facebook_business.adobjects.campaign import Campaign
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

    def create_campaign(self, credentials: MetaCreds, spec: CampaignSpec) -> CreateResult:
        sdk = self._init_api(credentials)
        account = sdk.AdAccount(credentials.normalized_ad_account_id)

        objective = (spec.objective or "OUTCOME_LEADS").upper()
        candidates = _OBJECTIVE_FALLBACKS.get(
            objective, [objective, "OUTCOME_TRAFFIC"]
        )

        last_err = None
        for obj in candidates:
            try:
                campaign = account.create_campaign(
                    params={
                        "name": spec.name or "Adkio Campaign",
                        "objective": obj,
                        "status": "PAUSED",
                        "buying_type": "AUCTION",
                        "special_ad_categories": [],
                        "is_adset_budget_sharing_enabled": False,
                    }
                )
                campaign_id = str(campaign["id"])
                return CreateResult(
                    platform=self.platform,
                    campaign_id=campaign_id,
                    status="PAUSED",
                    preview_url=_ads_manager_url(
                        credentials.normalized_ad_account_id, campaign_id
                    ),
                    rationale=(
                        f"Campaña creada en Meta con objetivo {obj}, en PAUSED. "
                        f"El usuario debe revisar y activarla manualmente desde Ads Manager."
                    ),
                    raw={"objective_used": obj},
                )
            except sdk.FacebookRequestError as e:
                last_err = e
                logger.warning(
                    "Meta create_campaign falló con objective=%s: %s",
                    obj,
                    e.api_error_message(),
                )

        raise AdapterError(
            self.platform,
            f"Meta rechazó la creación: {last_err.api_error_message() if last_err else 'desconocido'}",
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


# Kept for caller convenience — proves the adapter satisfies the Protocol.
# (Defensive — `runtime_checkable` Protocols accept any structural match.)
def _default_window() -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    return (
        (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S+0000"),
        (now + timedelta(days=8)).strftime("%Y-%m-%dT%H:%M:%S+0000"),
    )


__all__ = ["MetaAdapter"]
