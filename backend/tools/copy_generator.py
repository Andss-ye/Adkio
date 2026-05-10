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
                "Eres un redactor experto en Meta Ads para educación ejecutiva en LATAM. "
                "Genera copy que convierte. El texto debe sentirse escrito por un ser humano, "
                "no por IA. Devuelve SOLO un JSON con esta estructura exacta:\n"
                '{"headline": "str", "body": "str", "cta": "str", "rationale": "str"}\n'
                "headline: máx 40 caracteres, impacto inmediato.\n"
                "body: 2-3 oraciones, sin bullet points, voz directa.\n"
                "cta: 2-4 palabras en imperativo (ej: 'Reserva tu lugar').\n"
                "rationale: 2 oraciones en español explicando las decisiones creativas.\n"
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
            "headline": f"Transforma tu liderazgo en {producto[:20]}",
            "body": "Los mejores líderes no crecen solos. Crecen con los correctos.",
            "cta": "Reserva tu lugar",
            "rationale": "Copy directo y aspiracional alineado con el tono de marca aprobado.",
        }
