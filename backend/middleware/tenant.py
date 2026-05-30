"""Middleware FastAPI que valida el JWT y pone `account_id` en `request.state`.

Rutas públicas (no requieren JWT):
  /health, /auth/*, /docs, /openapi.json, /redoc, /connect/*/callback (OAuth)

Comportamiento:
  ADKIO_REQUIRE_AUTH=true   → modo estricto (multi-tenant en producción)
                              Sin JWT en rutas privadas → 401.
                              JWT inválido/expirado → 401.
  ADKIO_REQUIRE_AUTH=false  → modo permisivo (transición / demo)  [DEFAULT]
                              Si hay JWT válido → puebla request.state.account_id.
                              Si no hay JWT → request.state.account_id = None y la
                              request pasa (downstream cae a EnvCredentialResolver).

El campo `request.state.account_id` queda disponible para handlers downstream
(p.ej. para instanciar `DBCredentialResolver(account_id=...)`).
"""
from __future__ import annotations

import os

from fastapi import Request
from fastapi.responses import JSONResponse

from backend.auth.jwt_tokens import decode_token
from backend.services.credential_resolver import (
    DBCredentialResolver,
    set_current_resolver,
)


# Estas rutas son completamente públicas — no decodificamos JWT.
PUBLIC_PREFIXES = (
    "/health",
    "/auth/signup",
    "/auth/login",
    "/auth/refresh",
    "/docs",
    "/redoc",
    "/openapi.json",
)

# OAuth callbacks deben ser públicas — el provider redirige sin nuestro JWT.
PUBLIC_SUFFIXES = ("/callback",)


def _is_public(path: str) -> bool:
    if any(path.startswith(p) for p in PUBLIC_PREFIXES):
        return True
    if any(path.endswith(s) for s in PUBLIC_SUFFIXES):
        return True
    return False


def _require_auth() -> bool:
    return os.environ.get("ADKIO_REQUIRE_AUTH", "false").lower() == "true"


async def tenant_middleware(request: Request, call_next):
    request.state.account_id = None
    request.state.email = None
    set_current_resolver(None)  # reset por request

    # Preflight CORS: dejar pasar siempre
    if request.method == "OPTIONS":
        return await call_next(request)

    if _is_public(request.url.path):
        return await call_next(request)

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        payload = decode_token(auth[7:])
        if payload and payload.get("type") == "access" and payload.get("account_id"):
            request.state.account_id = payload["account_id"]
            request.state.email = payload.get("email")
            # Inyectamos un DBCredentialResolver para esta request.
            # Las tools que reciban resolver=None van a usarlo via get_default_resolver().
            try:
                from backend.db.supabase_client import _get_client

                set_current_resolver(
                    DBCredentialResolver(
                        account_id=payload["account_id"],
                        supabase_client=_get_client(),
                    )
                )
            except Exception:
                # Si Supabase no está disponible, dejamos fallar al EnvResolver default
                pass
        elif _require_auth():
            return JSONResponse(
                status_code=401, content={"detail": "invalid or expired token"}
            )

    if _require_auth() and not request.state.account_id:
        return JSONResponse(
            status_code=401, content={"detail": "missing bearer token"}
        )

    return await call_next(request)
