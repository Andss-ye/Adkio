"""Repositorio Supabase para la tabla `platform_connections`."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from backend.db.supabase_client import _get_client


def upsert_connection(
    account_id: str,
    platform: str,
    provider_account_id: str,
    access_token_encrypted: str,
    refresh_token_encrypted: Optional[str] = None,
    token_expires_at: Optional[datetime] = None,
    extra: Optional[dict] = None,
    scopes: Optional[list[str]] = None,
) -> dict:
    """Inserta o reemplaza la conexión para (account_id, platform)."""
    client = _get_client()
    payload = {
        "adkio_account_id": account_id,
        "platform": platform,
        "provider_account_id": provider_account_id,
        "access_token_encrypted": access_token_encrypted,
        "refresh_token_encrypted": refresh_token_encrypted,
        "token_expires_at": token_expires_at.isoformat() if token_expires_at else None,
        "extra_jsonb": extra or {},
        "scopes": scopes or [],
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }
    # Filtrar None para no pisar columnas con NULL
    payload = {k: v for k, v in payload.items() if v is not None}
    result = (
        client.table("platform_connections")
        .upsert(payload, on_conflict="adkio_account_id,platform")
        .execute()
    )
    if not result.data:
        raise RuntimeError("Supabase no devolvió datos al upsert de platform_connections")
    return result.data[0]


def list_connections(account_id: str) -> list[dict]:
    """Devuelve resumen de las conexiones del account (sin tokens cifrados)."""
    client = _get_client()
    result = (
        client.table("platform_connections")
        .select(
            "id, platform, provider_account_id, connected_at, last_validated_at, scopes"
        )
        .eq("adkio_account_id", account_id)
        .execute()
    )
    return result.data or []


def get_connection(account_id: str, platform: str) -> Optional[dict]:
    """La conexión de (account_id, platform), sin tokens. `None` si no existe.

    El filtro por `adkio_account_id` es el aislamiento real de tenancy: el
    backend usa la service role key y bypassa RLS.
    """
    client = _get_client()
    result = (
        client.table("platform_connections")
        .select("id, platform, provider_account_id, extra_jsonb, scopes")
        .eq("adkio_account_id", account_id)
        .eq("platform", platform)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def delete_connection(account_id: str, platform: str) -> bool:
    client = _get_client()
    result = (
        client.table("platform_connections")
        .delete()
        .eq("adkio_account_id", account_id)
        .eq("platform", platform)
        .execute()
    )
    return bool(result.data)


def mark_validated(account_id: str, platform: str) -> None:
    client = _get_client()
    client.table("platform_connections").update(
        {"last_validated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("adkio_account_id", account_id).eq("platform", platform).execute()
