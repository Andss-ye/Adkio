"""FastAPI router para signup/login/refresh.

Rutas (todas públicas — el middleware tenant las skipea):
  POST /auth/signup    {email, password} -> {access_token, refresh_token, account}
  POST /auth/login     {email, password} -> {access_token, refresh_token, account}
  POST /auth/refresh   {refresh_token}   -> {access_token, refresh_token}
  GET  /auth/me        (con Bearer)      -> {account_id, email, plan}
"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

from backend.auth.jwt_tokens import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from backend.auth.passwords import hash_password, verify_password
from backend.db.accounts import (
    create_account,
    get_account_by_email,
    get_account_by_id,
    set_account_brand,
    update_last_login,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_logger = logging.getLogger(__name__)


def _provision_default_brand(account: dict) -> str | None:
    """Crea una marca por defecto (neutra y editable) para una cuenta nueva y la
    vincula. Best-effort: si falla, no bloquea el signup (el agente cae a
    'demo-edu-latam'). Devuelve el brand_id o None."""
    from backend.db.supabase_client import create_brand_config

    local = (account.get("email") or "mi-negocio").split("@")[0]
    nombre = local.replace(".", " ").replace("_", " ").title() or "Mi negocio"
    try:
        brand_id = create_brand_config(
            {
                "slug": f"acct-{account['id']}",
                "negocio_nombre": nombre,
                "negocio_industria": "general",
                "propuesta_de_valor": "",
                "publico_roles": [],
                "publico_paises": ["Colombia", "Mexico"],
                "publico_edad_min": 18,
                "publico_edad_max": 55,
                "publico_intereses": [],
                "presupuesto_min_campana_usd": 50.0,
                "presupuesto_max_campana_usd": 5000.0,
                "tono_estilo": [],
                "tono_evitar": [],
                "ejemplos_copy_aprobado": [],
                "pixel_configurado": False,
            }
        )
        set_account_brand(account["id"], brand_id)
        return brand_id
    except Exception as exc:  # noqa: BLE001
        _logger.warning("No se pudo provisionar marca por defecto: %s", exc)
        return None


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        # Mínimo: 8 chars + al menos una letra y un número
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("password debe incluir al menos una letra y un número")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


def _tokens_response(account: dict) -> dict:
    return {
        "access_token": create_access_token(account["id"], account["email"]),
        "refresh_token": create_refresh_token(account["id"]),
        "token_type": "Bearer",
        "account": {
            "id": account["id"],
            "email": account["email"],
            "plan": account.get("plan", "starter"),
        },
    }


@router.post("/signup")
async def signup(body: SignupRequest) -> dict:
    email = body.email.lower().strip()
    if get_account_by_email(email):
        raise HTTPException(status_code=409, detail="Email ya registrado")
    account = create_account(email=email, password_hash=hash_password(body.password))
    # Cada cuenta arranca con su propia marca (editable en Settings → Marca).
    _provision_default_brand(account)
    return _tokens_response(account)


@router.post("/login")
async def login(body: LoginRequest) -> dict:
    email = body.email.lower().strip()
    account = get_account_by_email(email)
    if not account or not verify_password(body.password, account["password_hash"]):
        # Mismo mensaje para email no existe vs password inválido → previene user enumeration
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    update_last_login(account["id"])
    return _tokens_response(account)


@router.post("/refresh")
async def refresh(body: RefreshRequest) -> dict:
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token inválido")
    account = get_account_by_id(payload["account_id"])
    if not account:
        raise HTTPException(status_code=401, detail="Account no encontrado")
    return _tokens_response(account)


@router.get("/me")
async def me(request: Request) -> dict:
    """Devuelve datos del account a partir del JWT inyectado por el middleware."""
    account_id = getattr(request.state, "account_id", None)
    if not account_id:
        raise HTTPException(status_code=401, detail="No autenticado")
    account = get_account_by_id(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account no encontrado")
    return account
