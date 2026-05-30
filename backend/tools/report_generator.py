"""
Generates the final campaign report in Markdown.
Used after campaign_launcher returns — shown in the frontend preview panel.
"""
from backend.llm import call_llm


def report_generator(
    campaign_result: dict,
    all_tool_outputs: dict,
) -> str:
    budget_out = all_tool_outputs.get("budget_validator", {})
    audience_out = all_tool_outputs.get("audience_analyzer", {})
    copy_out = all_tool_outputs.get("copy_generator", {})
    validator_out = all_tool_outputs.get("campaign_validator", {})

    summary = _llm_summary(campaign_result, budget_out, audience_out, copy_out)

    warnings = validator_out.get("warnings", [])
    warnings_md = "\n".join(f"- ⚠️ {w}" for w in warnings) if warnings else "- ✅ Sin advertencias"

    paises = audience_out.get("paises", [])
    intereses = audience_out.get("intereses", [])
    reach = campaign_result.get("estimated_reach", "N/A")
    campaign_id = campaign_result.get("campaign_id", "N/A")
    status = campaign_result.get("status", "N/A")
    preview_url = campaign_result.get("preview_url")

    preview_line = f"\n🔗 [Ver en Meta Ads Manager]({preview_url})" if preview_url else ""

    report = f"""# Reporte de Campaña Adkio

## Resumen ejecutivo
{summary}

## Copy aprobado

**Headline:** {copy_out.get('headline', 'N/A')}

**Body:**
{copy_out.get('body', 'N/A')}

**CTA:** {copy_out.get('cta', 'N/A')}

## Audiencia configurada

| Campo | Valor |
|-------|-------|
| Países | {', '.join(paises)} |
| Intereses | {', '.join(intereses[:5])} |
| Edad | {audience_out.get('edad_min', 'N/A')}–{audience_out.get('edad_max', 'N/A')} años |
| Alcance estimado | {reach} |

## Presupuesto

| Campo | Valor |
|-------|-------|
| Presupuesto diario | ${budget_out.get('presupuesto_diario_calculado', 'N/A')} USD/día |
| Estado | {'✅ Aprobado' if budget_out.get('aprobado') else '❌ Rechazado'} |

## Advertencias

{warnings_md}

## Estado de campaña

| Campo | Valor |
|-------|-------|
| Campaign ID | `{campaign_id}` |
| Status | {status} |
{preview_line}

---
*Generado por Adkio — {_now_str()}*
"""

    return report.strip()


def _llm_summary(
    campaign_result: dict,
    budget_out: dict,
    audience_out: dict,
    copy_out: dict,
) -> str:
    messages = [
        {
            "role": "system",
            "content": (
                "Eres un estratega de marketing digital. Escribe un párrafo de 2-3 oraciones "
                "(español) resumiendo esta campaña publicitaria para el negocio del cliente, en la "
                "plataforma indicada. Sé específico con los números (alcance, presupuesto, países). "
                "Tono profesional y directo. No asumas un rubro específico."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Plataforma: {campaign_result.get('platform', 'meta')}\n"
                f"Headline: {copy_out.get('headline', '')}\n"
                f"Alcance estimado: {campaign_result.get('estimated_reach', 'N/A')}\n"
                f"Presupuesto diario: ${budget_out.get('presupuesto_diario_calculado', 0)}/día\n"
                f"Audiencia: {audience_out.get('intereses', [])[:3]} | Edad {audience_out.get('edad_min')}-{audience_out.get('edad_max')}\n"
                f"Países: {audience_out.get('paises', [])}"
            ),
        },
    ]

    try:
        resp = call_llm(messages)
        return resp.choices[0].message.content.strip()
    except Exception:
        return "Campaña lista para lanzar en Meta Ads."


def _now_str() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
