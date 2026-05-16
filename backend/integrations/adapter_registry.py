"""
Registry de adapters por plataforma — punto único de despacho.

Lo usan los tools `campaign_launcher` y `campaign_remover` para no tener
que conocer las clases concretas. Mañana, cuando agreguemos un nuevo
canal (LinkedIn, X), se registra acá y los tools no se enteran.
"""
from __future__ import annotations

from backend.integrations.base import PlatformAdapter
from backend.integrations.google_ads_adapter import GoogleAdsAdapter
from backend.integrations.meta_adapter import MetaAdapter
from backend.integrations.tiktok_adapter import TikTokAdapter

_ADAPTERS: dict[str, PlatformAdapter] = {
    "meta": MetaAdapter(),
    "tiktok": TikTokAdapter(),
    "google_ads": GoogleAdsAdapter(),
}


def get_adapter(platform: str) -> PlatformAdapter:
    if platform not in _ADAPTERS:
        raise ValueError(
            f"Plataforma desconocida: {platform!r}. "
            f"Soportadas: {tuple(_ADAPTERS.keys())}"
        )
    return _ADAPTERS[platform]


def supported_platforms() -> tuple[str, ...]:
    return tuple(_ADAPTERS.keys())


__all__ = ["get_adapter", "supported_platforms"]
