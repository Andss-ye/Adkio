"""
Final checklist before campaign launch. Validates Meta Ads requirements.
Returns blockers (must fix) and warnings (should review).
"""
import json
from backend.llm import call_llm

_CHECKLIST = {
    "tiene_copy": lambda p: bool(p.get("copy", {}).get("headline")),
    "tiene_audiencia": lambda p: bool(p.get("targeting", {}).get("intereses")),
    "tiene_presupuesto_valido": lambda p: p.get("budget", {}).get("aprobado", False),
    "tiene_paises": lambda p: bool(p.get("targeting", {}).get("paises")),
    "tiene_duracion": lambda p: (p.get("duracion_dias", 0) or 0) >= 1,
    "learning_phase_cubierta": lambda p: (p.get("duracion_dias", 0) or 0) >= 7,
    "headline_length_ok": lambda p: len(p.get("copy", {}).get("headline", "")) <= 40,
    "body_no_vacio": lambda p: len(p.get("copy", {}).get("body", "")) > 10,
}

_BLOCKER_KEYS = {"tiene_copy", "tiene_audiencia", "tiene_presupuesto_valido", "tiene_paises"}


def campaign_validator(campaign_params: dict) -> dict:
    checklist_results = {key: fn(campaign_params) for key, fn in _CHECKLIST.items()}

    blockers = [key for key in _BLOCKER_KEYS if not checklist_results[key]]
    warnings = [
        key for key, passed in checklist_results.items()
        if not passed and key not in _BLOCKER_KEYS
    ]

    passed = len(blockers) == 0
    rationale = _generate_rationale(campaign_params, passed, blockers, warnings)

    return {
        "passed": passed,
        "warnings": _humanize(warnings),
        "blockers": _humanize(blockers),
        "checklist_results": checklist_results,
        "rationale": rationale,
    }


def _humanize(keys: list[str]) -> list[str]:
    messages_map = {
        "tiene_copy": "Falta headline — la campaña no tiene copy.",
        "tiene_audiencia": "No hay intereses de audiencia configurados.",
        "tiene_presupuesto_valido": "El presupuesto no fue aprobado por el validador.",
        "tiene_paises": "No hay países de segmentación definidos.",
        "tiene_duracion": "La duración de la campaña no está definida.",
        "learning_phase_cubierta": "La campaña dura menos de 7 días — Meta no completará la fase de aprendizaje.",
        "headline_length_ok": "El headline supera los 40 caracteres recomendados por Meta.",
        "body_no_vacio": "El body copy está vacío o es demasiado corto.",
    }
    return [messages_map.get(k, k) for k in keys]


def _generate_rationale(
    params: dict,
    passed: bool,
    blockers: list[str],
    warnings: list[str],
) -> str:
    copy = params.get("copy", {})
    targeting = params.get("targeting", {})

    messages = [
        {
            "role": "system",
            "content": (
                "Eres un experto en Meta Ads. Genera una evaluación final de campaña "
                "en 2-3 oraciones (español). Sé específico sobre qué está listo y qué falta. "
                "Dirígete al equipo de marketing, no al sistema."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Estado: {'APROBADA' if passed else 'BLOQUEADA'}\n"
                f"Blockers: {blockers if blockers else 'ninguno'}\n"
                f"Advertencias: {warnings if warnings else 'ninguna'}\n"
                f"Headline: {copy.get('headline', 'N/A')}\n"
                f"Países: {targeting.get('paises', [])}\n"
                f"Intereses: {targeting.get('intereses', [])}"
            ),
        },
    ]

    try:
        resp = call_llm(messages)
        return resp.choices[0].message.content.strip()
    except Exception:
        if passed:
            return "La campaña cumple todos los requisitos de Meta Ads y está lista para lanzar."
        return f"La campaña tiene {len(blockers)} blocker(s) que deben resolverse antes de lanzar."
