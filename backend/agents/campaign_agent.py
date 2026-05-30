"""
Campaign Agent — orchestrates the 4-tool pipeline via litellm tool use.

Flow: budget_validator → audience_analyzer → copy_generator → campaign_validator
      (pauses here and streams plan to frontend for human approval)

POST /campaign/approve triggers: campaign_launcher → report_generator
"""
import asyncio
import json
import os
from typing import AsyncGenerator

from backend.llm import call_llm
from backend.tools.budget_validator import budget_validator
from backend.tools.audience_analyzer import audience_analyzer
from backend.tools.platform_recommender import platform_recommender
from backend.tools.copy_generator import copy_generator
from backend.tools.campaign_validator import campaign_validator
from backend.tools.campaign_launcher import campaign_launcher
from backend.tools.campaign_remover import campaign_remover
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
            "name": "platform_recommender",
            "description": (
                "Decide la mejor plataforma (Meta / TikTok / Google Ads) según objetivo "
                "y audiencia. Llama DESPUÉS de audience_analyzer y ANTES de copy_generator."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "objetivo": {
                        "type": "string",
                        "description": "Objetivo de negocio extraído del pedido del usuario",
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
                "Llama DESPUÉS de platform_recommender — el canal debe coincidir con la plataforma elegida."
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
                        "enum": [
                            "instagram",
                            "facebook",
                            "tiktok",
                            "google_search",
                            "google_display",
                            "youtube",
                        ],
                        "description": (
                            "Canal/placement donde se publicará. Debe ser consistente con la "
                            "plataforma elegida por platform_recommender: meta → instagram|facebook, "
                            "tiktok → tiktok, google_ads → google_search|google_display|youtube"
                        ),
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
                "properties": {
                    "notas": {
                        "type": "string",
                        "description": "Notas opcionales del agente sobre el estado de la campaña",
                    }
                },
                "required": [],
            },
        },
    },
]

_SYSTEM_PROMPT = """Eres Adkio, un agente experto en publicidad digital multi-canal para LATAM.

Tu trabajo es convertir el pedido del usuario en un plan de campaña completo usando estas tools en ORDEN ESTRICTO:
1. budget_validator — siempre primero
2. audience_analyzer — después de validar el presupuesto
3. platform_recommender — elige Meta / TikTok / Google Ads según objetivo y audiencia
4. copy_generator — copy alineado con la plataforma elegida
5. campaign_validator — checklist final con toda la información

Adaptás la campaña al negocio del cliente, sea cual sea su industria (e-commerce, SaaS, salud,
educación, servicios locales, etc.). NO asumas un rubro: usá la industria y la propuesta de valor
de la marca que se te dan en el contexto del usuario.

Criterios de selección de plataforma (lo decide platform_recommender, pero entendelos):
- **Meta (Instagram/Facebook):** leads, e-commerce, marcas con audiencia amplia o B2B local. Default seguro para LATAM.
- **TikTok:** awareness y alcance en audiencias jóvenes, e-commerce visual, contenido viral. CPM bajo. Soft-delete (no permite hard-delete real).
- **Google Ads:** intent activo (el usuario YA busca tu solución), keywords claros, comparativas de precio.

Mapeo canal según plataforma:
- meta → "instagram" o "facebook"
- tiktok → "tiktok"
- google_ads → "google_search" (intent), "google_display" (awareness/retargeting), "youtube" (video)

Reglas:
- Usa cada tool exactamente una vez, en ese orden
- Infiere los parámetros del prompt del usuario — no pidas confirmación, actúa
- Si el usuario no especifica duración, usa 14 días como default
- Ajustá el nivel de consciencia y la audiencia al producto real (no asumas ejecutivos por defecto)
- Extrae el presupuesto del prompt (busca números, "dolares", "$", "USD")
- El `canal` que pasás a copy_generator DEBE ser consistente con la plataforma que devolvió platform_recommender
- Cuando termines el checklist final, NO respondas más — el plan está listo para aprobación humana
"""


async def _get_brand_config(brand_id: str) -> dict:
    from backend.db.supabase_client import get_brand_config
    config = await asyncio.to_thread(get_brand_config, brand_id)
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

    if tool_name == "platform_recommender":
        audience = tool_outputs.get("audience_analyzer", {})
        budget = tool_outputs.get("budget_validator", {})
        result = platform_recommender(
            objetivo=tool_args["objetivo"],
            audiencia=audience,
            brand_config=brand_config,
            presupuesto_usd=float(
                budget.get("presupuesto_diario_calculado", 0)
                * tool_outputs.get("_duracion_dias", 14)
            ),
        )
        tool_outputs["platform_recommender"] = result
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


def _default_canal_for(platform: str) -> str:
    return {
        "meta": "instagram",
        "tiktok": "tiktok",
        "google_ads": "google_search",
    }.get(platform, "instagram")


async def run_campaign_agent(
    user_prompt: str,
    brand_id: str,
    platform_hint: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Runs the campaign agent and yields SSE events.

    Events:
      - tool_start: {tool: str, args: dict}
      - tool_result: {tool: str, result: dict}
      - plan_ready: {plan: dict}  <- agent stops here, awaits human approval
      - error: {message: str}
    """
    try:
        brand_config = await _get_brand_config(brand_id)
    except Exception as e:
        yield _sse("error", {"message": f"Error cargando brand config: {str(e)}"})
        return
    tool_outputs: dict = {}

    hint_line = ""
    if platform_hint in ("meta", "tiktok", "google_ads"):
        hint_line = (
            f"\n\nIMPORTANTE: El usuario seleccionó manualmente la plataforma '{platform_hint}'. "
            f"Cuando llames platform_recommender, debés respetar esa elección — "
            f"el sistema va a forzar platform={platform_hint} aunque el scoring sugiera otra."
        )

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Marca: {brand_config['negocio_nombre']}\n"
                f"Industria: {brand_config['negocio_industria']}\n"
                f"Propuesta de valor: {brand_config.get('propuesta_de_valor', 'N/D')}\n\n"
                f"Pedido del usuario: {user_prompt}{hint_line}"
            ),
        },
    ]

    max_iterations = 10  # safety cap — 5 tools (budget/audience/platform/copy/validator) + back-and-forth

    for _ in range(max_iterations):
        try:
            response = await asyncio.to_thread(call_llm, messages, _TOOL_DEFINITIONS, False)
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
                    result = await asyncio.to_thread(
                        _dispatch_tool, tool_name, tool_args, brand_config, tool_outputs
                    )
                except Exception as e:
                    yield _sse("error", {"message": f"Error en tool {tool_name}: {str(e)}"})
                    return

                if tool_name == "budget_validator":
                    tool_outputs["_duracion_dias"] = tool_args.get("duracion_dias", 14)

                # Override del recommender si el usuario forzó plataforma
                if (
                    tool_name == "platform_recommender"
                    and platform_hint in ("meta", "tiktok", "google_ads")
                    and result.get("platform") != platform_hint
                ):
                    original = result.get("platform")
                    result["platform"] = platform_hint
                    result["confidence"] = 1.0
                    result["rationale"] = (
                        f"Plataforma forzada por el usuario: **{platform_hint}**. "
                        f"(El recomendador automático hubiera elegido {original}.)"
                    )
                    result["user_forced"] = True
                    tool_outputs["platform_recommender"] = result

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
            # El LLM respondió sin llamar tools y todavía no hay plan → el pedido
            # no es accionable (input vago/ambiguo). Devolvemos el texto del modelo
            # como aclaración en vez de cortar en silencio o seguir gastando tokens.
            aclaracion = (
                (msg.content or "").strip()
                or "No pude inferir una campaña con eso. Contame qué querés "
                "promocionar, con qué presupuesto y a quién."
            )
            yield _sse("error", {"message": aclaracion})
            return

    yield _sse("error", {"message": "El agente superó el número máximo de iteraciones."})


def _build_plan(tool_outputs: dict, brand_config: dict) -> dict:
    return {
        "brand": brand_config.get("negocio_nombre"),
        "copy": tool_outputs.get("copy_generator", {}),
        "targeting": tool_outputs.get("audience_analyzer", {}),
        "budget": tool_outputs.get("budget_validator", {}),
        "platform_recommendation": tool_outputs.get("platform_recommender", {}),
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
    if budget_usd <= 0:
        raise ValueError(
            "El presupuesto calculado es cero — budget_validator debe ejecutarse antes de aprobar"
        )

    platform_reco = plan.get("platform_recommendation") or {}
    platform = platform_reco.get("platform") or "meta"
    canal = copy.get("canal") or _default_canal_for(platform)

    campaign_result = campaign_launcher(
        canal=canal,
        copy=copy,
        targeting=targeting,
        budget=budget_usd,
        duracion_dias=duracion_dias,
        platform=platform,
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

    # Persistir en Supabase (best-effort — no bloquea si falla)
    try:
        from backend.db.supabase_client import create_campaign_result
        kpis = campaign_result.get("kpis", {})
        await asyncio.to_thread(create_campaign_result, {
            "account_id": plan.get("_account_id"),
            "brand_id": plan.get("brand_id", "demo-edu-latam"),
            "campaign_id": campaign_result.get("campaign_id"),
            "status": campaign_result.get("status"),
            "platform": campaign_result.get("platform"),
            "is_mock": bool(campaign_result.get("is_mock", False)),
            "estimated_reach": campaign_result.get("estimated_reach"),
            "preview_url": campaign_result.get("preview_url"),
            "user_prompt": plan.get("user_prompt", ""),
            "copy_headline": copy.get("headline"),
            "copy_body": copy.get("body"),
            "copy_cta": copy.get("cta"),
            "budget_usd": budget_usd,
            "duration_days": duracion_dias,
            "paises": targeting.get("paises", []),
            "expected_leads": kpis.get("expected_leads"),
            "cpl_usd": kpis.get("cpl_usd"),
            "cpl_min_usd": kpis.get("cpl_min_usd"),
            "cpl_max_usd": kpis.get("cpl_max_usd"),
        })
    except Exception as _e:
        import logging
        logging.getLogger(__name__).warning("No se pudo persistir campaña en Supabase: %s", _e)

    return {
        "campaign_id": campaign_result.get("campaign_id"),
        "status": campaign_result.get("status"),
        "platform": campaign_result.get("platform"),
        "is_mock": bool(campaign_result.get("is_mock", False)),
        "estimated_reach": campaign_result.get("estimated_reach"),
        "preview_url": campaign_result.get("preview_url"),
        "report": report,
        "kpis": campaign_result.get("kpis"),
        "next_steps": campaign_result.get("next_steps"),
    }


# ── Iteración agéntica (refinamiento del plan) ──────────────────────────────
# El usuario (un marketer) no aprueba el plan tal cual y quiere ajustarlo sin
# empezar de cero ni gastar tokens re-corriendo las 5 tools. refine_plan hace
# UNA sola llamada al LLM que devuelve el plan actualizado, y todo lo derivado
# (presupuesto diario, alcance, validación) se recomputa de forma determinística.

import re as _re
from backend.tools.audience_analyzer import _estimate_reach
from backend.tools.budget_validator import MIN_DAILY_BUDGET_USD, META_LEARNING_PHASE_DAYS
from backend.tools.campaign_validator import _CHECKLIST, _BLOCKER_KEYS, _humanize

_VALID_PLATFORMS = ("meta", "tiktok", "google_ads")

_REFINE_SYSTEM = """Sos un estratega senior de paid media (Meta, TikTok, Google Ads) que ajusta
una campaña EXISTENTE según el pedido de un marketer. Aplicá el cambio con criterio experto,
modificando SOLO lo necesario y manteniendo coherencia con la marca. Sé decisivo y contundente:
resolvé el pedido de una, con calidad profesional, para que NO haya que pedirlo 5 veces.

Devolvé SOLO un JSON con esta estructura EXACTA (sin texto fuera del JSON):
{
  "copy": {"headline": "str <=40 chars", "body": "str", "cta": "str", "rationale": "str"},
  "targeting": {"intereses": ["str"], "edad_min": int, "edad_max": int, "paises": ["str"], "exclusiones": ["str"], "rationale": "str"},
  "budget": {"monto_usd": number, "duracion_dias": int},
  "platform": "meta" | "tiktok" | "google_ads",
  "change_summary": "1-2 oraciones en español: qué cambiaste y por qué"
}
Reglas:
- Si el pedido NO menciona algo (ej: no habla del presupuesto), MANTENÉ el valor actual.
- edad entre 13 y 65; headline <= 40 chars; no inventes países fuera de los pedidos o actuales.
- Los rationale deben ser específicos al cambio pedido, no genéricos."""


def _clamp(v, lo, hi, fallback):
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return fallback


def _recompute_budget(monto_usd: float, duracion_dias: int, brand_config: dict) -> dict:
    """Reglas de presupuesto sin LLM (espejo de budget_validator)."""
    duracion_dias = duracion_dias if duracion_dias and duracion_dias > 0 else 14
    presupuesto_diario = round(monto_usd / duracion_dias, 2)
    pmin = brand_config.get("presupuesto_min_campana_usd", 100.0)
    pmax = brand_config.get("presupuesto_max_campana_usd", 500.0)
    warnings, aprobado = [], True
    if presupuesto_diario < MIN_DAILY_BUDGET_USD:
        aprobado = False
        warnings.append(
            f"Presupuesto diario ${presupuesto_diario} por debajo del mínimo (${MIN_DAILY_BUDGET_USD}/día)."
        )
    if monto_usd < pmin:
        warnings.append(f"${monto_usd} está por debajo del mínimo recomendado de la marca (${pmin}).")
    if monto_usd > pmax:
        warnings.append(f"${monto_usd} supera el máximo configurado de la marca (${pmax}).")
    if duracion_dias < META_LEARNING_PHASE_DAYS:
        warnings.append(
            f"Con {duracion_dias} días no se cubre la fase de aprendizaje ({META_LEARNING_PHASE_DAYS} días)."
        )
    return {
        "aprobado": aprobado,
        "warnings": warnings,
        "presupuesto_diario_calculado": presupuesto_diario,
        "rationale": "Presupuesto recalculado tras tu ajuste.",
    }


def _recompute_validation(plan_params: dict, change_summary: str) -> dict:
    """Checklist determinístico (espejo de campaign_validator, sin LLM)."""
    checklist = {k: bool(fn(plan_params)) for k, fn in _CHECKLIST.items()}
    blockers = [k for k in _BLOCKER_KEYS if not checklist[k]]
    warnings = [k for k, ok in checklist.items() if not ok and k not in _BLOCKER_KEYS]
    passed = len(blockers) == 0
    return {
        "passed": passed,
        "warnings": _humanize(warnings),
        "blockers": _humanize(blockers),
        "checklist_results": checklist,
        "rationale": change_summary or ("Campaña lista." if passed else "Hay puntos a resolver."),
    }


def _parse_json_loose(raw: str) -> dict:
    raw = (raw or "").strip()
    m = _re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if m:
        raw = m.group(1).strip()
    return json.loads(raw)


async def refine_plan(plan: dict, feedback: str, brand_config: dict) -> dict:
    """Refina un plan existente con UNA sola llamada LLM + recomputo determinístico.

    Devuelve un plan con la misma forma que `_build_plan` + `change_summary`.
    Si el LLM falla o devuelve algo inválido, retorna el plan original con un
    change_summary explicativo (nunca rompe).
    """
    cur_copy = plan.get("copy", {}) or {}
    cur_tgt = plan.get("targeting", {}) or {}
    cur_budget = plan.get("budget", {}) or {}
    cur_reco = plan.get("platform_recommendation", {}) or {}
    cur_duracion = int(plan.get("duracion_dias", 14) or 14)
    cur_monto = round(float(cur_budget.get("presupuesto_diario_calculado", 0) or 0) * cur_duracion, 2)
    cur_platform = cur_reco.get("platform") or "meta"

    user_payload = {
        "marca": {
            "nombre": brand_config.get("negocio_nombre"),
            "industria": brand_config.get("negocio_industria"),
            "propuesta": brand_config.get("propuesta_de_valor"),
        },
        "plan_actual": {
            "copy": {k: cur_copy.get(k) for k in ("headline", "body", "cta")},
            "targeting": {
                "intereses": cur_tgt.get("intereses", []),
                "edad_min": cur_tgt.get("edad_min"),
                "edad_max": cur_tgt.get("edad_max"),
                "paises": cur_tgt.get("paises", []),
                "exclusiones": cur_tgt.get("exclusiones", []),
            },
            "budget": {"monto_usd": cur_monto, "duracion_dias": cur_duracion},
            "platform": cur_platform,
        },
        "pedido_de_cambio": feedback,
    }

    messages = [
        {"role": "system", "content": _REFINE_SYSTEM},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]

    try:
        resp = await asyncio.to_thread(call_llm, messages)
        data = _parse_json_loose(resp.choices[0].message.content)
    except Exception:
        # Nunca rompemos: devolvemos el plan tal cual con aviso.
        out = dict(plan)
        out["change_summary"] = "No pude aplicar el cambio — reformulá el pedido (ej: 'copy más directo', 'baja el presupuesto a 150')."
        return out

    new_copy_raw = data.get("copy", {}) or {}
    new_tgt_raw = data.get("targeting", {}) or {}
    new_budget_raw = data.get("budget", {}) or {}
    change_summary = (data.get("change_summary") or "Plan actualizado.").strip()

    # Copy (con fallback al actual)
    headline = (new_copy_raw.get("headline") or cur_copy.get("headline") or "")[:40]
    copy = {
        "headline": headline,
        "body": new_copy_raw.get("body") or cur_copy.get("body") or "",
        "cta": new_copy_raw.get("cta") or cur_copy.get("cta") or "Más información",
        "rationale": new_copy_raw.get("rationale") or "Copy ajustado a tu pedido.",
    }

    # Targeting
    edad_min = _clamp(new_tgt_raw.get("edad_min", cur_tgt.get("edad_min")), 13, 65, cur_tgt.get("edad_min", 25))
    edad_max = _clamp(new_tgt_raw.get("edad_max", cur_tgt.get("edad_max")), 13, 65, cur_tgt.get("edad_max", 55))
    if edad_min >= edad_max:
        edad_min, edad_max = cur_tgt.get("edad_min", 25), cur_tgt.get("edad_max", 55)
    paises = new_tgt_raw.get("paises") or cur_tgt.get("paises", [])
    intereses = new_tgt_raw.get("intereses") or cur_tgt.get("intereses", [])
    exclusiones = new_tgt_raw.get("exclusiones", cur_tgt.get("exclusiones", []))
    targeting = {
        "intereses": intereses,
        "edad_min": edad_min,
        "edad_max": edad_max,
        "paises": paises,
        "tamano_estimado": _estimate_reach(paises, edad_min, edad_max, len(intereses)),
        "exclusiones": exclusiones,
        "rationale": new_tgt_raw.get("rationale") or cur_tgt.get("rationale", "Audiencia ajustada."),
    }

    # Budget (recomputo determinístico)
    try:
        monto = float(new_budget_raw.get("monto_usd", cur_monto) or cur_monto)
    except (TypeError, ValueError):
        monto = cur_monto
    duracion = _clamp(new_budget_raw.get("duracion_dias", cur_duracion), 1, 365, cur_duracion)
    budget = _recompute_budget(monto, duracion, brand_config)

    # Platform
    platform = data.get("platform") if data.get("platform") in _VALID_PLATFORMS else cur_platform
    if platform == cur_platform and cur_reco:
        platform_reco = dict(cur_reco)
        platform_reco["platform"] = platform
    else:
        platform_reco = {
            "platform": platform,
            "confidence": 1.0,
            "rationale": f"Ajustado a {platform} por tu pedido.",
        }

    # Validación determinística
    plan_params = {"copy": copy, "targeting": targeting, "budget": budget, "duracion_dias": duracion}
    validation = _recompute_validation(plan_params, change_summary)

    return {
        "brand": brand_config.get("negocio_nombre"),
        "copy": copy,
        "targeting": targeting,
        "budget": budget,
        "platform_recommendation": platform_reco,
        "validation": validation,
        "duracion_dias": duracion,
        "change_summary": change_summary,
    }
