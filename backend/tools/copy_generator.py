"""
Generates Meta Ads copy (headline, body, CTA) using LLM.
Follows brand tone and approved copy examples from brand_config.
"""
import json
import re
from backend.llm import call_llm


def copy_generator(
    producto: str,
    audiencia: dict,
    canal: str,
    tono: dict,
    nivel_consciencia: str,
) -> dict:
    estilo = tono.get("estilo", [])
    evitar = tono.get("evitar", [])
    ejemplos = tono.get("ejemplos_aprobados", [])

    messages = [
        {
            "role": "system",
            "content": (
                "Eres un redactor publicitario experto que escribe para cualquier industria y "
                "para el canal específico de cada campaña (Instagram, Facebook, TikTok, Google "
                "Search, YouTube). Adaptá el tono al canal: TikTok más informal y nativo, Google "
                "Search más directo a la intención, Instagram/Facebook más visual y aspiracional. "
                "Genera copy que convierte y que se sienta escrito por un humano, no por IA. "
                "Devuelve SOLO un JSON con esta estructura exacta:\n"
                '{"headline": "str", "body": "str", "cta": "str", "rationale": "str"}\n'
                "headline: máx 40 caracteres, impacto inmediato.\n"
                "body: 2-3 oraciones, sin bullet points, voz directa.\n"
                "cta: 2-4 palabras en imperativo (ej: 'Reserva tu lugar', 'Comprá ahora').\n"
                "rationale: 2 oraciones en español explicando las decisiones creativas para ESTE "
                "producto y canal.\n"
                "No incluyas texto fuera del JSON."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Producto: {producto}\n"
                f"Canal: {canal}\n"
                f"Nivel de consciencia: {nivel_consciencia}\n"
                f"Audiencia: {audiencia.get('intereses', [])} | Edad {audiencia.get('edad_min')}-{audiencia.get('edad_max')}\n"
                f"Tono (usar): {estilo}\n"
                f"Tono (evitar): {evitar}\n"
                f"Ejemplos aprobados de la marca: {ejemplos}"
            ),
        },
    ]

    try:
        resp = call_llm(messages)
        raw = resp.choices[0].message.content.strip()
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if match:
            raw = match.group(1)
        data = json.loads(raw.strip())
        return {
            "headline": data.get("headline", ""),
            "body": data.get("body", ""),
            "cta": data.get("cta", "Más información"),
            "rationale": data.get("rationale", "Copy generado con estilo de marca."),
        }
    except Exception:
        return {
            "headline": producto[:38] if producto else "Descubrí lo que preparamos",
            "body": "Una propuesta pensada para vos. Conocé los detalles y dá el primer paso hoy.",
            "cta": "Más información",
            "rationale": "Copy directo alineado al tono de marca y al canal elegido.",
        }
