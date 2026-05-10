"""
Onboarding Agent — aprende la marca del cliente en 3-5 turnos.

Lógica central:
  - confidence_score calcula qué tan completa está la info de la marca
  - Si score < 0.85 → UNA pregunta (la más impactante que falta)
  - Si score >= 0.85 → genera brand_config completo y persiste en Supabase

Pesos del confidence_score:
  Críticos   (0.40): industria, público objetivo, presupuesto
  Importantes (0.35): canales, propuesta de valor, tono
  Opcionales  (0.25): ejemplos de copy, restricciones
"""
import json
from typing import Optional
from backend.llm import call_llm
from backend.db.supabase_client import create_brand_config, get_brand_config

# ---------- Definición de campos y sus pesos ----------

FIELD_WEIGHTS = {
    # Críticos → 0.40 total / 3 campos = ~0.133 cada uno
    "negocio_industria":           0.133,
    "publico_roles":               0.133,
    "presupuesto_min_campana_usd": 0.134,
    # Importantes → 0.35 total / 3 campos = ~0.117 cada uno
    "propuesta_de_valor":          0.117,
    "tono_estilo":                 0.117,
    "publico_paises":              0.116,
    # Opcionales → 0.25 total / 3 campos = ~0.083 cada uno
    "ejemplos_copy_aprobado":      0.083,
    "tono_evitar":                 0.083,
    "publico_intereses":           0.084,
}

FIELD_QUESTIONS = {
    "negocio_industria":           "¿En qué industria o vertical opera tu negocio? (ej: educación ejecutiva, SaaS B2B, e-commerce)",
    "publico_roles":               "¿A quiénes le vendés? Describí los cargos o roles de tu cliente ideal (ej: Founders, CFOs, gerentes de marketing).",
    "presupuesto_min_campana_usd": "¿Cuánto presupuesto en dólares podés destinar a una campaña? Dame un rango mínimo y máximo (ej: $100 – $500).",
    "propuesta_de_valor":          "¿Cuál es la propuesta de valor única de tu negocio? ¿Qué hacés mejor que nadie?",
    "tono_estilo":                 "¿Cómo describís el tono de comunicación de tu marca? (ej: directo y aspiracional, técnico y confiable, cercano y humano)",
    "publico_paises":              "¿En qué países o regiones querés llegar con tus campañas?",
    "ejemplos_copy_aprobado":      "¿Tenés algún ejemplo de copy o mensaje que haya funcionado bien para tu marca? Si tenés, compartilo.",
    "tono_evitar":                 "¿Hay estilos de comunicación que querés evitar? (ej: lenguaje de autoayuda, jerga técnica excesiva)",
    "publico_intereses":           "¿Qué intereses, hobbies o comportamientos tienen tus clientes ideales?",
}

THRESHOLD = 0.85


# ---------- Funciones de score ----------

def _field_present(value) -> bool:
    if value is None:
        return False
    if isinstance(value, (list, str)) and len(value) == 0:
        return False
    if isinstance(value, float) and value == 0.0:
        return False
    return True


def compute_confidence_score(extracted: dict) -> float:
    score = 0.0
    for field, weight in FIELD_WEIGHTS.items():
        if _field_present(extracted.get(field)):
            score += weight
    return round(min(score, 1.0), 3)


def _weakest_missing_field(extracted: dict) -> Optional[str]:
    """Retorna el campo crítico/importante que falta y tiene más peso."""
    for field in FIELD_WEIGHTS:
        if not _field_present(extracted.get(field)):
            return field
    return None


# ---------- LLM helpers ----------

_EXTRACT_SYSTEM = """
Sos un extractor de información de marca. Dado el historial de una conversación de onboarding,
extraé los datos disponibles en formato JSON estricto.

Retorná SOLO el JSON, sin texto adicional, con esta estructura:
{
  "negocio_nombre": "str o null",
  "negocio_industria": "str o null",
  "propuesta_de_valor": "str o null",
  "publico_roles": ["str"] o [],
  "publico_paises": ["str"] o [],
  "publico_edad_min": int o null,
  "publico_edad_max": int o null,
  "publico_intereses": ["str"] o [],
  "presupuesto_min_campana_usd": float o null,
  "presupuesto_max_campana_usd": float o null,
  "tono_estilo": ["str"] o [],
  "tono_evitar": ["str"] o [],
  "ejemplos_copy_aprobado": ["str"] o [],
  "pixel_configurado": bool o null,
  "campos_inferidos": ["str"]
}

Para campos_inferidos: listá los campos que inferiste de contexto (no mencionados explícitamente).
""".strip()

_GENERATE_SYSTEM = """
Sos un experto en marketing digital con foco en Meta Ads.
Dado el historial de una conversación de onboarding con un cliente, generá la configuración
completa de la marca en JSON. Completá o inferí los campos que no se mencionaron explícitamente,
marcándolos en "campos_inferidos".

Retorná SOLO el JSON con la misma estructura que se te dará como base. No agregues texto extra.
Sin comentarios. Solo JSON válido.
""".strip()


def _extract_from_conversation(history: list[dict]) -> dict:
    messages = [
        {"role": "system", "content": _EXTRACT_SYSTEM},
        *history,
    ]
    response = call_llm(messages)
    raw = response.choices[0].message.content.strip()
    # Limpia posibles backticks de código
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def _generate_brand_config(history: list[dict], partial: dict) -> dict:
    messages = [
        {"role": "system", "content": _GENERATE_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Historial de conversación:\n{json.dumps(history, ensure_ascii=False)}\n\n"
                f"Datos ya extraídos:\n{json.dumps(partial, ensure_ascii=False)}\n\n"
                "Completá todos los campos del JSON. Inferí lo que falte con criterio experto."
            ),
        },
    ]
    response = call_llm(messages)
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def _next_question(missing_field: str, history: list[dict], business_name: str) -> str:
    """Genera una pregunta conversacional para el campo que falta."""
    base_question = FIELD_QUESTIONS[missing_field]
    if not history:
        return base_question

    messages = [
        {
            "role": "system",
            "content": (
                "Sos un consultor de marketing haciendo onboarding de un cliente. "
                "Tu tarea es hacer UNA sola pregunta de forma natural y conversacional. "
                "No hagas más de una pregunta. No uses listas. Sé directo y amigable. "
                "Adaptá la pregunta al contexto de la conversación previa."
            ),
        },
        *history,
        {
            "role": "user",
            "content": (
                f"La próxima pregunta que necesito hacerle al cliente es sobre: {base_question}\n"
                f"Su negocio se llama: {business_name or 'desconocido'}.\n"
                "Formulá esta pregunta de forma natural basándote en la conversación previa."
            ),
        },
    ]
    response = call_llm(messages)
    return response.choices[0].message.content.strip()


# ---------- Interfaz principal ----------

class OnboardingAgent:
    """
    Agente conversacional de onboarding.

    Uso:
        agent = OnboardingAgent()
        result = agent.process_message(conversation_id, user_message, history)
        # result["type"] == "question" → seguir conversando
        # result["type"] == "config"   → brand_config generado y persistido
    """

    def process_message(
        self,
        conversation_id: str,
        user_message: str,
        history: list[dict],
    ) -> dict:
        """
        Procesa un mensaje del usuario y retorna la respuesta del agente.

        Retorna:
          {"type": "question", "message": str, "confidence_score": float}
          o
          {"type": "config", "brand_id": str, "brand_config": dict, "confidence_score": float}
        """
        updated_history = history + [{"role": "user", "content": user_message}]

        # Extrae lo que sabemos hasta ahora
        extracted = _extract_from_conversation(updated_history)
        score = compute_confidence_score(extracted)

        if score >= THRESHOLD:
            # Tenemos suficiente info → generar config completo
            brand_config = _generate_brand_config(updated_history, extracted)
            brand_id = create_brand_config(brand_config)
            return {
                "type": "config",
                "brand_id": brand_id,
                "brand_config": brand_config,
                "confidence_score": score,
            }

        # Necesitamos más info → preguntar lo más impactante que falta
        missing = _weakest_missing_field(extracted)
        business_name = extracted.get("negocio_nombre") or ""

        if missing:
            question = _next_question(missing, updated_history, business_name)
        else:
            # Score bajo pero todos los campos principales presentes → preguntar detalles
            question = (
                "¿Hay algo más sobre tu marca o tus campañas anteriores que quieras que tenga en cuenta?"
            )

        return {
            "type": "question",
            "message": question,
            "confidence_score": score,
        }


# Singleton para reutilización en FastAPI
onboarding_agent = OnboardingAgent()
