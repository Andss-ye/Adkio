"""OAuth flows + CRUD de `platform_connections`.

Rutas:
  GET    /connect/status                 → qué plataformas tiene conectadas el user
  GET    /connect/meta                   → redirige a Facebook OAuth
  GET    /connect/meta/callback          → recibe code, intercambia, persiste
  GET    /connect/tiktok                 → redirige a TikTok Business OAuth
  GET    /connect/tiktok/callback
  GET    /connect/google_ads             → redirige a Google OAuth
  GET    /connect/google_ads/callback
  DELETE /connect/{platform}             → borra la conexión

OAuth `state` se firma con JWT_SECRET y lleva `account_id` + un nonce. Eso
permite que el callback (que viene sin nuestro Bearer) sepa de quién es la
conexión sin trustear al cliente.

Para los providers reales se requieren las app credentials en .env. Si faltan,
el endpoint devuelve un error claro en vez de romper.
"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from backend.auth.jwt_tokens import decode_token
from backend.db.platform_connections import (
    delete_connection,
    list_connections,
    upsert_connection,
)
from backend.security.token_crypto import encrypt_token
from jose import jwt

router = APIRouter(prefix="/connect", tags=["connect"])

ALG = "HS256"
_FRONTEND_AFTER_OAUTH = os.environ.get(
    "FRONTEND_AFTER_OAUTH_URL", "http://localhost:5173/settings"
)


def _account_id(request: Request) -> str:
    aid = getattr(request.state, "account_id", None)
    if not aid:
        raise HTTPException(status_code=401, detail="login requerido")
    return str(aid)


def _sign_state(account_id: str) -> str:
    """Firma un state token corto (10 min) con account_id + nonce."""
    secret = os.environ.get("JWT_SECRET", "")
    if not secret:
        raise HTTPException(status_code=500, detail="JWT_SECRET no configurada")
    payload = {
        "account_id": account_id,
        "nonce": secrets.token_urlsafe(16),
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=10)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=ALG)


def _verify_state(state: str) -> str:
    payload = decode_token(state)
    if not payload or not payload.get("account_id"):
        raise HTTPException(status_code=400, detail="state OAuth inválido o expirado")
    return str(payload["account_id"])


def _frontend_redirect(success: bool, platform: str, message: str = "") -> RedirectResponse:
    qs = urlencode({"connect": platform, "status": "ok" if success else "error", "msg": message})
    return RedirectResponse(url=f"{_FRONTEND_AFTER_OAUTH}?{qs}")


# ── Status / Delete ────────────────────────────────────────────────────────


@router.get("/status")
async def status(request: Request) -> dict:
    aid = _account_id(request)
    conns = list_connections(aid)
    return {"connections": conns}


@router.delete("/{platform}")
async def disconnect(request: Request, platform: str) -> dict:
    if platform not in ("meta", "tiktok", "google_ads"):
        raise HTTPException(status_code=400, detail="platform inválida")
    aid = _account_id(request)
    deleted = delete_connection(aid, platform)
    return {"deleted": deleted, "platform": platform}


# ── Meta OAuth ─────────────────────────────────────────────────────────────


@router.get("/meta")
async def meta_authorize(request: Request) -> dict:
    """Devuelve {authorize_url} para que el frontend navegue. El frontend no puede
    seguir un redirect cross-origin con credentials, por eso retornamos JSON."""
    aid = _account_id(request)
    app_id = os.environ.get("META_APP_ID", "")
    redirect = os.environ.get(
        "META_OAUTH_REDIRECT_URI", "http://localhost:8000/connect/meta/callback"
    )
    if not app_id:
        raise HTTPException(status_code=500, detail="META_APP_ID no configurada")
    params = {
        "client_id": app_id,
        "redirect_uri": redirect,
        "state": _sign_state(aid),
        "scope": "ads_management,ads_read,pages_manage_ads,pages_read_engagement",
        "response_type": "code",
    }
    return {
        "authorize_url": f"https://www.facebook.com/v20.0/dialog/oauth?{urlencode(params)}"
    }


@router.get("/meta/callback")
async def meta_callback(code: str = "", state: str = "") -> RedirectResponse:
    if not code or not state:
        return _frontend_redirect(False, "meta", "missing code/state")

    try:
        account_id = _verify_state(state)
    except HTTPException as e:
        return _frontend_redirect(False, "meta", e.detail)

    app_id = os.environ.get("META_APP_ID", "")
    app_secret = os.environ.get("META_APP_SECRET", "")
    redirect = os.environ.get(
        "META_OAUTH_REDIRECT_URI", "http://localhost:8000/connect/meta/callback"
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # 1. Code → short-lived access token
            r = await client.get(
                "https://graph.facebook.com/v20.0/oauth/access_token",
                params={
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "redirect_uri": redirect,
                    "code": code,
                },
            )
            r.raise_for_status()
            short_token = r.json()["access_token"]

            # 2. Short-lived → long-lived (60 días)
            r = await client.get(
                "https://graph.facebook.com/v20.0/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "fb_exchange_token": short_token,
                },
            )
            r.raise_for_status()
            long_token = r.json()["access_token"]
            expires_in = r.json().get("expires_in", 60 * 86400)

            # 3. Listar ad accounts disponibles
            r = await client.get(
                "https://graph.facebook.com/v20.0/me/adaccounts",
                params={"access_token": long_token, "fields": "id,name,account_id"},
            )
            r.raise_for_status()
            adaccounts = r.json().get("data", [])
    except httpx.HTTPError as e:
        return _frontend_redirect(False, "meta", f"oauth_error: {str(e)[:80]}")

    if not adaccounts:
        return _frontend_redirect(False, "meta", "no ad accounts visibles para este usuario")

    # MVP: tomamos el primero — frontend puede ofrecer cambiar después
    primary = adaccounts[0]
    ad_account_id = primary["id"]  # ya viene como "act_XXX"

    upsert_connection(
        account_id=account_id,
        platform="meta",
        provider_account_id=ad_account_id,
        access_token_encrypted=encrypt_token(long_token),
        token_expires_at=datetime.now(timezone.utc) + timedelta(seconds=int(expires_in)),
        extra={
            "app_id": app_id,
            "app_secret": app_secret,
            "page_id": os.environ.get("META_PAGE_ID"),
            "available_ad_accounts": [
                {"id": a["id"], "name": a.get("name")} for a in adaccounts
            ],
        },
        scopes=["ads_management", "ads_read", "pages_manage_ads", "pages_read_engagement"],
    )

    return _frontend_redirect(True, "meta")


# ── TikTok OAuth ───────────────────────────────────────────────────────────


@router.get("/tiktok")
async def tiktok_authorize(request: Request) -> dict:
    aid = _account_id(request)
    app_id = os.environ.get("TIKTOK_APP_ID", "")
    redirect = os.environ.get(
        "TIKTOK_OAUTH_REDIRECT_URI", "http://localhost:8000/connect/tiktok/callback"
    )
    if not app_id:
        raise HTTPException(status_code=500, detail="TIKTOK_APP_ID no configurada")
    params = {"app_id": app_id, "redirect_uri": redirect, "state": _sign_state(aid)}
    return {
        "authorize_url": f"https://business-api.tiktok.com/portal/auth?{urlencode(params)}"
    }


@router.get("/tiktok/callback")
async def tiktok_callback(
    auth_code: str = "", state: str = "", code: str = ""
) -> RedirectResponse:
    auth_code = auth_code or code  # TikTok manda `auth_code`, algunos providers `code`
    if not auth_code or not state:
        return _frontend_redirect(False, "tiktok", "missing auth_code/state")

    try:
        account_id = _verify_state(state)
    except HTTPException as e:
        return _frontend_redirect(False, "tiktok", e.detail)

    app_id = os.environ.get("TIKTOK_APP_ID", "")
    app_secret = os.environ.get("TIKTOK_APP_SECRET", "")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
                json={"app_id": app_id, "secret": app_secret, "auth_code": auth_code},
            )
            r.raise_for_status()
            body = r.json().get("data") or {}
    except httpx.HTTPError as e:
        return _frontend_redirect(False, "tiktok", f"oauth_error: {str(e)[:80]}")

    access_token = body.get("access_token")
    advertiser_ids = body.get("advertiser_ids") or []
    if not access_token or not advertiser_ids:
        return _frontend_redirect(False, "tiktok", "respuesta incompleta de TikTok")

    primary = advertiser_ids[0]
    upsert_connection(
        account_id=account_id,
        platform="tiktok",
        provider_account_id=str(primary),
        access_token_encrypted=encrypt_token(access_token),
        extra={
            "app_id": app_id,
            "app_secret": app_secret,
            "available_advertiser_ids": advertiser_ids,
            "scope": body.get("scope"),
        },
        scopes=body.get("scope", "").split(",") if body.get("scope") else [],
    )
    return _frontend_redirect(True, "tiktok")


# ── Google Ads OAuth ───────────────────────────────────────────────────────


@router.get("/google_ads")
async def google_authorize(request: Request) -> dict:
    aid = _account_id(request)
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
    redirect = os.environ.get(
        "GOOGLE_OAUTH_REDIRECT_URI",
        "http://localhost:8000/connect/google_ads/callback",
    )
    if not client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_OAUTH_CLIENT_ID no configurada")
    params = {
        "client_id": client_id,
        "redirect_uri": redirect,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/adwords",
        "access_type": "offline",
        "prompt": "consent",
        "state": _sign_state(aid),
    }
    return {
        "authorize_url": f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    }


@router.get("/google_ads/callback")
async def google_callback(code: str = "", state: str = "") -> RedirectResponse:
    if not code or not state:
        return _frontend_redirect(False, "google_ads", "missing code/state")

    try:
        account_id = _verify_state(state)
    except HTTPException as e:
        return _frontend_redirect(False, "google_ads", e.detail)

    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
    redirect = os.environ.get(
        "GOOGLE_OAUTH_REDIRECT_URI",
        "http://localhost:8000/connect/google_ads/callback",
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect,
                    "grant_type": "authorization_code",
                },
            )
            r.raise_for_status()
            body = r.json()
    except httpx.HTTPError as e:
        return _frontend_redirect(False, "google_ads", f"oauth_error: {str(e)[:80]}")

    access_token = body.get("access_token")
    refresh_token = body.get("refresh_token")
    expires_in = body.get("expires_in", 3600)

    if not refresh_token:
        return _frontend_redirect(
            False, "google_ads", "Google no devolvió refresh_token — revocá acceso y reintentá"
        )

    # customer_id se completa luego con un endpoint POST /connect/google_ads/customer
    # (el usuario lo elige en el frontend). Hasta entonces guardamos vacío.
    customer_id = ""

    upsert_connection(
        account_id=account_id,
        platform="google_ads",
        provider_account_id=customer_id or "pending",
        access_token_encrypted=encrypt_token(access_token),
        refresh_token_encrypted=encrypt_token(refresh_token),
        token_expires_at=datetime.now(timezone.utc) + timedelta(seconds=int(expires_in)),
        extra={
            "client_id": client_id,
            "client_secret": client_secret,
            "needs_customer_id": True,
        },
        scopes=["https://www.googleapis.com/auth/adwords"],
    )
    return _frontend_redirect(True, "google_ads", "Falta elegir customer_id en Settings")


class _SetCustomerBody(__import__("pydantic").BaseModel):
    customer_id: str


@router.post("/google_ads/customer")
async def google_set_customer(request: Request, body: _SetCustomerBody) -> dict:
    """Permite que el usuario elija el customer_id (10 dígitos) después del OAuth."""
    aid = _account_id(request)
    customer_id = body.customer_id.replace("-", "").strip()
    if not customer_id.isdigit() or len(customer_id) != 10:
        raise HTTPException(status_code=400, detail="customer_id debe ser 10 dígitos")

    from backend.db.supabase_client import _get_client

    client = _get_client()
    result = (
        client.table("platform_connections")
        .update({"provider_account_id": customer_id})
        .eq("adkio_account_id", aid)
        .eq("platform", "google_ads")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="conexión google_ads no encontrada")
    return {"customer_id": customer_id, "ok": True}


# ── Manual API key entry ───────────────────────────────────────────────────
# Para cuando OAuth no está aprobado por el provider todavía (Meta tarda ~2
# semanas en App Review). El usuario pega su access_token + account_id desde
# el dashboard nativo del provider (Graph Explorer / TikTok Sandbox / Google
# generate_user_credentials.py) y nosotros lo encriptamos como si viniera de
# OAuth. Mismo schema en platform_connections, mismo resolver consumiéndolo.


from typing import Any


class _ManualConnectBody(__import__("pydantic").BaseModel):
    access_token: str
    provider_account_id: str
    refresh_token: Optional[str] = None
    extra: Optional[dict[str, Any]] = None


_VALID_MANUAL_PLATFORMS = ("meta", "tiktok", "google_ads")


@router.post("/{platform}/manual")
async def manual_connect(
    request: Request, platform: str, body: _ManualConnectBody
) -> dict:
    """Conecta una plataforma pegando access_token + provider_account_id manualmente.

    Útil cuando el OAuth del provider está pendiente de aprobación.
    El access_token se cifra con Fernet antes de persistir.
    """
    if platform not in _VALID_MANUAL_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"plataforma inválida: {platform}")

    aid = _account_id(request)

    access = body.access_token.strip()
    pid = body.provider_account_id.strip()
    if not access or not pid:
        raise HTTPException(status_code=400, detail="access_token y provider_account_id requeridos")

    # Normalización mínima por plataforma
    if platform == "meta" and not pid.startswith("act_") and pid.isdigit():
        pid = f"act_{pid}"
    if platform == "google_ads":
        pid = pid.replace("-", "")
        if not pid.isdigit() or len(pid) != 10:
            raise HTTPException(
                status_code=400, detail="Google customer_id debe ser 10 dígitos"
            )

    extra = dict(body.extra or {})
    extra["manual_entry"] = True
    # Fallback a env globales de Adkio si vienen en config
    if platform == "meta":
        extra.setdefault("app_id", os.environ.get("META_APP_ID", ""))
        extra.setdefault("app_secret", os.environ.get("META_APP_SECRET", ""))
        extra.setdefault("page_id", os.environ.get("META_PAGE_ID"))
    if platform == "tiktok":
        extra.setdefault("app_id", os.environ.get("TIKTOK_APP_ID", ""))
        extra.setdefault("app_secret", os.environ.get("TIKTOK_APP_SECRET", ""))
    if platform == "google_ads":
        extra.setdefault("client_id", os.environ.get("GOOGLE_OAUTH_CLIENT_ID", ""))
        extra.setdefault("client_secret", os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", ""))

    refresh_enc = encrypt_token(body.refresh_token) if body.refresh_token else None

    upsert_connection(
        account_id=aid,
        platform=platform,
        provider_account_id=pid,
        access_token_encrypted=encrypt_token(access),
        refresh_token_encrypted=refresh_enc,
        extra=extra,
        scopes=[],
    )
    return {"ok": True, "platform": platform, "provider_account_id": pid}
