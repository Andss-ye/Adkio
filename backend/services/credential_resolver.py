"""
Credential resolver — abstrae *de dónde* salen las credenciales de plataforma.

Hoy (single-tenant): `EnvCredentialResolver` lee del `.env` proceso.
Mañana (multitenant, lo hace Freddy): `DBCredentialResolver(account_id)` que
lee de la tabla `platform_connections` y desencripta tokens.

Los tools y adapters no saben de cuál se trata — solo invocan
`resolver.resolve(platform)` y reciben el dataclass de credenciales
correspondiente. Eso mantiene el core stateless y tenant-agnostic.

Contrato:
    resolver.resolve("meta")       -> MetaCreds | None
    resolver.resolve("tiktok")     -> TikTokCreds | None
    resolver.resolve("google_ads") -> GoogleAdsCreds | None

Devuelve `None` si la plataforma no está configurada (en vez de excepción
para que el caller pueda decidir el fallback). Lanza `ValueError` solo si
el nombre de plataforma es inválido.
"""
from __future__ import annotations

import os
from typing import Optional, Protocol, Union, runtime_checkable

from backend.integrations.credentials import (
    GoogleAdsCreds,
    MetaCreds,
    TikTokCreds,
)

PlatformName = str  # "meta" | "tiktok" | "google_ads"
PlatformCreds = Union[MetaCreds, TikTokCreds, GoogleAdsCreds]

_VALID_PLATFORMS = ("meta", "tiktok", "google_ads")


@runtime_checkable
class CredentialResolver(Protocol):
    def resolve(self, platform: PlatformName) -> Optional[PlatformCreds]:
        ...


class EnvCredentialResolver:
    """Single-tenant: lee credenciales del proceso/.env.

    Usa el mismo naming que el resto del repo:
    - Meta: META_APP_ID / META_APP_SECRET / META_ACCESS_TOKEN / META_AD_ACCOUNT_ID / META_PAGE_ID
            (con fallback a APP_ID / ACCESS_TOKEN / AD_ACCOUNT_ID / PAGE_ID)
    - TikTok: TIKTOK_ACCESS_TOKEN / TIKTOK_ADVERTISER_ID / TIKTOK_APP_ID / TIKTOK_APP_SECRET
              TIKTOK_USE_SANDBOX=true para el sandbox
    - Google: GOOGLE_ADS_DEVELOPER_TOKEN / GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET /
              GOOGLE_ADS_REFRESH_TOKEN / GOOGLE_ADS_CUSTOMER_ID / GOOGLE_ADS_LOGIN_CUSTOMER_ID
    """

    def __init__(self, environ: Optional[dict] = None):
        # Inyectable para tests — sin patch de os.environ global.
        self._env = environ if environ is not None else os.environ

    def _get(self, *names: str) -> Optional[str]:
        for n in names:
            v = self._env.get(n)
            if v:
                return v.strip().strip("'").strip('"')
        return None

    def resolve(self, platform: PlatformName) -> Optional[PlatformCreds]:
        if platform not in _VALID_PLATFORMS:
            raise ValueError(
                f"plataforma inválida: {platform!r} (esperado: {_VALID_PLATFORMS})"
            )
        if platform == "meta":
            return self._resolve_meta()
        if platform == "tiktok":
            return self._resolve_tiktok()
        if platform == "google_ads":
            return self._resolve_google()
        return None

    def _resolve_meta(self) -> Optional[MetaCreds]:
        app_id = self._get("META_APP_ID", "APP_ID")
        access_token = self._get("META_ACCESS_TOKEN", "ACCESS_TOKEN")
        ad_account_id = self._get("META_AD_ACCOUNT_ID", "AD_ACCOUNT_ID")
        if not (app_id and access_token and ad_account_id):
            return None
        return MetaCreds(
            app_id=app_id,
            app_secret=self._get("META_APP_SECRET", "APP_SECRET") or "",
            access_token=access_token,
            ad_account_id=ad_account_id,
            page_id=self._get("META_PAGE_ID", "PAGE_ID"),
        )

    def _resolve_tiktok(self) -> Optional[TikTokCreds]:
        access_token = self._get("TIKTOK_ACCESS_TOKEN")
        advertiser_id = self._get("TIKTOK_ADVERTISER_ID")
        if not (access_token and advertiser_id):
            return None
        sandbox = (self._get("TIKTOK_USE_SANDBOX") or "false").lower() == "true"
        return TikTokCreds(
            access_token=access_token,
            advertiser_id=advertiser_id,
            app_id=self._get("TIKTOK_APP_ID"),
            app_secret=self._get("TIKTOK_APP_SECRET"),
            sandbox=sandbox,
        )

    def _resolve_google(self) -> Optional[GoogleAdsCreds]:
        dev_token = self._get("GOOGLE_ADS_DEVELOPER_TOKEN")
        client_id = self._get("GOOGLE_ADS_CLIENT_ID")
        client_secret = self._get("GOOGLE_ADS_CLIENT_SECRET")
        refresh_token = self._get("GOOGLE_ADS_REFRESH_TOKEN")
        customer_id = self._get("GOOGLE_ADS_CUSTOMER_ID")
        if not (
            dev_token and client_id and client_secret and refresh_token and customer_id
        ):
            return None
        return GoogleAdsCreds(
            developer_token=dev_token,
            client_id=client_id,
            client_secret=client_secret,
            refresh_token=refresh_token,
            customer_id=customer_id,
            login_customer_id=self._get("GOOGLE_ADS_LOGIN_CUSTOMER_ID"),
        )


__all__ = ["CredentialResolver", "EnvCredentialResolver"]
