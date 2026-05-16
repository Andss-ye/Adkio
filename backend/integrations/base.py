"""
Contratos compartidos para adapters de plataformas publicitarias.

Diseño:
- Cada plataforma (Meta, TikTok, Google Ads) implementa `PlatformAdapter`.
- Los adapters reciben credenciales como parámetro — no leen env ni DB.
  Esto los mantiene stateless y tenant-agnostic. El resolver de credenciales
  vive en `backend/services/credential_resolver.py`.
- `CampaignSpec` es el input canónico para crear campañas. Mapea a cada
  plataforma dentro del adapter.
- `delete_campaign` puede ser hard-delete (Meta, Google) o soft-delete (TikTok).
  El flag `soft_delete` en `DeleteResult` lo explicita y el `rationale` lo
  comunica al usuario via el panel de razonamiento.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Protocol, runtime_checkable


@dataclass(frozen=True)
class CampaignSpec:
    """Input canónico para crear una campaña.

    `name`, `objective`, `budget_usd`, `duration_days` son obligatorios.
    `copy` y `targeting` siguen el schema en español del onboarding/audience_analyzer
    para no obligar al caller a traducir antes de invocar el adapter.
    """

    name: str
    objective: str
    budget_usd: float
    duration_days: int
    copy: dict = field(default_factory=dict)
    targeting: dict = field(default_factory=dict)
    creative_spec: dict = field(default_factory=dict)


@dataclass(frozen=True)
class CreateResult:
    platform: str
    campaign_id: str
    status: str
    preview_url: Optional[str]
    rationale: str
    raw: dict = field(default_factory=dict)


@dataclass(frozen=True)
class DeleteResult:
    """Resultado de una eliminación.

    `soft_delete=True` significa que la plataforma no permite remove real
    (caso TikTok) y la campaña quedó DISABLED/PAUSED en su lugar. El frontend
    debe avisar esto al usuario.
    """

    platform: str
    campaign_id: str
    deleted: bool
    soft_delete: bool
    platform_status_after: Optional[str]
    rationale: str
    raw: dict = field(default_factory=dict)


@dataclass(frozen=True)
class CampaignStatus:
    platform: str
    campaign_id: str
    status: str
    name: Optional[str]
    objective: Optional[str]
    reach: int = 0
    impressions: int = 0
    spend: float = 0.0
    error: Optional[str] = None
    raw: dict = field(default_factory=dict)


class AdapterError(RuntimeError):
    """Falla esperable del adapter (creds inválidas, API rechazó, etc).

    Los tools convierten esto en un `rationale` legible para el panel
    en vez de propagarlo como excepción cruda al frontend.
    """

    def __init__(self, platform: str, message: str, *, recoverable: bool = False):
        super().__init__(f"[{platform}] {message}")
        self.platform = platform
        self.recoverable = recoverable


@runtime_checkable
class PlatformAdapter(Protocol):
    """Contrato que cumplen Meta, TikTok y Google Ads.

    Los métodos reciben `credentials` como primer argumento — un dataclass
    específico por plataforma (`MetaCreds`, `TikTokCreds`, `GoogleAdsCreds`).
    Esto deja al adapter completamente stateless: el mismo adapter sirve
    para cualquier cuenta cuando un día llegue multitenant.
    """

    platform: str

    def create_campaign(self, credentials, spec: CampaignSpec) -> CreateResult:
        ...

    def delete_campaign(self, credentials, campaign_id: str) -> DeleteResult:
        ...

    def get_campaign(self, credentials, campaign_id: str) -> CampaignStatus:
        ...


__all__ = [
    "AdapterError",
    "CampaignSpec",
    "CampaignStatus",
    "CreateResult",
    "DeleteResult",
    "PlatformAdapter",
]
