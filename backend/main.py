"""
Adkio — FastAPI entry point.

Endpoints:
  GET  /health
  POST /campaign              → SSE stream del agente hasta plan_ready
  POST /campaign/approve      → lanza campaña, retorna reporte
  GET  /campaign/{id}         → estado de una campaña en memoria
  GET  /campaigns             → historial de campañas desde Supabase
  DELETE /campaigns/{id}      → borra campaña de Supabase (hard delete)
  POST /onboarding/start
  POST /onboarding/message
  GET  /brand-config/{brand_id}
"""
import logging
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

# ── Startup env validation ─────────────────────────────────────────────────
# Fail fast if critical vars are missing — better than a cryptic 500 later.
_REQUIRED_VARS = ["SUPABASE_URL", "GROQ_API_KEY"]
_missing = [v for v in _REQUIRED_VARS if not os.environ.get(v)]
if _missing:
    print(f"[Adkio] FATAL: missing env vars: {', '.join(_missing)}", file=sys.stderr)
    # Don't crash in development if Supabase is absent — just warn
    if os.environ.get("ENVIRONMENT") == "production":
        sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, field_validator, model_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

try:
    from backend.agents.campaign_agent import run_campaign_agent, approve_and_launch
    _campaign_agent_available = True
except ImportError:
    _campaign_agent_available = False

from backend.agents.onboarding_agent import onboarding_agent
from backend.db.supabase_client import (
    get_brand_config,
    list_campaigns,
    delete_campaign,
)
from backend.auth.router import router as auth_router
from backend.api.connections import router as connections_router
from backend.middleware.tenant import tenant_middleware

# ── Rate limiter (in-memory, no Redis needed for demo) ─────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Adkio API", version="0.2.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(auth_router)
app.include_router(connections_router)

# Tenant middleware — debe quedar DESPUÉS de CORS y de security_headers para
# que ambos se apliquen incluso a respuestas 401 del middleware.
app.middleware("http")(tenant_middleware)

# ── CORS ───────────────────────────────────────────────────────────────────
_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:4173",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# ── Security headers middleware ────────────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response

# ── API key auth ───────────────────────────────────────────────────────────
_API_KEY = os.environ.get("ADKIO_API_KEY", "")

async def require_api_key(request: Request) -> None:
    """Reject LLM-touching endpoints if no valid API key header is sent."""
    if not _API_KEY:
        # Key not configured — open in dev, log a warning
        logger.warning("ADKIO_API_KEY not set — endpoint is unprotected")
        return
    client_key = request.headers.get("X-API-Key", "")
    if client_key != _API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

# ── Prompt injection guard ─────────────────────────────────────────────────
_INJECTION_PATTERNS = re.compile(
    r"(ignore (previous|all) instructions?|"
    r"you are now|forget everything|"
    r"new persona|act as (a|an|if)|"
    r"disregard (your|all)|"
    r"system prompt|<\|im_start\|>|<\|endoftext\|>)",
    re.IGNORECASE,
)

def _check_injection(text: str) -> None:
    if _INJECTION_PATTERNS.search(text):
        logger.warning("Prompt injection attempt blocked: %.120s", text)
        raise HTTPException(status_code=400, detail="Invalid input")

# ── In-memory stores ───────────────────────────────────────────────────────
_campaigns: dict[str, dict] = {}
_conversations: dict[str, list[dict]] = {}

# ── Request schemas ────────────────────────────────────────────────────────
_MAX_PROMPT_CHARS = 2000
_MAX_MESSAGE_CHARS = 1000

class CampaignRequest(BaseModel):
    user_prompt: str
    brand_id: str = "demo-edu-latam"
    # Opcional — si el usuario elige plataforma desde la UI, el agente la respeta
    platform_hint: Optional[str] = None

    @field_validator("user_prompt")
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("user_prompt no puede estar vacío")
        if len(v) > _MAX_PROMPT_CHARS:
            raise ValueError(f"user_prompt excede {_MAX_PROMPT_CHARS} caracteres")
        # Strip control characters
        v = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", v)
        return v

    @field_validator("brand_id")
    @classmethod
    def validate_brand_id(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[a-zA-Z0-9_\-]{1,64}$", v):
            raise ValueError("brand_id inválido")
        return v

    @field_validator("platform_hint")
    @classmethod
    def validate_platform_hint(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if v not in ("meta", "tiktok", "google_ads"):
            raise ValueError("platform_hint debe ser meta, tiktok o google_ads")
        return v


class ApproveRequest(BaseModel):
    plan: dict

    @model_validator(mode="after")
    def validate_plan_size(self) -> "ApproveRequest":
        import json
        if len(json.dumps(self.plan)) > 20_000:
            raise ValueError("plan payload demasiado grande")
        return self


class OnboardingMessageRequest(BaseModel):
    conversation_id: str
    user_message: str

    @field_validator("conversation_id")
    @classmethod
    def validate_conv_id(cls, v: str) -> str:
        if not re.match(r"^[a-f0-9\-]{36}$", v):
            raise ValueError("conversation_id inválido")
        return v

    @field_validator("user_message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("user_message no puede estar vacío")
        if len(v) > _MAX_MESSAGE_CHARS:
            raise ValueError(f"user_message excede {_MAX_MESSAGE_CHARS} caracteres")
        v = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", v)
        return v


class OnboardingMessageResponse(BaseModel):
    conversation_id: str
    type: str
    message: Optional[str] = None
    brand_id: Optional[str] = None
    brand_config: Optional[dict] = None
    confidence_score: float


# ── Global error handler — no stack traces to clients ─────────────────────
@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ── Health ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "model": os.environ.get("LLM_MODEL", "groq/llama-3.3-70b-versatile"),
        "environment": os.environ.get("ENVIRONMENT", "sandbox"),
        "campaign_agent": _campaign_agent_available,
    }


# ── Campaign endpoints ─────────────────────────────────────────────────────
@app.post("/campaign")
@limiter.limit("10/minute")
async def create_campaign(
    request: Request,
    body: CampaignRequest,
    _auth: None = Depends(require_api_key),
) -> StreamingResponse:
    if not _campaign_agent_available:
        raise HTTPException(status_code=503, detail="Campaign agent no disponible")

    _check_injection(body.user_prompt)

    async def generate():
        async for chunk in run_campaign_agent(body.user_prompt, body.brand_id, platform_hint=body.platform_hint):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/campaign/approve")
@limiter.limit("10/minute")
async def approve_campaign(
    request: Request,
    body: ApproveRequest,
    _auth: None = Depends(require_api_key),
) -> dict:
    if not _campaign_agent_available:
        raise HTTPException(status_code=503, detail="Campaign agent no disponible")

    # Inyectamos account_id al plan para que approve_and_launch lo pase a
    # create_campaign_result. Si no hay JWT (demo single-tenant), va None y la
    # fila queda asociada solo al brand_id (no aparece para cuentas multitenant).
    plan_with_account = dict(body.plan)
    plan_with_account["_account_id"] = getattr(request.state, "account_id", None)

    result = await approve_and_launch(plan_with_account)

    campaign_id = result.get("campaign_id", f"adkio_{int(datetime.now(timezone.utc).timestamp())}")
    _campaigns[campaign_id] = {
        **result,
        "plan": body.plan,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return result


@app.get("/campaign/{campaign_id}")
async def get_campaign(campaign_id: str) -> dict:
    campaign = _campaigns.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@app.get("/campaigns")
@limiter.limit("30/minute")
async def get_campaigns(
    request: Request,
    brand_id: str = "demo-edu-latam",
    limit: int = 50,
) -> list:
    if limit > 100:
        limit = 100
    # Multitenant: si hay JWT, filtramos por account_id (ignoramos brand_id —
    # cada usuario solo ve sus campañas).
    # Single-tenant demo: sin JWT, filtramos por brand_id como antes.
    account_id = getattr(request.state, "account_id", None)
    if account_id:
        return list_campaigns(account_id=account_id, limit=limit)
    return list_campaigns(brand_id=brand_id, limit=limit)


@app.delete("/campaigns/{campaign_id}")
@limiter.limit("20/minute")
async def remove_campaign(
    request: Request,
    campaign_id: str,
    _auth: None = Depends(require_api_key),
) -> dict:
    """Hard-delete a campaign row from Supabase."""
    if not re.match(r"^[a-zA-Z0-9_\-]{1,128}$", campaign_id):
        raise HTTPException(status_code=400, detail="campaign_id inválido")
    deleted = delete_campaign(campaign_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"deleted": campaign_id}


# ── Onboarding endpoints ───────────────────────────────────────────────────
@app.post("/onboarding/start")
@limiter.limit("20/minute")
async def onboarding_start(request: Request) -> dict:
    conversation_id = str(uuid.uuid4())
    first_message = (
        "¡Hola! Soy Adkio. Para configurar tu marca y empezar a crear campañas, "
        "necesito conocerte un poco. ¿Cómo se llama tu negocio y a qué se dedica?"
    )
    _conversations[conversation_id] = [{"role": "assistant", "content": first_message}]
    return {"conversation_id": conversation_id, "message": first_message}


@app.post("/onboarding/message", response_model=OnboardingMessageResponse)
@limiter.limit("20/minute")
async def onboarding_message(
    request: Request,
    req: OnboardingMessageRequest,
    _auth: None = Depends(require_api_key),
) -> OnboardingMessageResponse:
    _check_injection(req.user_message)
    history = _conversations.get(req.conversation_id, [])

    result = onboarding_agent.process_message(
        conversation_id=req.conversation_id,
        user_message=req.user_message,
        history=history,
    )

    new_history = history + [{"role": "user", "content": req.user_message}]
    if result["type"] == "question":
        new_history.append({"role": "assistant", "content": result["message"]})
    elif result["type"] == "config":
        new_history.append({"role": "assistant", "content": f"Config generado. ID: {result.get('brand_id')}"})
    _conversations[req.conversation_id] = new_history

    return OnboardingMessageResponse(conversation_id=req.conversation_id, **result)


# ── Whitelist / Tally webhook ──────────────────────────────────────────────
class WhitelistEntry(BaseModel):
    email: str
    nombre: str
    tipo_cuenta: str = "independiente"
    nombre_empresa: Optional[str] = None
    whatsapp: Optional[str] = None
    ad_spend_mensual: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("email inválido")
        return v

    @field_validator("tipo_cuenta")
    @classmethod
    def validate_tipo(cls, v: str) -> str:
        if v not in ("empresa", "independiente"):
            return "independiente"
        return v


def _extract_tally_field(fields: list[dict], label: str) -> Optional[str]:
    """Busca un campo de Tally por label (case-insensitive).
    Resuelve option IDs a texto para multiple choice / dropdown."""
    label_lower = label.lower()
    for f in fields:
        if f.get("label", "").lower() != label_lower:
            continue
        value = f.get("value")
        if value is None or value == "":
            return None
        # Multiple choice / dropdown — value es un array de IDs, resolvemos contra options
        if isinstance(value, list):
            if not value:
                return None
            options = {o.get("id"): o.get("text") for o in (f.get("options") or [])}
            return options.get(value[0], value[0])
        return str(value)
    return None


@app.post("/whitelist/tally-webhook")
@limiter.limit("30/minute")
async def tally_webhook(request: Request) -> dict:
    """
    Recibe el payload de Tally y guarda la entrada en la tabla whitelist de Supabase.
    Tally envía: { eventId, eventType, createdAt, data: { fields: [...] } }
    """
    from backend.db.supabase_client import _get_client
    supabase = _get_client()

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Payload inválido")

    fields: list[dict] = payload.get("data", {}).get("fields", [])
    if not fields:
        raise HTTPException(status_code=400, detail="No se encontraron campos en el payload")

    # Mapear campos del form — los labels deben coincidir exactamente con los de Tally
    email = _extract_tally_field(fields, "Email")
    nombre = _extract_tally_field(fields, "Nombre")
    tipo_cuenta = _extract_tally_field(fields, "Tipo de cuenta") or "independiente"
    nombre_empresa = _extract_tally_field(fields, "Nombre de empresa")
    whatsapp = _extract_tally_field(fields, "WhatsApp")
    ad_spend = _extract_tally_field(fields, "¿Cuánto gastás en ads por mes?")

    if not email or not nombre:
        raise HTTPException(status_code=422, detail="Email y nombre son requeridos")

    try:
        entry = WhitelistEntry(
            email=email,
            nombre=nombre,
            tipo_cuenta=tipo_cuenta,
            nombre_empresa=nombre_empresa,
            whatsapp=whatsapp,
            ad_spend_mensual=ad_spend,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    result = (
        supabase.table("whitelist")
        .upsert(entry.model_dump(exclude_none=True), on_conflict="email")
        .execute()
    )

    logger.info("Whitelist entry saved: %s", entry.email)
    return {"ok": True, "email": entry.email}


@app.get("/brand-config/{brand_id}")
@limiter.limit("30/minute")
async def get_brand(request: Request, brand_id: str) -> dict:
    if not re.match(r"^[a-zA-Z0-9_\-]{1,64}$", brand_id):
        raise HTTPException(status_code=400, detail="brand_id inválido")
    config = get_brand_config(brand_id)
    if not config:
        raise HTTPException(status_code=404, detail=f"Brand config '{brand_id}' no encontrado")
    return config
