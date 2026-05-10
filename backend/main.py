"""
FastAPI entry point — Adkio backend.

Endpoints implementados en este PR (Objetivo B):
  POST /onboarding/message
  GET  /brand-config/{brand_id}
  GET  /health

El Objetivo A agrega: POST /campaign, POST /campaign/approve, GET /campaign/{id}
"""
import os
import uuid
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from backend.agents.onboarding_agent import onboarding_agent
from backend.db.supabase_client import get_brand_config

app = FastAPI(title="Adkio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restringir en producción
    allow_methods=["*"],
    allow_headers=["*"],
)

# Almacén en memoria de historiales de conversación.
# En producción esto va a Redis o Supabase. Para el demo es suficiente.
_conversation_store: dict[str, list[dict]] = {}


# ---------- Modelos ----------

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


# ---------- Endpoints ----------

@app.get("/health")
def health():
    return {"status": "ok", "service": "adkio-backend"}


@app.post("/onboarding/message", response_model=OnboardingMessageResponse)
def onboarding_message(req: OnboardingMessageRequest):
    history = _conversation_store.get(req.conversation_id, [])

    result = onboarding_agent.process_message(
        conversation_id=req.conversation_id,
        user_message=req.user_message,
        history=history,
    )

    # Actualizar historial
    new_history = history + [{"role": "user", "content": req.user_message}]
    if result["type"] == "question":
        new_history.append({"role": "assistant", "content": result["message"]})
    _conversation_store[req.conversation_id] = new_history

    return OnboardingMessageResponse(
        conversation_id=req.conversation_id,
        **result,
    )


@app.get("/brand-config/{brand_id}")
def get_brand(brand_id: str):
    config = get_brand_config(brand_id)
    if not config:
        raise HTTPException(status_code=404, detail=f"Brand config '{brand_id}' no encontrado")
    return config


@app.post("/onboarding/start")
def onboarding_start():
    """Inicia una nueva sesión de onboarding y retorna el primer mensaje."""
    conversation_id = str(uuid.uuid4())
    first_message = (
        "¡Hola! Soy Adkio, tu agente de marketing en Meta Ads. "
        "Para configurar tu marca y empezar a crear campañas, necesito conocerte un poco. "
        "¿Cómo se llama tu negocio y a qué se dedica?"
    )
    _conversation_store[conversation_id] = [
        {"role": "assistant", "content": first_message}
    ]
    return {
        "conversation_id": conversation_id,
        "message": first_message,
    }
