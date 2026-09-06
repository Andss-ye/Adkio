"""
Adapter de TikTok Ads — implementa `PlatformAdapter` usando la Business API REST.

Diseño:
- Llamadas HTTP directas a `business-api.tiktok.com/open_api/v1.3` con `requests`,
  no SDK. Razón: el SDK oficial (`tiktok-business-api-sdk`) tiene un wrapping
  particular para cada endpoint que complica el mocking. REST directo nos da
  control total y tests deterministas.
- `delete_campaign` es **soft-delete**: TikTok no expone hard-delete real.
  El método llama `/campaign/status/update/` con `DISABLE`. El `DeleteResult`
  marca `soft_delete=True` para que el frontend pueda mostrar el disclaimer.
- HTTP client inyectable (`http_client=...`) para tests.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Optional

from backend.integrations.base import (
    AdapterError,
    CampaignSpec,
    CampaignStatus,
    CreateResult,
    DeleteResult,
)
from backend.integrations.credentials import TikTokCreds

logger = logging.getLogger(__name__)


_OBJECTIVE_MAP: dict[str, str] = {
    "OUTCOME_LEADS": "LEAD_GENERATION",
    "OUTCOME_TRAFFIC": "TRAFFIC",
    "OUTCOME_AWARENESS": "REACH",
    "OUTCOME_ENGAGEMENT": "ENGAGEMENT",
    "OUTCOME_SALES": "CONVERSIONS",
}


class TikTokAdapter:
    platform = "tiktok"

    def __init__(self, http_client=None):
        self._http = http_client

    def _client(self):
        if self._http is not None:
            return self._http
        try:
            import requests
        except ImportError as exc:
            raise AdapterError(
                self.platform,
                f"`requests` no está instalado: {exc}",
            ) from exc
        self._http = requests
        return self._http

    def _headers(self, creds: TikTokCreds) -> dict:
        return {
            "Access-Token": creds.access_token,
            "Content-Type": "application/json",
        }

    def _post(self, creds: TikTokCreds, path: str, body: dict) -> dict:
        url = f"{creds.base_url}{path}"
        resp = self._client().post(url, json=body, headers=self._headers(creds), timeout=30)
        data = resp.json() if hasattr(resp, "json") else {}
        code = data.get("code")
        if code not in (0, None):
            raise AdapterError(
                self.platform,
                f"TikTok API code={code} message={data.get('message')}",
            )
        return data.get("data") or {}

    def _get(self, creds: TikTokCreds, path: str, params: dict) -> dict:
        url = f"{creds.base_url}{path}"
        resp = self._client().get(url, params=params, headers=self._headers(creds), timeout=30)
        data = resp.json() if hasattr(resp, "json") else {}
        code = data.get("code")
        if code not in (0, None):
            raise AdapterError(
                self.platform,
                f"TikTok API code={code} message={data.get('message')}",
            )
        return data.get("data") or {}

    def _check(self, creds: TikTokCreds):
        missing = creds.validate()
        if missing:
            raise AdapterError(
                self.platform,
                f"credenciales incompletas: faltan {', '.join(missing)}",
            )

    def create_campaign(self, credentials: TikTokCreds, spec: CampaignSpec) -> CreateResult:
        self._check(credentials)
        objective = _OBJECTIVE_MAP.get(
            (spec.objective or "OUTCOME_LEADS").upper(), "TRAFFIC"
        )
        body = {
            "advertiser_id": credentials.advertiser_id,
            "campaign_name": spec.name or "Adkio Campaign",
            "objective_type": objective,
            "budget_mode": "BUDGET_MODE_TOTAL",
            "budget": float(spec.budget_usd),
            # TikTok no soporta PAUSED at-creation explícito — la campaña queda
            # ENABLE pero los ad groups dentro se crean DISABLE. HITL real
            # vive a nivel de ad group; ver handoff multitenant.
            "operation_status": "DISABLE",
        }
        data = self._post(credentials, "/campaign/create/", body)
        campaign_id = str(data.get("campaign_id") or "")
        if not campaign_id:
            raise AdapterError(
                self.platform, "respuesta sin campaign_id"
            )
        return CreateResult(
            platform=self.platform,
            campaign_id=campaign_id,
            status="DISABLE",
            preview_url=_ads_manager_url(credentials.advertiser_id, campaign_id),
            rationale=(
                f"Campaña creada en TikTok con objetivo {objective}, en DISABLE. "
                f"El usuario debe revisarla y activarla manualmente desde TikTok Ads Manager."
            ),
            raw={"objective_used": objective},
        )

    def delete_campaign(self, credentials: TikTokCreds, campaign_id: str) -> DeleteResult:
        """Soft-delete: TikTok no permite hard-delete real, solo DISABLE."""
        self._check(credentials)
        body = {
            "advertiser_id": credentials.advertiser_id,
            "campaign_ids": [campaign_id],
            "operation_status": "DISABLE",
        }
        self._post(credentials, "/campaign/status/update/", body)
        return DeleteResult(
            platform=self.platform,
            campaign_id=campaign_id,
            deleted=True,
            soft_delete=True,
            platform_status_after="DISABLE",
            rationale=(
                f"Campaña {campaign_id} desactivada en TikTok (soft-delete). "
                f"TikTok no permite eliminación permanente vía API — la campaña queda "
                f"como DISABLE en Ads Manager con sus insights históricos intactos."
            ),
        )

    def get_campaign(
        self,
        credentials: TikTokCreds,
        campaign_id: str,
        metric_date: Optional[date] = None,
    ) -> CampaignStatus:
        # metric_date se acepta por contrato; este adapter no pide reports diarios.
        self._check(credentials)
        params = {
            "advertiser_id": credentials.advertiser_id,
            "filtering": '{"campaign_ids":["' + campaign_id + '"]}',
        }
        try:
            data = self._get(credentials, "/campaign/get/", params)
            campaigns = data.get("list") or []
            if not campaigns:
                return CampaignStatus(
                    platform=self.platform,
                    campaign_id=campaign_id,
                    status="UNKNOWN",
                    name=None,
                    objective=None,
                    error="campaign not found",
                )
            c = campaigns[0]
            return CampaignStatus(
                platform=self.platform,
                campaign_id=campaign_id,
                status=c.get("operation_status") or c.get("secondary_status") or "UNKNOWN",
                name=c.get("campaign_name"),
                objective=c.get("objective_type"),
                raw=c,
            )
        except AdapterError as e:
            return CampaignStatus(
                platform=self.platform,
                campaign_id=campaign_id,
                status="UNKNOWN",
                name=None,
                objective=None,
                error=str(e),
            )


def _ads_manager_url(advertiser_id: str, campaign_id: str) -> str:
    return (
        f"https://ads.tiktok.com/i18n/perf/campaign"
        f"?aadvid={advertiser_id}&campaign_ids={campaign_id}"
    )


__all__ = ["TikTokAdapter"]
