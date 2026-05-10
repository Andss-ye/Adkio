"""
Adkio — FastAPI entry point.

Endpoints Objetivo A (Campaign Agent):
  GET  /health
  POST /campaign          → SSE stream del agente hasta plan_ready
  POST /campaign/approve  → lanza la campaña y devuelve reporte
  GET  /campaign/{id}     → estado de la campaña

Endpoints Objetivo B (Onboarding):
  POST /onboarding/start          → inicia sesión, retorna primer mensaje
  POST /onboarding/message        → procesa turno de conversación
  GET  /brand-config/{brand_id}   → retorna brand_config por UUID o slug
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Campaign Agent (Objetivo A) — graceful import: funciona aunque A no esté mergeado
try:
    from backend.agents.campaign_agent import run_campaign_agent, approve_and_launch
    _campaign_agent_available = True
except ImportError:
    _campaign_agent_available = False

from backend.agents.onboarding_agent import onboarding_agent
from backend.db.supabase_client import get_brand_config

app = FastAPI(title="Adkio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory stores — suficiente para el demo
_campaigns: dict[str, dict] = {}
_conversations: dict[str, list[dict]] = {}


# ── Request / Response schemas ─────────────────────────────────────────────


class CampaignRequest(BaseModel):
    user_prompt: str
    brand_id: str = "demo-edu-latam"


class ApproveRequest(BaseModel):
    plan: dict


class OnboardingMessageRequest(BaseModel):
    conversation_id: str
    user_message: str


class OnboardingMessageResponse(BaseModel):
    conversation_id: str
    type: str                    # "question" | "config"
    message: Optional[str] = None
    brand_id: Optional[str] = None
    brand_config: Optional[dict] = None
    confidence_score: float


# ── Health ─────────────────────────────────────────────────────────────────


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "model": os.environ.get("LLM_MODEL", "groq/llama-3.3-70b-versatile"),
        "environment": os.environ.get("ENVIRONMENT", "sandbox"),
        "campaign_agent": _campaign_agent_available,
    }


# ── Campaign endpoints (Objetivo A) ────────────────────────────────────────


@app.post("/campaign")
async def create_campaign(body: CampaignRequest) -> StreamingResponse:
    """
    Streams SSE events mientras el agente trabaja:
      event: tool_start   data: {tool, args}
      event: tool_result  data: {tool, result}
      event: plan_ready   data: {plan}
      event: error        data: {message}
    """
    if not _campaign_agent_available:
        raise HTTPException(status_code=503, detail="Campaign agent no disponible — esperando merge de Objetivo A")

    async def generate():
        async for chunk in run_campaign_agent(body.user_prompt, body.brand_id):
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
async def approve_campaign(body: ApproveRequest) -> dict:
    if not _campaign_agent_available:
        raise HTTPException(status_code=503, detail="Campaign agent no disponible — esperando merge de Objetivo A")

    try:
        result = await approve_and_launch(body.plan)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")
    return campaign


# ── Onboarding endpoints (Objetivo B) ──────────────────────────────────────


@app.post("/onboarding/start")
async def onboarding_start() -> dict:
    """Inicia una sesión de onboarding. Retorna conversation_id y primer mensaje."""
    conversation_id = str(uuid.uuid4())
    first_message = (
        "¡Hola! Soy Adkio, tu agente de marketing en Meta Ads. "
        "Para configurar tu marca y empezar a crear campañas, necesito conocerte un poco. "
        "¿Cómo se llama tu negocio y a qué se dedica?"
    )
    _conversations[conversation_id] = [{"role": "assistant", "content": first_message}]
    return {"conversation_id": conversation_id, "message": first_message}


@app.post("/onboarding/message", response_model=OnboardingMessageResponse)
async def onboarding_message(req: OnboardingMessageRequest) -> OnboardingMessageResponse:
    """
    Procesa un turno de conversación de onboarding.
    Retorna type="question" mientras confidence_score < 0.85.
    Retorna type="config" con brand_id cuando el config está listo y persistido.
    """
    history = _conversations.get(req.conversation_id, [])

    result = onboarding_agent.process_message(
        conversation_id=req.conversation_id,
        user_message=req.user_message,
        history=history,
    )

    new_history = history + [{"role": "user", "content": req.user_message}]
    if result["type"] == "question":
        new_history.append({"role": "assistant", "content": result["message"]})
    _conversations[req.conversation_id] = new_history

    return OnboardingMessageResponse(conversation_id=req.conversation_id, **result)


@app.get("/brand-config/{brand_id}")
async def get_brand(brand_id: str) -> dict:
    """Retorna brand_config por UUID o por slug (ej: 'demo-edu-latam')."""
    config = get_brand_config(brand_id)
    if not config:
        raise HTTPException(status_code=404, detail=f"Brand config '{brand_id}' no encontrado")
    return config
