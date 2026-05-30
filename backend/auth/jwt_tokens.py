"""JWT encode/decode. Emite access + refresh tokens con `account_id` en el payload."""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Optional

from jose import jwt, JWTError

ALG = "HS256"

ACCESS_TOKEN_TTL_MINUTES = int(os.environ.get("ACCESS_TOKEN_TTL_MINUTES", "60"))
REFRESH_TOKEN_TTL_DAYS = int(os.environ.get("REFRESH_TOKEN_TTL_DAYS", "30"))


def _secret() -> str:
    s = os.environ.get("JWT_SECRET", "").strip()
    if not s:
        raise RuntimeError(
            "JWT_SECRET no está seteada. Generala con: openssl rand -hex 32"
        )
    return s


def _encode(payload: dict, ttl_seconds: int) -> str:
    now = datetime.now(timezone.utc)
    full = {
        **payload,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
    }
    return jwt.encode(full, _secret(), algorithm=ALG)


def create_access_token(account_id: str, email: str) -> str:
    return _encode(
        {"account_id": account_id, "email": email, "type": "access"},
        ACCESS_TOKEN_TTL_MINUTES * 60,
    )


def create_refresh_token(account_id: str) -> str:
    return _encode(
        {"account_id": account_id, "type": "refresh"},
        REFRESH_TOKEN_TTL_DAYS * 86400,
    )


def decode_token(token: str) -> Optional[dict]:
    """Devuelve el payload si el token es válido y no expiró. None si es inválido."""
    try:
        return jwt.decode(token, _secret(), algorithms=[ALG])
    except JWTError:
        return None
