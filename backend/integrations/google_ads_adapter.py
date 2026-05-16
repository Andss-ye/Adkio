"""
Adapter de Google Ads — implementa `PlatformAdapter` usando google-ads SDK.

Diseño:
- google-ads-python construye un client con OAuth2 (refresh_token) + developer_token.
- create_campaign usa `CampaignService.mutate_campaigns` con una operación CREATE,
  presupuesto se crea aparte vía `CampaignBudgetService`.
- delete_campaign usa `mutate_campaigns` con operación REMOVE — hard-delete real,
  el resource_name queda inaccesible aunque los insights persisten en la cuenta.
- SDK inyectable (`client=...`) para tests. El SDK es pesado de inicializar,
  así que se carga lazy.
"""
from __future__ import annotations

import logging
from typing import Optional

from backend.integrations.base import (
    AdapterError,
    CampaignSpec,
    CampaignStatus,
    CreateResult,
    DeleteResult,
)
from backend.integrations.credentials import GoogleAdsCreds

logger = logging.getLogger(__name__)


_OBJECTIVE_TO_CHANNEL: dict[str, str] = {
    "OUTCOME_LEADS": "SEARCH",
    "OUTCOME_TRAFFIC": "SEARCH",
    "OUTCOME_AWARENESS": "DISPLAY",
    "OUTCOME_ENGAGEMENT": "VIDEO",
    "OUTCOME_SALES": "SEARCH",
}


class GoogleAdsAdapter:
    platform = "google_ads"

    def __init__(self, client=None):
        # Inyectable para tests. En prod se construye desde creds via
        # GoogleAdsClient.load_from_dict.
        self._client = client

    def _build_client(self, creds: GoogleAdsCreds):
        if self._client is not None:
            return self._client
        try:
            from google.ads.googleads.client import GoogleAdsClient
        except ImportError as exc:
            raise AdapterError(
                self.platform,
                f"google-ads SDK no instalado: {exc}",
            ) from exc
        config = {
            "developer_token": creds.developer_token,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "refresh_token": creds.refresh_token,
            "use_proto_plus": True,
        }
        if creds.login_customer_id:
            config["login_customer_id"] = creds.login_customer_id.replace("-", "")
        return GoogleAdsClient.load_from_dict(config)

    def _check(self, creds: GoogleAdsCreds):
        missing = creds.validate()
        if missing:
            raise AdapterError(
                self.platform,
                f"credenciales incompletas: faltan {', '.join(missing)}",
            )

    def create_campaign(self, credentials: GoogleAdsCreds, spec: CampaignSpec) -> CreateResult:
        self._check(credentials)
        client = self._build_client(credentials)
        customer_id = credentials.normalized_customer_id

        channel_type = _OBJECTIVE_TO_CHANNEL.get(
            (spec.objective or "OUTCOME_LEADS").upper(), "SEARCH"
        )

        try:
            # 1) Crear budget (Google exige un budget resource antes de la campaña).
            budget_service = client.get_service("CampaignBudgetService")
            budget_op = client.get_type("CampaignBudgetOperation")
            budget = budget_op.create
            budget.name = f"[Adkio] Budget {spec.name}"
            # Google Ads usa micros (1 USD = 1_000_000 micros). Daily budget.
            daily_usd = max(1.0, spec.budget_usd / max(spec.duration_days, 1))
            budget.amount_micros = int(daily_usd * 1_000_000)
            budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
            budget_response = budget_service.mutate_campaign_budgets(
                customer_id=customer_id, operations=[budget_op]
            )
            budget_resource = budget_response.results[0].resource_name

            # 2) Crear campaña en PAUSED (HITL).
            campaign_service = client.get_service("CampaignService")
            campaign_op = client.get_type("CampaignOperation")
            campaign = campaign_op.create
            campaign.name = spec.name or "Adkio Campaign"
            campaign.advertising_channel_type = getattr(
                client.enums.AdvertisingChannelTypeEnum, channel_type
            )
            campaign.status = client.enums.CampaignStatusEnum.PAUSED
            campaign.campaign_budget = budget_resource

            response = campaign_service.mutate_campaigns(
                customer_id=customer_id, operations=[campaign_op]
            )
            resource_name = response.results[0].resource_name
            campaign_id = resource_name.rsplit("/", 1)[-1]

            return CreateResult(
                platform=self.platform,
                campaign_id=campaign_id,
                status="PAUSED",
                preview_url=_ads_manager_url(customer_id, campaign_id),
                rationale=(
                    f"Campaña creada en Google Ads como {channel_type} en PAUSED. "
                    f"Presupuesto diario calculado en ${daily_usd:.2f} USD. "
                    f"El usuario debe revisar ad groups + keywords antes de activarla."
                ),
                raw={"resource_name": resource_name, "channel_type": channel_type},
            )
        except Exception as exc:
            # google-ads SDK lanza GoogleAdsException; lo capturamos genérico
            # para no acoplar la importación.
            raise AdapterError(
                self.platform,
                f"Google Ads rechazó la creación: {exc}",
            ) from exc

    def delete_campaign(self, credentials: GoogleAdsCreds, campaign_id: str) -> DeleteResult:
        self._check(credentials)
        client = self._build_client(credentials)
        customer_id = credentials.normalized_customer_id

        try:
            campaign_service = client.get_service("CampaignService")
            campaign_op = client.get_type("CampaignOperation")
            campaign_op.remove = (
                f"customers/{customer_id}/campaigns/{campaign_id}"
            )
            campaign_service.mutate_campaigns(
                customer_id=customer_id, operations=[campaign_op]
            )
        except Exception as exc:
            raise AdapterError(
                self.platform,
                f"no se pudo eliminar la campaña {campaign_id}: {exc}",
            ) from exc

        return DeleteResult(
            platform=self.platform,
            campaign_id=campaign_id,
            deleted=True,
            soft_delete=False,
            platform_status_after="REMOVED",
            rationale=(
                f"Campaña {campaign_id} eliminada de Google Ads (REMOVED). "
                f"El resource_name queda inaccesible — los insights históricos "
                f"siguen en la cuenta pero no se pueden editar más."
            ),
        )

    def get_campaign(self, credentials: GoogleAdsCreds, campaign_id: str) -> CampaignStatus:
        self._check(credentials)
        client = self._build_client(credentials)
        customer_id = credentials.normalized_customer_id

        try:
            ga_service = client.get_service("GoogleAdsService")
            query = (
                "SELECT campaign.id, campaign.name, campaign.status, "
                "campaign.advertising_channel_type, "
                "metrics.impressions, metrics.cost_micros "
                f"FROM campaign WHERE campaign.id = {campaign_id}"
            )
            response = ga_service.search(customer_id=customer_id, query=query)
            for row in response:
                spend_usd = (row.metrics.cost_micros or 0) / 1_000_000
                return CampaignStatus(
                    platform=self.platform,
                    campaign_id=campaign_id,
                    status=str(row.campaign.status.name),
                    name=row.campaign.name,
                    objective=str(row.campaign.advertising_channel_type.name),
                    impressions=int(row.metrics.impressions or 0),
                    spend=float(spend_usd),
                )
            return CampaignStatus(
                platform=self.platform,
                campaign_id=campaign_id,
                status="UNKNOWN",
                name=None,
                objective=None,
                error="campaign not found",
            )
        except Exception as exc:
            return CampaignStatus(
                platform=self.platform,
                campaign_id=campaign_id,
                status="UNKNOWN",
                name=None,
                objective=None,
                error=str(exc),
            )


def _ads_manager_url(customer_id: str, campaign_id: str) -> str:
    return (
        f"https://ads.google.com/aw/campaigns"
        f"?ocid={customer_id}&campaignId={campaign_id}"
    )


__all__ = ["GoogleAdsAdapter"]
