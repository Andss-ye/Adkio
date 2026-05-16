"""
platform_recommender — elige Meta/TikTok/Google Ads basado en objetivo + audiencia.

Aplica heurísticas de mejores prácticas para LATAM educación ejecutiva (vertical
inicial de Adkio) y reglas generales de cada plataforma:

- **Meta (Facebook + Instagram)**: lead generation con lead forms, audiencias
  25-55, B2B servicios, educación ejecutiva, finanzas, real estate, salud.
  Mejor CPL para audiencias profesionales en LATAM.

- **TikTok**: awareness y alcance en audiencias 18-35, e-commerce visual,
  productos lifestyle, contenido viral. CPM bajo, pero CPL más alto para
  audiencias profesionales.

- **Google Ads (Search principalmente)**: intent-based — captura usuarios
  que YA buscan la solución. Mejor para B2B SaaS con keywords claros,
  productos comparados ("vs", "mejor", "precio"), servicios profesionales
  con búsqueda activa.

Output:
    {
        "platform": "meta" | "tiktok" | "google_ads",
        "confidence": float,         # 0.0-1.0
        "rationale": str,            # texto para el panel
        "alternativas": [            # otras plataformas evaluadas
            {"platform": str, "confidence": float, "razon": str}
        ],
        "estructura_recomendada": {  # mejores prácticas de estructura
            "campaigns": int,
            "ad_sets_per_campaign": int,
            "ads_per_ad_set": int,
            "notas": list[str]
        }
    }
"""
from __future__ import annotations


_KEYWORDS_INTENT_SEARCH = (
    "buscan", "busqueda", "búsqueda", "search", "intent", "comparar",
    "cotizar", "consulta", "comparar", "precio", "mejor",
)

_KEYWORDS_AWARENESS = (
    "awareness", "alcance", "viral", "marca", "branding", "visibilidad",
)

_KEYWORDS_LEADS = (
    "lead", "leads", "registro", "registros", "inscripcion", "inscripción",
    "evento", "demo", "consulta", "agendar", "venta b2b",
)

_KEYWORDS_ECOMMERCE = (
    "ecommerce", "e-commerce", "tienda", "compra", "carrito", "producto",
    "envio", "envío",
)


def _evaluate_meta(objetivo: str, edad_min: int, edad_max: int) -> tuple[float, str]:
    score = 0.5
    reasons: list[str] = []

    if any(k in objetivo for k in _KEYWORDS_LEADS):
        score += 0.3
        reasons.append("objetivo de leads alineado con Meta Lead Forms")

    if 25 <= edad_min and edad_max <= 65:
        score += 0.2
        reasons.append(f"audiencia profesional {edad_min}-{edad_max} (Meta domina LATAM)")
    elif edad_max < 25:
        score -= 0.2
        reasons.append("audiencia joven — Meta no es óptima")

    if not reasons:
        reasons.append("default seguro para LATAM con HITL maduro")

    return (min(score, 0.99), "; ".join(reasons))


def _evaluate_tiktok(objetivo: str, edad_min: int, edad_max: int) -> tuple[float, str]:
    score = 0.3
    reasons: list[str] = []

    if any(k in objetivo for k in _KEYWORDS_AWARENESS):
        score += 0.3
        reasons.append("objetivo de awareness — TikTok tiene CPM bajo")

    if any(k in objetivo for k in _KEYWORDS_ECOMMERCE):
        score += 0.25
        reasons.append("e-commerce visual — TikTok Shop es nativo")

    if edad_max <= 35 and edad_min >= 16:
        score += 0.35
        reasons.append(f"audiencia 18-35 ({edad_min}-{edad_max}) es el sweet spot de TikTok")
    elif edad_min > 40:
        score -= 0.25
        reasons.append("audiencia >40 — penetración débil en TikTok")

    if not reasons:
        reasons.append("evaluación neutra")

    return (max(min(score, 0.99), 0.05), "; ".join(reasons))


def _evaluate_google(objetivo: str, edad_min: int, edad_max: int) -> tuple[float, str]:
    score = 0.4
    reasons: list[str] = []

    if any(k in objetivo for k in _KEYWORDS_INTENT_SEARCH):
        score += 0.4
        reasons.append("intent activo — usuarios buscan la solución (Search)")

    if any(k in objetivo for k in _KEYWORDS_LEADS) and edad_min >= 28:
        score += 0.15
        reasons.append("B2B con audiencia decisora — Google Search convierte bien")

    if any(k in objetivo for k in _KEYWORDS_AWARENESS):
        score += 0.1
        reasons.append("Display puede aportar alcance complementario")

    if not reasons:
        reasons.append("Google funciona como retargeting/Display por default")

    return (max(min(score, 0.99), 0.05), "; ".join(reasons))


def _structure_for(platform: str, budget_usd: float) -> dict:
    """Mejores prácticas de estructura por plataforma."""
    if platform == "meta":
        return {
            "campaigns": 1,
            "ad_sets_per_campaign": 2 if budget_usd >= 300 else 1,
            "ads_per_ad_set": 3,
            "notas": [
                "1 campaña con objetivo OUTCOME_LEADS",
                "Cada AdSet necesita ~50 conversiones/semana para salir de learning phase",
                "Variar creativos (3 ads por AdSet) — copy + imagen distintas",
                "Mantener PAUSED hasta que el usuario apruebe en Ads Manager",
                "No tocar el AdSet durante los primeros 7 días (learning phase)",
            ],
        }
    if platform == "tiktok":
        return {
            "campaigns": 1,
            "ad_sets_per_campaign": 1,
            "ads_per_ad_set": 5,
            "notas": [
                "Campaña con objetivo LEAD_GENERATION o TRAFFIC",
                "TikTok favorece variedad creativa — 5 videos por ad group",
                "Videos verticales 9:16, hook en los primeros 3 segundos",
                "Audiencias amplias (>1M) — el algoritmo encuentra mejor",
                "Soft-delete: si querés eliminar, queda como DISABLE (no hard-delete)",
            ],
        }
    if platform == "google_ads":
        return {
            "campaigns": 1,
            "ad_sets_per_campaign": 2,
            "ads_per_ad_set": 3,
            "notas": [
                "Campaña tipo SEARCH para intent activo, DISPLAY para retargeting",
                "Ad groups por intención: ej '<producto> precio' vs '<producto> mejor'",
                "3 RSAs (Responsive Search Ads) por ad group — variar headlines",
                "Keywords con match types: [exact] '\"phrase\"' y modificadores",
                "Quality Score afecta CPC — copy + landing relevantes",
            ],
        }
    return {"campaigns": 1, "ad_sets_per_campaign": 1, "ads_per_ad_set": 1, "notas": []}


def platform_recommender(
    objetivo: str,
    audiencia: dict,
    brand_config: dict,
    presupuesto_usd: float = 0.0,
) -> dict:
    """Recomienda la plataforma óptima dado el contexto."""
    objetivo_lower = (objetivo or "").lower()
    edad_min = int(audiencia.get("edad_min") or brand_config.get("publico_edad_min") or 25)
    edad_max = int(audiencia.get("edad_max") or brand_config.get("publico_edad_max") or 55)

    candidates = [
        ("meta", *_evaluate_meta(objetivo_lower, edad_min, edad_max)),
        ("tiktok", *_evaluate_tiktok(objetivo_lower, edad_min, edad_max)),
        ("google_ads", *_evaluate_google(objetivo_lower, edad_min, edad_max)),
    ]
    candidates.sort(key=lambda c: c[1], reverse=True)
    winner_platform, winner_score, winner_reason = candidates[0]

    rationale = (
        f"Adkio recomienda **{winner_platform}** (confianza {winner_score:.0%}) "
        f"porque: {winner_reason}."
    )

    return {
        "platform": winner_platform,
        "confidence": round(winner_score, 2),
        "rationale": rationale,
        "alternativas": [
            {"platform": p, "confidence": round(s, 2), "razon": r}
            for p, s, r in candidates[1:]
        ],
        "estructura_recomendada": _structure_for(winner_platform, presupuesto_usd),
    }


__all__ = ["platform_recommender"]
