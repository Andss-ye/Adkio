"""
Cliente Supabase para brand_configs.
Toda la persistencia de marcas pasa por este módulo.
"""
import os
from typing import Optional
from supabase import create_client, Client

_client: Optional[Client] = None

# Columnas válidas de la tabla brand_configs — cualquier campo extra del LLM se descarta
_SCHEMA_FIELDS = {
    "slug", "negocio_nombre", "negocio_industria", "propuesta_de_valor",
    "publico_roles", "publico_paises", "publico_edad_min", "publico_edad_max",
    "publico_intereses", "presupuesto_min_campana_usd", "presupuesto_max_campana_usd",
    "tono_estilo", "tono_evitar", "ejemplos_copy_aprobado", "pixel_configurado", "metadata",
}


def _get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_ANON_KEY) deben estar en .env"
            )
        _client = create_client(url, key)
    return _client


def _clean(data: dict) -> dict:
    """Filtra campos que no existen en la tabla (ej: campos_inferidos del LLM)."""
    return {k: v for k, v in data.items() if k in _SCHEMA_FIELDS}


def create_brand_config(data: dict) -> str:
    """Inserta un brand_config nuevo. Retorna el UUID generado."""
    client = _get_client()
    payload = _clean(data)
    result = client.table("brand_configs").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase no devolvió datos al insertar brand_config")
    return result.data[0]["id"]


def upsert_brand_config(data: dict) -> str:
    """Inserta o actualiza por slug. Retorna el UUID del registro."""
    client = _get_client()
    payload = _clean(data)
    result = (
        client.table("brand_configs")
        .upsert(payload, on_conflict="slug")
        .execute()
    )
    if not result.data:
        raise RuntimeError("Supabase no devolvió datos al hacer upsert brand_config")
    return result.data[0]["id"]


def get_brand_config(brand_id: str) -> Optional[dict]:
    """
    Busca por UUID o por slug.
    brand_id puede ser un UUID real o el slug 'demo-edu-latam'.
    """
    client = _get_client()

    # Intenta por slug primero (cubre el caso demo-edu-latam y nombres cortos)
    result = (
        client.table("brand_configs")
        .select("*")
        .eq("slug", brand_id)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]

    # Fallback: busca por UUID
    try:
        result = (
            client.table("brand_configs")
            .select("*")
            .eq("id", brand_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception:
        return None


def update_brand_config(brand_id: str, data: dict) -> None:
    """Actualiza campos de un brand_config existente (por UUID)."""
    client = _get_client()
    payload = {k: v for k, v in data.items() if k not in ("id", "slug", "created_at")}
    client.table("brand_configs").update(payload).eq("id", brand_id).execute()


def list_brand_configs() -> list[dict]:
    """Lista todos los brand_configs (para admin/debug)."""
    client = _get_client()
    result = client.table("brand_configs").select("id, slug, negocio_nombre, created_at").execute()
    return result.data or []


# ── Campaigns ──────────────────────────────────────────────────────────────

_CAMPAIGN_FIELDS = {
    "account_id",  # multitenant — quien lanzó la campaña
    "brand_id", "campaign_id", "status", "estimated_reach", "preview_url",
    "user_prompt", "copy_headline", "copy_body", "copy_cta",
    "budget_usd", "duration_days", "paises", "expected_leads",
    "cpl_usd", "cpl_min_usd", "cpl_max_usd",
    "platform", "is_mock",
}


def create_campaign_result(data: dict) -> str:
    """Persiste un resultado de campaña lanzada. Retorna el UUID generado."""
    client = _get_client()
    payload = {k: v for k, v in data.items() if k in _CAMPAIGN_FIELDS and v is not None}
    result = client.table("campaigns").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase no devolvió datos al insertar campaign")
    return result.data[0]["id"]


def list_campaigns(
    brand_id: Optional[str] = None,
    account_id: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """Lista campañas ordenadas por fecha descendente.

    - Si se da `account_id` → solo las del usuario (filtro multitenant fuerte).
    - Si no hay `account_id` pero hay `brand_id` → backward-compat single-tenant.
    """
    client = _get_client()
    q = (
        client.table("campaigns")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if account_id:
        q = q.eq("account_id", account_id)
    elif brand_id:
        q = q.eq("brand_id", brand_id)
    return q.execute().data or []


def delete_campaign(campaign_id: str) -> bool:
    """Hard-delete a campaign by its Supabase UUID or Meta campaign_id. Returns True if deleted."""
    client = _get_client()
    # Try by Supabase row id first, then by campaign_id column (Meta format)
    result = client.table("campaigns").delete().eq("id", campaign_id).execute()
    if result.data:
        return True
    result = client.table("campaigns").delete().eq("campaign_id", campaign_id).execute()
    return bool(result.data)
