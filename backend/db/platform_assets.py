"""Repositorio Supabase para la tabla `platform_assets` (migración 007).

Una credencial OAuth alcanza N ad accounts, N páginas y N cuentas de Instagram.
Cada uno es una fila acá; `is_selected` marca el que usa el launcher.

Las funciones aceptan un `client` opcional para que el `DBCredentialResolver`
pueda pasar el suyo (inyectado por request) en vez del global.
"""
from __future__ import annotations

from typing import Optional

from backend.db.supabase_client import _get_client

ASSET_TYPES = ("ad_account", "page", "instagram")

# Lo que el frontend necesita para pintar el picker. El resto de columnas
# (`connection_id`, `extra_jsonb`) no sale de la API.
_PUBLIC_FIELDS = (
    "id, asset_type, external_id, name, parent_external_id, is_selected"
)


def upsert_assets(
    connection_id: str, assets: list[dict], client=None
) -> list[dict]:
    """Inserta los assets descubiertos sin pisar la elección del cliente.

    `is_selected` se omite del payload a propósito: al re-descubrir (cada OAuth)
    el upsert refresca nombres pero no mueve el asset elegido.
    """
    if not assets:
        return []
    db = client or _get_client()
    payload = []
    for a in assets:
        asset_type = a.get("asset_type")
        external_id = str(a.get("external_id") or "").strip()
        if asset_type not in ASSET_TYPES or not external_id:
            continue
        payload.append(
            {
                "connection_id": connection_id,
                "asset_type": asset_type,
                "external_id": external_id,
                "name": a.get("name"),
                "parent_external_id": a.get("parent_external_id"),
                "extra_jsonb": a.get("extra") or {},
            }
        )
    if not payload:
        return []
    result = (
        db.table("platform_assets")
        .upsert(payload, on_conflict="connection_id,asset_type,external_id")
        .execute()
    )
    return result.data or []


def list_assets(
    connection_id: str, asset_type: Optional[str] = None, client=None
) -> list[dict]:
    """Assets de una conexión, opcionalmente filtrados por tipo."""
    db = client or _get_client()
    query = (
        db.table("platform_assets")
        .select(_PUBLIC_FIELDS)
        .eq("connection_id", connection_id)
    )
    if asset_type:
        query = query.eq("asset_type", asset_type)
    result = query.execute()
    return result.data or []


def select_asset(
    connection_id: str, asset_type: str, external_id: str, client=None
) -> bool:
    """Marca un asset como el elegido y desmarca el anterior del mismo tipo.

    El orden importa: hay un índice único parcial sobre
    `(connection_id, asset_type) WHERE is_selected`, así que primero se limpia y
    después se marca. Si el segundo update falla, la conexión queda sin elegido
    —degradado y recuperable— en vez de violar el índice.
    """
    if asset_type not in ASSET_TYPES:
        raise ValueError(f"asset_type inválido: {asset_type!r}")
    db = client or _get_client()
    db.table("platform_assets").update({"is_selected": False}).eq(
        "connection_id", connection_id
    ).eq("asset_type", asset_type).execute()

    result = (
        db.table("platform_assets")
        .update({"is_selected": True})
        .eq("connection_id", connection_id)
        .eq("asset_type", asset_type)
        .eq("external_id", external_id)
        .execute()
    )
    return bool(result.data)


def selected_assets(connection_id: str, client=None) -> dict[str, dict]:
    """Los assets elegidos, indexados por `asset_type`. Lo que lee el resolver."""
    db = client or _get_client()
    result = (
        db.table("platform_assets")
        .select(_PUBLIC_FIELDS)
        .eq("connection_id", connection_id)
        .eq("is_selected", True)
        .execute()
    )
    return {row["asset_type"]: row for row in (result.data or [])}


def select_default_if_none(
    connection_id: str, asset_type: str, external_id: str, client=None
) -> None:
    """Elige `external_id` sólo si la conexión todavía no tiene elegido de ese tipo.

    Se llama al terminar el OAuth: el cliente entra al picker con algo puesto,
    pero volver a conectar no le pisa lo que ya había elegido.
    """
    db = client or _get_client()
    existing = selected_assets(connection_id, client=db)
    if asset_type in existing:
        return
    select_asset(connection_id, asset_type, external_id, client=db)
