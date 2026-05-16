"""
Dataclasses de credenciales por plataforma.

Cada plataforma tiene sus propios campos. Los adapters reciben el dataclass
correspondiente — nunca leen env ni DB directamente. El resolver de
credenciales (`backend/services/credential_resolver.py`) es el único responsable
de cargar las credenciales desde donde corresponda (env hoy, Supabase con
multitenant mañana).

Validación: `validate()` en cada dataclass devuelve la lista de campos
faltantes. Los adapters llaman `validate()` antes de tocar el SDK para fallar
rápido y limpio con un `AdapterError`.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class MetaCreds:
    app_id: str
    app_secret: str
    access_token: str
    ad_account_id: str
    page_id: Optional[str] = None

    def validate(self) -> list[str]:
        missing: list[str] = []
        for field_name in ("app_id", "access_token", "ad_account_id"):
            if not getattr(self, field_name):
                missing.append(field_name)
        return missing

    @property
    def normalized_ad_account_id(self) -> str:
        aid = self.ad_account_id
        return aid if aid.startswith("act_") else f"act_{aid}"


@dataclass(frozen=True)
class TikTokCreds:
    access_token: str
    advertiser_id: str
    app_id: Optional[str] = None
    app_secret: Optional[str] = None
    sandbox: bool = False

    def validate(self) -> list[str]:
        missing: list[str] = []
        for field_name in ("access_token", "advertiser_id"):
            if not getattr(self, field_name):
                missing.append(field_name)
        return missing

    @property
    def base_url(self) -> str:
        if self.sandbox:
            return "https://sandbox-ads.tiktok.com/open_api/v1.3"
        return "https://business-api.tiktok.com/open_api/v1.3"


@dataclass(frozen=True)
class GoogleAdsCreds:
    developer_token: str
    client_id: str
    client_secret: str
    refresh_token: str
    customer_id: str
    login_customer_id: Optional[str] = None

    def validate(self) -> list[str]:
        missing: list[str] = []
        required = (
            "developer_token",
            "client_id",
            "client_secret",
            "refresh_token",
            "customer_id",
        )
        for field_name in required:
            if not getattr(self, field_name):
                missing.append(field_name)
        return missing

    @property
    def normalized_customer_id(self) -> str:
        return self.customer_id.replace("-", "")


__all__ = ["GoogleAdsCreds", "MetaCreds", "TikTokCreds"]
