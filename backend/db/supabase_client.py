"""
Cliente Supabase para brand_configs.
Toda la persistencia de marcas pasa por este módulo.
"""
import os
from typing import Optional
from supabase import create_client, Client

_client: Optional[Client] = None


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


def create_brand_config(data: dict) -> str:
    """Inserta un brand_config nuevo. Retorna el UUID generado."""
    client = _get_client()
    payload = {k: v for k, v in data.items() if k != "id"}
    result = client.table("brand_configs").insert(payload).execute()
    return result.data[0]["id"]


def upsert_brand_config(data: dict) -> str:
    """Inserta o actualiza por slug. Retorna el UUID del registro."""
    client = _get_client()
    payload = {k: v for k, v in data.items() if k != "id"}
    result = (
        client.table("brand_configs")
        .upsert(payload, on_conflict="slug")
        .execute()
    )
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
