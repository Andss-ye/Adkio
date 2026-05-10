"""
Analyzes and configures the Meta Ads audience from brand config and campaign goal.
Interest IDs are text-based here; campaign_launcher resolves real Meta IDs via TargetingSearch.
"""
import json
from backend.llm import call_llm

# Estimated LATAM founder/executive audience baseline on Meta
_LATAM_EXEC_BASE = 2_500_000


def audience_analyzer(
    objetivo: str,
    brand_config: dict,
) -> dict:
    paises = brand_config.get("publico_paises", ["Colombia", "Mexico"])
    edad_min = brand_config.get("publico_edad_min", 28)
    edad_max = brand_config.get("publico_edad_max", 52)
    intereses_base = brand_config.get("publico_intereses", [])
    roles = brand_config.get("publico_roles", [])

    intereses, exclusiones, rationale = _llm_audience(
        objetivo, paises, edad_min, edad_max, intereses_base, roles, brand_config
    )

    tamano_estimado = _estimate_reach(paises, edad_min, edad_max, len(intereses))

    return {
        "intereses": intereses,
        "edad_min": edad_min,
        "edad_max": edad_max,
        "paises": paises,
        "tamano_estimado": tamano_estimado,
        "exclusiones": exclusiones,
        "rationale": rationale,
    }


def _llm_audience(
    objetivo: str,
    paises: list[str],
    edad_min: int,
    edad_max: int,
    intereses_base: list[str],
    roles: list[str],
    brand_config: dict,
) -> tuple[list[str], list[str], str]:
    nombre = brand_config.get("negocio_nombre", "")
    propuesta = brand_config.get("propuesta_de_valor", "")

    messages = [
        {
            "role": "system",
            "content": (
                "Eres un especialista en targeting de Meta Ads para educación ejecutiva en LATAM. "
                "Dado un objetivo de campaña y una marca, devuelve SOLO un JSON con esta estructura exacta:\n"
                '{"intereses": ["str"], "exclusiones": ["str"], "rationale": "str"}\n'
                "intereses: 5-8 términos de interés de Meta (en inglés, como aparecen en la plataforma). "
                "exclusiones: 2-4 segmentos a excluir para mantener calidad. "
                "rationale: 2-3 oraciones en español explicando la lógica de segmentación. "
                "No incluyas texto fuera del JSON."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Objetivo: {objetivo}\n"
                f"Marca: {nombre}\n"
                f"Propuesta: {propuesta}\n"
                f"Roles target: {roles}\n"
                f"Intereses base: {intereses_base}\n"
                f"Países: {paises} | Edad: {edad_min}-{edad_max}"
            ),
        },
    ]

    try:
        resp = call_llm(messages)
        raw = resp.choices[0].message.content.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw.strip())
        return (
            data.get("intereses", intereses_base),
            data.get("exclusiones", []),
            data.get("rationale", "Segmentación basada en perfil de marca."),
        )
    except Exception:
        return (
            intereses_base or ["entrepreneurship", "business networking", "leadership development"],
            ["students", "job seekers"],
            f"Audiencia de fundadores y CEOs en {', '.join(paises)}, edad {edad_min}-{edad_max}.",
        )


def _estimate_reach(paises: list[str], edad_min: int, edad_max: int, n_intereses: int) -> int:
    # Rough heuristic: base × country factor × age range factor × interest narrowing
    country_factor = min(len(paises) * 0.6, 1.8)
    age_range = edad_max - edad_min
    age_factor = age_range / 40  # normalized to 40-year span
    interest_factor = max(0.3, 1.0 - (n_intereses * 0.05))
    return int(_LATAM_EXEC_BASE * country_factor * age_factor * interest_factor)
