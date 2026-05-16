"""Repositorio Supabase para la tabla `accounts`."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from backend.db.supabase_client import _get_client


def create_account(email: str, password_hash: str, plan: str = "starter") -> dict:
    """Inserta un account nuevo. Retorna {id, email, plan, created_at}."""
    client = _get_client()
    result = (
        client.table("accounts")
        .insert(
            {
                "email": email.lower().strip(),
                "password_hash": password_hash,
                "plan": plan,
            }
        )
        .execute()
    )
    if not result.data:
        raise RuntimeError("Supabase no devolvió datos al insertar account")
    return result.data[0]


def get_account_by_email(email: str) -> Optional[dict]:
    client = _get_client()
    result = (
        client.table("accounts")
        .select("*")
        .eq("email", email.lower().strip())
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_account_by_id(account_id: str) -> Optional[dict]:
    client = _get_client()
    result = (
        client.table("accounts")
        .select("id, email, plan, created_at, last_login_at")
        .eq("id", account_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def update_last_login(account_id: str) -> None:
    client = _get_client()
    client.table("accounts").update(
        {"last_login_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", account_id).execute()
