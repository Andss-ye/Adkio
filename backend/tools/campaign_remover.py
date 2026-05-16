"""
campaign_remover — elimina/desactiva una campaña en Meta, TikTok o Google Ads.

Diseño:
- Doble confirmación: la primera llamada con `confirm=False` devuelve un preview
  con `requires_confirmation=True`. El frontend muestra un modal y el agente
  vuelve a llamar con `confirm=True` para ejecutar.
- TikTok es soft-delete (la API no permite hard-delete): el resultado lo
  refleja en `soft_delete=True` y el rationale lo explica al usuario.
- Meta y Google Ads son hard-delete reales: el campaign_id queda inaccesible.

Output:
    {
        "deleted": bool,
        "soft_delete": bool,           # True solo para TikTok
        "platform": str,
        "campaign_id": str,
        "platform_status_after": str,  # "DELETED" | "REMOVED" | "DISABLE"
        "requires_confirmation": bool,
        "rationale": str
    }
"""
from __future__ import annotations

import logging

from backend.integrations.adapter_registry import get_adapter, supported_platforms
from backend.integrations.base import AdapterError
from backend.services.credential_resolver import EnvCredentialResolver

logger = logging.getLogger(__name__)


def campaign_remover(
    platform: str,
    campaign_id: str,
    confirm: bool = False,
    resolver=None,
) -> dict:
    if platform not in supported_platforms():
        return {
            "deleted": False,
            "soft_delete": False,
            "platform": platform,
            "campaign_id": campaign_id,
            "platform_status_after": None,
            "requires_confirmation": False,
            "rationale": (
                f"Plataforma {platform!r} no soportada. "
                f"Soportadas: {', '.join(supported_platforms())}."
            ),
        }

    if not confirm:
        soft = platform == "tiktok"
        warning = (
            "Esta acción **desactivará** la campaña en TikTok (soft-delete — "
            "TikTok no permite eliminación permanente)."
            if soft
            else f"Esta acción **eliminará permanentemente** la campaña en {platform}. "
            "No se puede recuperar."
        )
        return {
            "deleted": False,
            "soft_delete": soft,
            "platform": platform,
            "campaign_id": campaign_id,
            "platform_status_after": None,
            "requires_confirmation": True,
            "rationale": (
                f"Preview de eliminación de la campaña {campaign_id} en {platform}. "
                f"{warning} Volvé a llamar con confirm=true para ejecutar."
            ),
        }

    resolver = resolver or EnvCredentialResolver()
    creds = resolver.resolve(platform)
    if creds is None:
        return {
            "deleted": False,
            "soft_delete": False,
            "platform": platform,
            "campaign_id": campaign_id,
            "platform_status_after": None,
            "requires_confirmation": False,
            "rationale": (
                f"Plataforma {platform} no está conectada (credenciales ausentes). "
                f"Conectá la cuenta antes de intentar eliminar."
            ),
        }

    adapter = get_adapter(platform)
    try:
        result = adapter.delete_campaign(creds, campaign_id)
    except AdapterError as exc:
        logger.warning("campaign_remover falló: %s", exc)
        return {
            "deleted": False,
            "soft_delete": False,
            "platform": platform,
            "campaign_id": campaign_id,
            "platform_status_after": None,
            "requires_confirmation": False,
            "rationale": f"No se pudo eliminar la campaña: {exc}",
        }

    return {
        "deleted": result.deleted,
        "soft_delete": result.soft_delete,
        "platform": result.platform,
        "campaign_id": result.campaign_id,
        "platform_status_after": result.platform_status_after,
        "requires_confirmation": False,
        "rationale": result.rationale,
    }


__all__ = ["campaign_remover"]
