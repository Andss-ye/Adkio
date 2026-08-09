"""
Analyzes and configures the ads audience from brand config and campaign goal.
Interest IDs are text-based here; campaign_launcher resolves real Meta IDs via TargetingSearch.

El rango de edad lo propone el LLM según el objetivo + el negocio (no es fijo): el
brand_config es punto de partida, no un valor inmutable. Así la audiencia varía por caso.
"""
import json
import re
from backend.llm import call_llm

# Base genérica de alcance en Meta/redes para una audiencia amplia LATAM+.
# Se escala hacia abajo según países, rango de edad e intereses. NO es un valor
# garantizado — es una heurística que da un número plausible y variable por caso.
_AUDIENCE_BASE = 6_000_000


def _clamp_age(value, fallback: int) -> int:
    try:
        v = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(13, min(65, v))


def audience_analyzer(
    objetivo: str,
    brand_config: dict,
    paises_explícitos: list[str] | None = None,
    edad_min_explícita: int | None = None,
    edad_max_explícita: int | None = None,
) -> dict:
    """Configura la audiencia óptima para campañas de publicidad.

    Analiza el objetivo de la campaña y genera una segmentación de audiencia óptima
    usando el LLM. Respeta restricciones explícitas del usuario sobre país y edad.

    Args:
        objetivo: Objetivo de negocio de la campaña (ej: "Vender camisetas en Colombia").
        brand_config: Configuración de la marca (country defaults, age ranges, etc).
        paises_explícitos: Países específicos que el usuario pidió (override brand defaults).
        edad_min_explícita: Edad mínima específica que el usuario pidió (vinculante).
        edad_max_explícita: Edad máxima específica que el usuario pidió (vinculante).

    Returns:
        Dict con: intereses, edad_min, edad_max, paises, tamano_estimado, exclusiones, rationale.
        Si el usuario especificó constraints, estos son RESPETADOS (no modificados por LLM).
    """
    # Use explicit countries if provided; otherwise fall back to brand_config
    if paises_explícitos is not None:
        paises = paises_explícitos
    else:
        paises = brand_config.get("publico_paises", ["Colombia"])
    edad_min_base = brand_config.get("publico_edad_min", 25)
    edad_max_base = brand_config.get("publico_edad_max", 55)
    intereses_base = brand_config.get("publico_intereses", [])
    roles = brand_config.get("publico_roles", [])

    intereses, exclusiones, edad_min, edad_max, rationale = _llm_audience(
        objetivo, paises, edad_min_base, edad_max_base, intereses_base, roles, brand_config,
        edad_min_explícita=edad_min_explícita,
        edad_max_explícita=edad_max_explícita,
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
    edad_min_base: int,
    edad_max_base: int,
    intereses_base: list[str],
    roles: list[str],
    brand_config: dict,
    edad_min_explícita: int | None = None,
    edad_max_explícita: int | None = None,
) -> tuple[list[str], list[str], int, int, str]:
    """Llama al LLM para analizar la audiencia con constraints opcionales.

    Si hay restricciones explícitas (edad_min/max del usuario), las inyecta en el prompt
    como RESTRICCIÓN DEL USUARIO. Post-LLM valida que el LLM las respete; si no, fuerza.
    """
    nombre = brand_config.get("negocio_nombre", "")
    industria = brand_config.get("negocio_industria", "")
    propuesta = brand_config.get("propuesta_de_valor", "")

    # Build constraint string if user specified explicit age range
    constraints_str = ""
    if edad_min_explícita is not None and edad_max_explícita is not None:
        constraints_str = (
            f"\n⚠️ RESTRICCIÓN DEL USUARIO: Rango de edad = {edad_min_explícita}-{edad_max_explícita}. "
            f"Respetá exactamente este rango, no lo modifiques. Solo ajusta intereses y exclusiones."
        )

    messages = [
        {
            "role": "system",
            "content": (
                "Eres un especialista en targeting de publicidad digital (Meta, TikTok, Google) "
                "para cualquier tipo de negocio. Dado el negocio del cliente y el objetivo de una "
                "campaña, definí la audiencia óptima. Devuelve SOLO un JSON con esta estructura exacta:\n"
                '{"intereses": ["str"], "exclusiones": ["str"], "edad_min": int, "edad_max": int, "rationale": "str"}\n'
                "- intereses: 5-8 términos de interés tal como aparecen en las plataformas (en inglés).\n"
                "- exclusiones: 2-4 segmentos a excluir para mantener calidad.\n"
                "- edad_min/edad_max: AJUSTÁ el rango al objetivo y al producto concreto (ej: una marca "
                "de moda juvenil va 16-28; un producto financiero B2B va 30-55). Usá los valores de la "
                "marca solo como punto de partida, no los copies a ciegas. Rango válido 13-65.\n"
                "- rationale: 2-3 oraciones en español, específicas a ESTE negocio, país y edad "
                "(no genéricas). No incluyas texto fuera del JSON."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Objetivo de campaña: {objetivo}\n"
                f"Negocio: {nombre}\n"
                f"Industria: {industria}\n"
                f"Propuesta de valor: {propuesta}\n"
                f"Roles target (si aplica): {roles}\n"
                f"Intereses base de la marca: {intereses_base}\n"
                f"Países: {paises}\n"
                f"Rango de edad de referencia de la marca: {edad_min_base}-{edad_max_base}"
                f"{constraints_str}"
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
        edad_min = _clamp_age(data.get("edad_min"), edad_min_base)
        edad_max = _clamp_age(data.get("edad_max"), edad_max_base)
        if edad_min >= edad_max:  # sanity: garantizar un rango válido
            edad_min, edad_max = edad_min_base, edad_max_base

        # Validate explicit constraints (if ignored by LLM, force-set)
        if edad_min_explícita is not None and edad_max_explícita is not None:
            if edad_min != edad_min_explícita or edad_max != edad_max_explícita:
                import logging
                logging.getLogger(__name__).warning(
                    "LLM ignored age constraint (%d-%d); forcing to %d-%d",
                    edad_min, edad_max,
                    edad_min_explícita, edad_max_explícita
                )
                edad_min = edad_min_explícita
                edad_max = edad_max_explícita

        return (
            data.get("intereses", intereses_base),
            data.get("exclusiones", []),
            edad_min,
            edad_max,
            data.get("rationale", "Segmentación basada en el perfil del negocio y el objetivo."),
        )
    except Exception:
        return (
            intereses_base or ["entrepreneurship", "small business", "online courses"],
            ["job seekers"],
            edad_min_base,
            edad_max_base,
            f"Audiencia en {', '.join(paises)}, edad {edad_min_base}-{edad_max_base}, "
            f"alineada al objetivo de la campaña.",
        )


def _estimate_reach(paises: list[str], edad_min: int, edad_max: int, n_intereses: int) -> int:
    # Heurística: base × factor país × factor rango de edad × estrechamiento por intereses
    country_factor = min(max(len(paises), 1) * 0.6, 1.8)
    age_range = max(1, edad_max - edad_min)
    age_factor = age_range / 40  # normalizado a un span de 40 años
    interest_factor = max(0.3, 1.0 - (n_intereses * 0.05))
    return int(_AUDIENCE_BASE * country_factor * age_factor * interest_factor)
