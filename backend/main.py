"""
Adkio — FastAPI entry point.

Endpoints:
  GET  /health
  POST /campaign          → SSE stream del agente hasta plan_ready
  POST /campaign/approve  → lanza la campaña y devuelve reporte
  GET  /campaign/{id}     → estado de la campaña
"""
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.agents.campaign_agent import run_campaign_agent, approve_and_launch

app = FastAPI(title="Adkio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory campaign store — replaced by Supabase when Objetivo B lands
_campaigns: dict[str, dict] = {}


# ── Request / Response schemas ─────────────────────────────────────────────


class CampaignRequest(BaseModel):
    user_prompt: str
    brand_id: str = "demo-edu-latam"


class ApproveRequest(BaseModel):
    plan: dict


# ── Endpoints ──────────────────────────────────────────────────────────────


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "model": os.environ.get("LLM_MODEL", "groq/llama-3.3-70b-versatile"),
        "environment": os.environ.get("ENVIRONMENT", "sandbox"),
    }


@app.post("/campaign")
async def create_campaign(body: CampaignRequest) -> StreamingResponse:
    """
    Streams SSE events as the agent works:
      event: tool_start   data: {tool, args}
      event: tool_result  data: {tool, result}
      event: plan_ready   data: {plan}
      event: error        data: {message}
    """
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
    """
    Receives the plan from the plan_ready SSE event.
    Calls campaign_launcher → report_generator.
    Returns {campaign_id, status, estimated_reach, preview_url, report}.
    """
    try:
        result = await approve_and_launch(body.plan)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    campaign_id = result.get("campaign_id", f"adkio_{int(datetime.now(timezone.utc).timestamp())}")

    _campaigns[campaign_id] = {
        "campaign_id": campaign_id,
        "status": result.get("status"),
        "estimated_reach": result.get("estimated_reach"),
        "preview_url": result.get("preview_url"),
        "report": result.get("report"),
        "plan": body.plan,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    return result


@app.get("/campaign/{campaign_id}")
async def get_campaign(campaign_id: str) -> dict:
    """
    Returns the stored campaign state by ID.
    campaign_id comes from the POST /campaign/approve response.
    """
    campaign = _campaigns.get(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign '{campaign_id}' not found")
    return campaign
