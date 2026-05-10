"""
Campaign Agent — orchestrates the 4-tool pipeline via litellm tool use.

Flow: budget_validator → audience_analyzer → copy_generator → campaign_validator
      (pauses here and streams plan to frontend for human approval)

POST /campaign/approve triggers: campaign_launcher → report_generator
"""
import json
import os
from typing import AsyncGenerator

from backend.llm import call_llm
from backend.tools.budget_validator import budget_validator
from backend.tools.audience_analyzer import audience_analyzer
from backend.tools.copy_generator import copy_generator
from backend.tools.campaign_validator import campaign_validator
from backend.tools.campaign_launcher import campaign_launcher
from backend.tools.report_generator import report_generator

_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "budget_validator",
            "description": (
                "Valida si el presupuesto de la campaña es viable. "
                "Llama esto PRIMERO antes de cualquier otro tool."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "monto_usd": {"type": "number", "description": "Presupuesto total en USD"},
                    "duracion_dias": {"type": "integer", "description": "Duración de la campaña en días"},
                },
                "required": ["monto_usd", "duracion_dias"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "audience_analyzer",
            "description": (
                "Configura la audiencia óptima para Meta Ads basándose en el objetivo de la campaña. "
                "Llama DESPUÉS de budget_validator."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "objetivo": {
                        "type": "string",
                        "description": "Objetivo de negocio de la campaña (qué quiere lograr el cliente)",
                    },
                },
                "required": ["objetivo"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "copy_generator",
            "description": (
                "Genera el copy de la campaña (headline, body, CTA) alineado con el tono de la marca. "
                "Llama DESPUÉS de audience_analyzer."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "producto": {
                        "type": "string",
                        "description": "Descripción del producto o evento que se promociona",
                    },
                    "canal": {
                        "type": "string",
                        "enum": ["instagram", "facebook"],
                        "description": "Canal de Meta donde se publicará el anuncio",
                    },
                    "nivel_consciencia": {
                        "type": "string",
                        "enum": ["problem_aware", "solution_aware", "product_aware"],
                        "description": "Nivel de consciencia del público objetivo sobre el problema/solución",
                    },
                },
                "required": ["producto", "canal", "nivel_consciencia"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "campaign_validator",
            "description": (
                "Checklist final antes de presentar el plan al usuario. "
                "Llama ÚLTIMO — después de tener budget, audiencia y copy."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
]

_SYSTEM_PROMPT = """Eres Adkio, un agente experto en Meta Ads para educación ejecutiva en LATAM.

Tu trabajo es convertir el pedido del usuario en un plan de campaña completo usando estas tools en ORDEN ESTRICTO:
1. budget_validator — siempre primero
2. audience_analyzer — después de validar el presupuesto
3. copy_generator — después de definir la audiencia
4. campaign_validator — siempre último, con toda la información

Reglas:
- Usa cada tool exactamente una vez, en ese orden
- Infiere los parámetros del prompt del usuario — no pidas confirmación, actúa
- Si el usuario no especifica duración, usa 14 días como default
- Si no especifica canal, usa instagram como default
- Si la audiencia es de ejecutivos/fundadores, el nivel de consciencia es solution_aware
- Extrae el presupuesto del prompt (busca números, "dolares", "$", "USD")
- Cuando termines el checklist final, NO respondas más — el plan está listo para aprobación humana
"""


def _get_brand_config(brand_id: str) -> dict:
    from backend.db.supabase_client import get_brand_config
    config = get_brand_config(brand_id)
    if config is None:
        raise ValueError(f"Brand config '{brand_id}' no encontrado en Supabase")
    return config


def _dispatch_tool(
    tool_name: str,
    tool_args: dict,
    brand_config: dict,
    tool_outputs: dict,
) -> dict:
    if tool_name == "budget_validator":
        result = budget_validator(
            monto_usd=tool_args["monto_usd"],
            brand_config=brand_config,
            duracion_dias=tool_args.get("duracion_dias", 14),
        )
        tool_outputs["budget_validator"] = result
        return result

    if tool_name == "audience_analyzer":
        result = audience_analyzer(
            objetivo=tool_args["objetivo"],
            brand_config=brand_config,
        )
        tool_outputs["audience_analyzer"] = result
        return result

    if tool_name == "copy_generator":
        audience = tool_outputs.get("audience_analyzer", {})
        tono = {
            "estilo": brand_config.get("tono_estilo", []),
            "evitar": brand_config.get("tono_evitar", []),
            "ejemplos_aprobados": brand_config.get("ejemplos_copy_aprobado", []),
        }
        result = copy_generator(
            producto=tool_args["producto"],
            audiencia=audience,
            canal=tool_args.get("canal", "instagram"),
            tono=tono,
            nivel_consciencia=tool_args.get("nivel_consciencia", "solution_aware"),
        )
        tool_outputs["copy_generator"] = result
        return result

    if tool_name == "campaign_validator":
        budget = tool_outputs.get("budget_validator", {})
        audience = tool_outputs.get("audience_analyzer", {})
        copy = tool_outputs.get("copy_generator", {})
        params = {
            "copy": copy,
            "targeting": audience,
            "budget": budget,
            "duracion_dias": tool_outputs.get("_duracion_dias", 14),
        }
        result = campaign_validator(campaign_params=params)
        tool_outputs["campaign_validator"] = result
        return result

    raise ValueError(f"Tool desconocido: {tool_name}")


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def run_campaign_agent(
    user_prompt: str,
    brand_id: str,
) -> AsyncGenerator[str, None]:
    """
    Runs the campaign agent and yields SSE events.

    Events:
      - tool_start: {tool: str, args: dict}
      - tool_result: {tool: str, result: dict}
      - plan_ready: {plan: dict}  <- agent stops here, awaits human approval
      - error: {message: str}
    """
    brand_config = _get_brand_config(brand_id)
    tool_outputs: dict = {}

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Marca: {brand_config['negocio_nombre']}\n"
                f"Industria: {brand_config['negocio_industria']}\n\n"
                f"Pedido del usuario: {user_prompt}"
            ),
        },
    ]

    max_iterations = 8  # safety cap — 4 tools max + some back-and-forth

    for _ in range(max_iterations):
        try:
            response = call_llm(messages, tools=_TOOL_DEFINITIONS, stream=False)
        except Exception as e:
            yield _sse("error", {"message": f"Error llamando al LLM: {str(e)}"})
            return

        msg = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        if finish_reason == "tool_calls" and msg.tool_calls:
            for tool_call in msg.tool_calls:
                tool_name = tool_call.function.name
                try:
                    tool_args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    tool_args = {}

                yield _sse("tool_start", {"tool": tool_name, "args": tool_args})

                try:
                    result = _dispatch_tool(tool_name, tool_args, brand_config, tool_outputs)
                except Exception as e:
                    yield _sse("error", {"message": f"Error en tool {tool_name}: {str(e)}"})
                    return

                if tool_name == "budget_validator":
                    tool_outputs["_duracion_dias"] = tool_args.get("duracion_dias", 14)

                yield _sse("tool_result", {"tool": tool_name, "result": result})

                messages.append({"role": "assistant", "content": None, "tool_calls": [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_name,
                            "arguments": tool_call.function.arguments,
                        },
                    }
                ]})
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })

            if "campaign_validator" in tool_outputs:
                plan = _build_plan(tool_outputs, brand_config)
                yield _sse("plan_ready", {"plan": plan})
                return

        else:
            if "campaign_validator" in tool_outputs:
                plan = _build_plan(tool_outputs, brand_config)
                yield _sse("plan_ready", {"plan": plan})
            return

    yield _sse("error", {"message": "El agente superó el número máximo de iteraciones."})


def _build_plan(tool_outputs: dict, brand_config: dict) -> dict:
    return {
        "brand": brand_config.get("negocio_nombre"),
        "copy": tool_outputs.get("copy_generator", {}),
        "targeting": tool_outputs.get("audience_analyzer", {}),
        "budget": tool_outputs.get("budget_validator", {}),
        "validation": tool_outputs.get("campaign_validator", {}),
        "duracion_dias": tool_outputs.get("_duracion_dias", 14),
    }


async def approve_and_launch(plan: dict) -> dict:
    """
    Called by POST /campaign/approve.
    Returns {campaign_id, status, estimated_reach, report}.
    """
    copy = plan.get("copy", {})
    targeting = plan.get("targeting", {})
    budget = plan.get("budget", {})
    duracion_dias = plan.get("duracion_dias", 14)
    budget_usd = budget.get("presupuesto_diario_calculado", 0) * duracion_dias

    campaign_result = campaign_launcher(
        canal="instagram",
        copy=copy,
        targeting=targeting,
        budget=budget_usd,
        duracion_dias=duracion_dias,
    )

    tool_outputs = {
        "budget_validator": budget,
        "audience_analyzer": targeting,
        "copy_generator": copy,
        "campaign_validator": plan.get("validation", {}),
    }

    report = report_generator(
        campaign_result=campaign_result,
        all_tool_outputs=tool_outputs,
    )

    return {
        "campaign_id": campaign_result.get("campaign_id"),
        "status": campaign_result.get("status"),
        "estimated_reach": campaign_result.get("estimated_reach"),
        "preview_url": campaign_result.get("preview_url"),
        "report": report,
    }
