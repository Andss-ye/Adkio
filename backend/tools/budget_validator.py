"""
Validates campaign budget viability against brand config constraints.
Uses LLM to generate expert rationale visible in the reasoning panel.
"""
import json
from backend.llm import call_llm

MIN_DAILY_BUDGET_USD = 5.0
META_LEARNING_PHASE_DAYS = 7


def budget_validator(
    monto_usd: float,
    brand_config: dict,
    duracion_dias: int,
) -> dict:
    presupuesto_diario = round(monto_usd / duracion_dias, 2)
    presupuesto_min = brand_config.get("presupuesto_min_campana_usd", 100.0)
    presupuesto_max = brand_config.get("presupuesto_max_campana_usd", 500.0)

    warnings = []
    aprobado = True

    if presupuesto_diario < MIN_DAILY_BUDGET_USD:
        aprobado = False
        warnings.append(
            f"Presupuesto diario ${presupuesto_diario} está por debajo del mínimo de Meta (${MIN_DAILY_BUDGET_USD}/día)."
        )

    if monto_usd < presupuesto_min:
        warnings.append(
            f"${monto_usd} está por debajo del mínimo recomendado para esta marca (${presupuesto_min})."
        )

    if monto_usd > presupuesto_max:
        warnings.append(
            f"${monto_usd} supera el máximo configurado para esta marca (${presupuesto_max})."
        )

    if duracion_dias < META_LEARNING_PHASE_DAYS:
        warnings.append(
            f"Meta necesita al menos {META_LEARNING_PHASE_DAYS} días para completar la fase de aprendizaje. "
            f"Con {duracion_dias} días los resultados serán subóptimos."
        )

    rationale = _generate_rationale(monto_usd, presupuesto_diario, duracion_dias, brand_config, aprobado, warnings)

    return {
        "aprobado": aprobado,
        "warnings": warnings,
        "presupuesto_diario_calculado": presupuesto_diario,
        "rationale": rationale,
    }


def _generate_rationale(
    monto_usd: float,
    presupuesto_diario: float,
    duracion_dias: int,
    brand_config: dict,
    aprobado: bool,
    warnings: list[str],
) -> str:
    nombre = brand_config.get("negocio_nombre", "la marca")
    industria = brand_config.get("negocio_industria", "")

    messages = [
        {
            "role": "system",
            "content": (
                "Eres un experto en Meta Ads para educación ejecutiva en LATAM. "
                "Explica en 2-3 oraciones concisas (español) por qué este presupuesto "
                "es viable o no para una campaña en Meta. Sé directo y específico. "
                "No repitas los números exactos que ya están en el output — da contexto de negocio."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Marca: {nombre} ({industria})\n"
                f"Presupuesto total: ${monto_usd} USD durante {duracion_dias} días (${presupuesto_diario}/día)\n"
                f"Estado: {'aprobado' if aprobado else 'rechazado'}\n"
                f"Advertencias: {warnings if warnings else 'ninguna'}"
            ),
        },
    ]

    try:
        resp = call_llm(messages)
        return resp.choices[0].message.content.strip()
    except Exception:
        if aprobado:
            return f"Presupuesto de ${monto_usd} USD viable para {duracion_dias} días en Meta Ads."
        return f"Presupuesto insuficiente: ${presupuesto_diario}/día no cubre el mínimo operativo de Meta."
