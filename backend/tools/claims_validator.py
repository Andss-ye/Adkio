"""
claims_validator — detecta claims que Meta rechaza, antes del checklist final.

Determinista a propósito: regex + listas negras, sin LLM. Es un guardrail del
gasto, no una opinión — tiene que dar el mismo resultado siempre y no puede
quedar colgado de que un proveedor conteste.

Categorías y su severidad:

    promesa_de_resultado  blocker   "resultados garantizados", "100% efectivo"
    salud                 blocker   "cura la ansiedad", "bajá 10 kilos"
    antes_despues         blocker   "mirá el antes y después"
    atributo_personal     blocker   "¿sos diabético?" — le atribuye una condición
                                    al usuario; la causa nº1 de rechazo real
    superlativo           warning   "el mejor del mercado" — pasa si se puede
                                    sustentar, pero conviene revisarlo

Alcance: **solo copy en español**. Los patrones son castellanos, así que un copy
en inglés o portugués pasa limpio sin que nadie lo revise ("Guaranteed results in
30 days" → passed=True). Mientras `copy_generator` genere en español alcanza; el
día que se soporte otro idioma hay que sumar sus patrones o el guardrail deja de
existir para ese mercado.
"""
import re
from typing import Optional

_CAMPOS = ("headline", "body", "cta")

# Dolencias que convierten un verbo genérico ("cura", "elimina") en un claim de
# salud. Sin este complemento el verbo solo no alcanza: "elimina el papeleo" es
# un cliché de SaaS, no una promesa clínica.
_DOLENCIAS = (
    r"(?:ansiedad|depresi[oó]n|insomnio|estr[eé]s|dolor(?:es)?|migra[ñn]as?|"
    r"acn[eé]|celulitis|grasa|obesidad|sobrepeso|diabetes|hipertensi[oó]n|"
    r"c[aá]ncer|alergias?|adicci[oó]n(?:es)?|calvicie|artritis|gastritis|"
    r"colesterol|v[aá]rices|hongos|caspa|enfermedad(?:es)?|s[ií]ntomas?)\b"
)

# Los patrones se escriben sin acentos obligatorios ([aá]) porque el copy del LLM
# alterna entre voseo acentuado y no acentuado.
_PATRONES = {
    "promesa_de_resultado": [
        r"\bgarantiz[ao](?:d[ao]s?|mos|n)?\b",
        r"\b100\s*%\s*(?:efectiv[ao]|seguro|garantizado)\b",
        r"\bte\s+asegur(?:o|amos)\b",
        r"\bresultados?\s+(?:garantiz|asegur)\w*",
        r"\b(?:duplic|triplic|multiplic)\w*\s+(?:tus?|sus?)\s+\w+",
        r"\bsin\s+riesgos?\b",
        r"\bresultados?\s+en\s+\d+\s*(?:d[ií]as?|semanas?|horas?)\b",
    ],
    "salud": [
        # "cura"/"elimina" necesitan complemento clínico: sueltos bloqueaban copy
        # B2B normal ("elimina el papeleo", "el cura de la parroquia").
        r"\bcura(?:r|n|mos)?\s+(?:el|la|los|las|tu|tus|su|sus)?\s*" + _DOLENCIAS,
        r"\belimina(?:r|n|mos)?\s+(?:el|la|los|las|tu|tus|su|sus)?\s*" + _DOLENCIAS,
        r"\b(?:baj[aá]|perd[eé]|adelgaz[aá])\w*\s+\d+\s*(?:kilos?|kg|libras?)\b",
        r"\bquema\s+grasa\b",
        r"\bmilagros[ao]\b",
        r"\bsin\s+dieta\s+ni\s+ejercicio\b",
        r"\btratamiento\s+definitivo\b",
    ],
    "antes_despues": [
        r"\bantes\s+y\s+despu[eé]s\b",
        r"\bmir[aá]\s+(?:el|mi|su)\s+antes\b",
        r"\btransformaci[oó]n\s+en\s+\d+\s*(?:d[ií]as?|semanas?)\b",
        r"\bresultados?\s+en\s+fotos?\b",
    ],
    # Segunda persona + condición: lo que Meta llama "personal attributes".
    "atributo_personal": [
        r"\b(?:sos|eres|est[aá]s|ten[eé]s|tienes|sufr[ií]s|sufres)\s+"
        r"(?:\w+\s+){0,2}"
        r"(?:diab[eé]tic[ao]|deprimid[ao]|ansios[ao]|obes[ao]|gord[ao]|calv[ao]|"
        r"sol[ao]|divorciad[ao]|desemplead[ao]|endeudad[ao]|sobrepeso|depresi[oó]n|"
        r"ansiedad|deudas?)\b",
        r"\bvos\s+que\s+(?:sos|ten[eé]s|sufr[ií]s)\b",
        r"\bpara\s+(?:vos|ti|usted)\s+que\s+(?:sos|eres|ten[eé]s|tienes)\b",
    ],
    "superlativo": [
        # El sustantivo puede ir en el medio: "el mejor café del mercado".
        r"\b(?:el|la|los|las)\s+(?:m[aá]s\s+\w+|mejor(?:es)?)(?:\s+\w+){0,2}"
        r"\s+(?:del|de\s+l[ao]s?|en\s+el|en\s+la)\s+\w+",
        r"\b(?:el|la)\s+n[uú]mero\s+(?:uno|1)\b|\bel\s*#\s*1\b",
        r"\b[uú]nic[ao]\s+en\s+(?:el\s+mercado|su\s+categor[ií]a)\b",
        r"\bl[ií]der\s+(?:mundial|absolut[ao]|indiscutid[ao])\b",
        r"\binsuperable\b|\bimbatible\b",
    ],
}

# Lista negra por vertical: lo que en un rubro es agresivo y en otro es rechazo
# directo. Se suma a los patrones generales según la industria de la marca.
_PATRONES_POR_VERTICAL = {
    "salud": {
        "salud": [
            r"\b(?:trata|previene|revierte)\s+(?:el|la|los|las)\s+\w+",
            r"\bsin\s+efectos\s+secundarios\b",
            r"\bavalado\s+por\s+m[eé]dicos\b",
        ],
    },
    "finanzas": {
        "promesa_de_resultado": [
            r"\brentabilidad\s+(?:garantiz|asegur)\w*",
            r"\bganancias?\s+(?:garantiz|asegur)\w*",
            r"\bhacete\s+ric[ao]\b|\bhazte\s+ric[ao]\b",
            r"\bingresos?\s+pasivos?\s+garantiz\w*",
        ],
    },
}

# Qué industrias caen en cada vertical. Se compara por substring sobre
# `negocio_industria`, que es texto libre.
_VERTICALES = {
    "salud": ("salud", "medic", "clinic", "est[eé]tic", "nutrici", "bienestar", "fitness"),
    "finanzas": ("financ", "fintech", "invers", "credit", "cripto", "trading", "seguro"),
}

_BLOCKER_CATEGORIES = frozenset(
    {"promesa_de_resultado", "salud", "antes_despues", "atributo_personal"}
)

_SUGERENCIAS = {
    "promesa_de_resultado": "Cambiá la promesa por lo que ofrecés: 'ayudamos a', 'diseñado para'.",
    "salud": "Sacá el claim de salud. Describí el servicio, no el resultado clínico.",
    "antes_despues": "Meta rechaza el antes/después. Mostrá el producto o el proceso.",
    "atributo_personal": "No le atribuyas una condición al lector. Hablá del servicio en tercera persona.",
    "superlativo": "Sustentá el superlativo con un dato o bajalo a algo verificable.",
}

_ETIQUETAS = {
    "promesa_de_resultado": "promesa de resultado",
    "salud": "claim de salud",
    "antes_despues": "antes y después",
    "atributo_personal": "atributo personal",
    "superlativo": "superlativo",
}


def _vertical_de(industria: str) -> Optional[str]:
    industria = (industria or "").lower()
    for vertical, marcas in _VERTICALES.items():
        if any(re.search(m, industria) for m in marcas):
            return vertical
    return None


def _patrones_para(industria: str) -> dict:
    """Patrones generales + los del vertical de la marca, si cae en alguno."""
    patrones = {k: list(v) for k, v in _PATRONES.items()}
    extra = _PATRONES_POR_VERTICAL.get(_vertical_de(industria) or "", {})
    for categoria, regexes in extra.items():
        patrones.setdefault(categoria, []).extend(regexes)
    return patrones


def claims_validator(copy: dict, industria: str = "") -> dict:
    """Revisa headline, body y CTA contra las políticas de contenido de Meta.

    `industria` viene de `brand_config["negocio_industria"]` y activa la lista
    negra del vertical. Sin ella la revisión sigue corriendo con los patrones
    generales.
    """
    copy = copy if isinstance(copy, dict) else {}
    patrones = _patrones_para(industria)

    claims = []
    for campo in _CAMPOS:
        texto = copy.get(campo)
        if not isinstance(texto, str) or not texto.strip():
            continue
        for categoria, regexes in patrones.items():
            for regex in regexes:
                match = re.search(regex, texto, re.IGNORECASE)
                if not match:
                    continue
                claims.append(
                    {
                        "campo": campo,
                        "texto": match.group(0).strip(),
                        "categoria": categoria,
                        "severidad": (
                            "blocker" if categoria in _BLOCKER_CATEGORIES else "warning"
                        ),
                        "sugerencia": _SUGERENCIAS[categoria],
                    }
                )
                break  # una coincidencia por categoría y campo alcanza

    blockers = [c for c in claims if c["severidad"] == "blocker"]
    warnings = [c for c in claims if c["severidad"] == "warning"]

    return {
        "passed": not blockers,
        "blockers": [_humanize(c) for c in blockers],
        "warnings": [_humanize(c) for c in warnings],
        "claims": claims,
        "rationale": _rationale(blockers, warnings),
    }


def _humanize(claim: dict) -> str:
    return (
        f"«{claim['texto']}» en {claim['campo']} — {_ETIQUETAS[claim['categoria']]}. "
        f"{claim['sugerencia']}"
    )


def _rationale(blockers: list[dict], warnings: list[dict]) -> str:
    """Sin LLM: el panel de razonamiento tiene que poder mostrar esto siempre."""
    if not blockers and not warnings:
        return (
            "El copy no tiene claims que violen las políticas de contenido de Meta: "
            "sin promesas de resultado, claims de salud ni atributos personales."
        )
    if not blockers:
        categorias = ", ".join(sorted({_ETIQUETAS[c["categoria"]] for c in warnings}))
        return (
            f"El copy pasa, con {len(warnings)} advertencia(s) de {categorias}. "
            "No bloquean el lanzamiento, pero conviene poder sustentarlas."
        )
    categorias = ", ".join(sorted({_ETIQUETAS[c["categoria"]] for c in blockers}))
    return (
        f"El copy tiene {len(blockers)} claim(s) que Meta rechaza en ad review: "
        f"{categorias}. Hay que reescribirlos antes de aprobar la campaña."
    )
