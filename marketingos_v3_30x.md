# MarketingOS v3 — Vertical: Educación Ejecutiva & Networking
## Enfocado en el nicho 30X

---

## Contexto: ¿Quién es 30X?

30X es una plataforma de educación ejecutiva y red de negocios creada por los hermanos Andrés y Daniel Bilbao junto con Dylan Rosemberg, enfocada en líderes de Latinoamérica y el mundo hispanohablante. El programa combina inmersiones presenciales de tres días con entrenamientos online en ventas, negociación, persuasión e inteligencia artificial para directivos.

30X busca crear entornos de conexión en los que los líderes puedan aprender entre pares, contrastar decisiones y evitar el aislamiento que suele acompañar el rol del emprendedor. Hasta la fecha, el programa ha impactado a más de 1.000 personas en países como Colombia, Chile, Perú y Argentina.

**Por qué este nicho es el correcto para el MVP:**
- Ticket alto (programas ejecutivos: $500–$3,000 USD)
- Público definido: fundadores, CEOs, directivos
- Ciclo de venta basado en confianza y autoridad — exactamente donde el copy bien segmentado hace diferencia
- Meta Ads funciona bien para captación de leads en educación premium

---

## Referente: Felipe Vergara (framework de campañas)

Felipe Vergara es consultor de marketing digital que ha invertido más de $35,000,000 de dólares en publicidad en Meta, Google y TikTok, y ayuda a empresas que invierten más de $2,500 USD/mes en ads a escalar sus ventas rentablemente.

Sus principios aplicables a este nicho:

Antes de vender, debes conocer a quién le estás hablando. Los 7 elementos esenciales que motivan cualquier compra. Copywriting estratégico: cómo escribir anuncios que vendan según el nivel de consciencia del cliente.

Facebook necesita tiempo para aprender quiénes responden a los anuncios. Si se editan las campañas demasiado seguido se perderá este aprendizaje y nunca se aprovechará todo el potencial que tiene la plataforma.

---

## Framework: ¿Qué hace una campaña "buena"?

Basado en las mejores prácticas del sector y el enfoque de Felipe Vergara, el agente valida campañas contra este checklist antes de lanzar:

### Checklist de campaña bien configurada

```
OBJETIVO
  ☐ Objetivo alineado con la etapa del funnel (no usar Conversión para audiencia fría)
  ☐ KPI principal definido (CPL, ROAS, CPA)

AUDIENCIA
  ☐ Público suficientemente específico (no broad sin historial)
  ☐ Tamaño de audiencia dentro del rango viable (100K–2M para nicho ejecutivo)
  ☐ Exclusiones configuradas (evitar impactar a clientes actuales)

PRESUPUESTO
  ☐ Mínimo $5 USD/día por conjunto de anuncios para que el algoritmo aprenda
  ☐ No tocar la campaña en los primeros 7 días (fase de aprendizaje de Meta)
  ☐ ROAS mínimo esperado definido antes de lanzar

COPY & CREATIVIDAD
  ☐ Headline ataca un dolor específico del ICP
  ☐ Nivel de consciencia del público mapeado (problema-aware vs solution-aware)
  ☐ CTA claro y consistente con la landing

TÉCNICO
  ☐ Pixel instalado y verificado
  ☐ Evento de conversión configurado (Lead, Purchase, etc.)
  ☐ URL de destino con UTMs para trazabilidad
```

El agente corre este checklist como `campaign_validator` tool antes de llamar a `campaign_launcher`.

---

## Los Dos Tipos de Campaña para 30X

Los mentores lo señalaron explícitamente: **público general vs público técnico**. Para educación ejecutiva, la distinción es:

### Tipo 1: Campaña de Reconocimiento / Tráfico Frío
**Objetivo Meta:** Leads / Tráfico
**Para quién:** Fundadores y CEOs que no conocen 30X todavía

```
Público:
  Intereses: "entrepreneurship", "business networking", "executive education",
             "Rappi" (marca asociada a Andrés Bilbao), "startup", "scaling business"
  Edad: 28–50
  Cargo inferido por comportamiento: business decision makers
  Países: Colombia, México, Perú, Argentina (en ese orden de prioridad)
  Tamaño estimado: 800K–2M personas

Copy angle:
  Problema-aware: "¿Cuántas decisiones importantes tomas solo?"
  Ángulo emocional: aislamiento del líder, falta de pares de nivel

Formato recomendado:
  Video corto (15–30s) testimonial de alumni
  o imagen con stat impactante ("El 80% de los CEOs dice que su mayor
  problema es no tener con quién pensar")

Presupuesto mínimo viable:
  $15–30 USD/día, mínimo 7 días antes de evaluar
```

### Tipo 2: Campaña de Conversión / Tráfico Caliente
**Objetivo Meta:** Leads (formulario nativo) o Conversiones (landing)
**Para quién:** Personas que ya interactuaron con contenido de 30X, visitaron la web, o son lookalike de alumni

```
Público:
  Custom Audience: visitantes web últimos 30 días
  Custom Audience: interactuaron con posts/videos de 30X
  Lookalike 1%: basado en lista de alumni actuales
  Exclusión: clientes actuales

Copy angle:
  Solution-aware: "Ya sabes lo que es 30X. El próximo programa es en [ciudad]."
  Urgencia real: cupos limitados, fecha de cierre
  Social proof: "Más de 1.000 líderes ya escalaron con nosotros"

Formato recomendado:
  Imagen estática con fecha y ciudad del evento
  o Carrusel con testimonios de alumni conocidos

Presupuesto mínimo viable:
  $10–20 USD/día (audiencia más pequeña y caliente)
```

---

## Cómo el Agente Decide Qué Tipo Lanzar

```python
def decide_campaign_type(brand_config: dict, admin_prompt: str) -> CampaignType:
    """
    Lógica de decisión basada en el objetivo y el estado de la cuenta.
    """
    has_custom_audiences = brand_config.get("has_pixel_data", False)
    budget = extract_budget(admin_prompt)
    goal = classify_goal(admin_prompt)
    # goal puede ser: awareness, leads, conversions, event_registrations

    if goal in ("awareness", "reach"):
        return CampaignType.COLD_TRAFFIC
    
    if goal in ("leads", "conversions", "registrations"):
        if has_custom_audiences:
            # Tiene pixel con datos → puede hacer retargeting
            return CampaignType.WARM_CONVERSION
        else:
            # Sin historial → empieza con frío + intereses
            return CampaignType.COLD_LEADS
    
    # Default: leads con audiencia fría (más seguro para cuenta nueva)
    return CampaignType.COLD_LEADS
```

El agente **explica su decisión al admin** antes de lanzar:

```
🤖 "Voy a lanzar una campaña de captación de leads con audiencia fría,
    porque aún no tienes datos de pixel suficientes para retargeting.
    Objetivo: conseguir registros de interés al próximo evento.
    Presupuesto: $20 USD/día × 7 días = $140 total.
    
    En 7 días tendremos datos para evaluar si escalar o ajustar."
```

---

## Segmentación Específica para 30X

### Intereses que funcionan para educación ejecutiva en Meta

```yaml
intereses_primarios:
  - "Entrepreneurship"
  - "Business networking"
  - "Leadership development"
  - "Executive education"
  - "Startup company"
  - "Venture capital"
  - "Angel investing"

intereses_secundarios:
  - "Harvard Business Review"
  - "Forbes"
  - "Rappi"              # marca asociada al fundador
  - "Y Combinator"
  - "TED Talks"
  - "Growth hacking"

comportamientos:
  - "Business decision makers"
  - "Small business owners"
  - "Frequent international travelers"  # señal de nivel ejecutivo

excluir:
  - Estudiantes universitarios (comportamiento)
  - Intereses solo en búsqueda de empleo
```

### Por qué reducir el nicho (recomendación mentores)

Un público de 5M personas para educación ejecutiva premium desperdicia presupuesto. El algoritmo de Meta necesita señales claras. Para 30X, mejor:

```
❌ Broad: "emprendedores en Colombia" → 4.2M personas, CPL alto, señal débil
✅ Nicho:  intereses ejecutivos + comportamiento decision maker + 28-45 años → 400K personas, CPL más bajo, calidad mayor
```

---

## brand_config.md — Ejemplo para 30X

```yaml
---
negocio:
  nombre: "30X"
  industria: "educación ejecutiva / networking empresarial"
  propuesta_de_valor: "Inmersiones presenciales y online para que fundadores y CEOs escalen sus empresas aprendiendo de quienes ya lo hicieron"
  website: "https://30x.com"
  fundadores_conocidos: ["Andrés Bilbao", "Daniel Bilbao", "Dylan Rosemberg"]
  credibilidad_anchor: "Co-fundadores de Rappi"

publico_objetivo:
  rol:
    - "Fundador / Co-fundador"
    - "CEO"
    - "Director General"
    - "C-Suite"
  edad_min: 28
  edad_max: 52
  experiencia_empresarial_min_anos: 3
  tamano_empresa: "5–200 empleados"
  paises_prioritarios:
    - "Colombia"
    - "México"
    - "Perú"
    - "Argentina"
  nivel_ingreso: "alto"

tipos_de_campana:
  cold_traffic:
    objetivo_meta: "LEAD_GENERATION"
    angulo: "dolor del aislamiento del lider"
    presupuesto_minimo_dia_usd: 15
    duracion_minima_dias: 7
  warm_conversion:
    objetivo_meta: "CONVERSIONS"
    angulo: "urgencia + social proof"
    presupuesto_minimo_dia_usd: 10
    requiere_pixel_data: true

presupuesto:
  minimo_campana_usd: 100
  maximo_campana_usd: 500
  alerta_si_supera_usd: 400

tono:
  estilo:
    - "aspiracional"
    - "directo"
    - "basado en pares"
  evitar:
    - "lenguaje de autoayuda genérico"
    - "promesas vacías de éxito"
    - "tono académico/universitario"
  ejemplos_copy_aprobado:
    - "¿Cuántas decisiones importantes tomas completamente solo?"
    - "Los mejores líderes no crecen solos. Crecen con los correctos."
    - "No un MBA. Una red de personas que ya lo lograron."

pixel_configurado: false   # cambiar a true cuando se instale
version: "1.0"
---
```

---

## Investigación Estratégica del Agente (nueva feature)

Los mentores pidieron explícitamente: **"investigación respaldada por fuentes con autoridad"**. El agente ahora tiene una fase de research antes de generar el copy.

### Tool: `research_campaign_context`

```python
def research_campaign_context(nicho: str, objetivo: str) -> ResearchResult:
    """
    Antes de generar copy, el agente investiga:
    1. Qué ángulos emocionales funcionan en este nicho
    2. Benchmarks de CPL para este tipo de campaña
    3. Qué objeciones típicas tiene el público objetivo
    
    Usa web_search con fuentes de autoridad:
    - felipevergara.co (Meta Ads en LATAM)
    - meta.com/business/ads-guide (documentación oficial)
    - Estudios de caso del nicho
    """
```

El agente cita sus fuentes en el reporte final:

```
📊 Research previo al lanzamiento:
   - CPL benchmark para educación ejecutiva LATAM: $8–25 USD/lead
   - Ángulo con mayor CTR en este nicho: "aislamiento del CEO" (Vergara, 2024)
   - Formato con mejor CPL para eventos: imagen estática con fecha + lugar
   - Fase de aprendizaje Meta: mínimo 7 días sin editar
```

---

## Flujo Completo para 30X

```
Admin (equipo 30X): "Quiero una campaña para el evento de Bogotá
                     el 15 de junio, cupos limitados a 40 personas,
                     presupuesto $200"

Agente:
  1. Lee brand_config.md de 30X
  2. Clasifica: goal=event_registration, budget=$200, audience=cold
     → Tipo: COLD_LEADS

  3. research_campaign_context("educación ejecutiva", "event_registration")
     → CPL benchmark: $8-25 USD → con $200 esperamos 8-25 leads calificados

  4. campaign_validator(checklist)
     → ✓ objetivo correcto
     → ✓ presupuesto sobre mínimo ($15/día × 13 días hasta evento)
     → ✗ pixel no configurado → advertencia en reporte, continúa

  5. audience_analyzer({
       tipo: "cold",
       intereses: brand_config.intereses_ejecutivos,
       geo: "Bogotá, Colombia",
       edad: "28-52"
     })
     → Audiencia estimada: 180,000 personas

  6. copy_generator({
       angulo: "urgencia + cupos limitados",
       evento: "Bogotá, 15 junio",
       tono: brand_config.tono,
       nivel_consciencia: "problem_aware"
     })
     → Headline: "40 líderes. 3 días. Bogotá."
     → Body: "El programa donde los fundadores que ya escalaron
               comparten lo que nunca dirían en público."
     → CTA: "Ver cupos disponibles"

  7. image_selector(objetivo="evento presencial ejecutivo")
     → Selecciona foto de evento anterior con sala llena

  8. campaign_launcher(sandbox)
     → campaign_id: FB_30X_BOG_001

  9. report_generator()
     → Reporte con: CPL esperado, audiencia, copy usado,
                    advertencia de pixel, próximos pasos
```

---

## Estructura del Proyecto (sin cambios del v2)

```
marketingos/
├── .env
├── models.py                    # SQLAlchemy + PostgreSQL
├── agents/
│   ├── onboarding_agent.py      # Genera brand_config.md via conversación
│   └── campaign_agent.py        # Orchestrator
├── tools/
│   ├── scrape_product_url.py
│   ├── analyze_images.py
│   ├── generate_brand_config.py
│   ├── research_campaign_context.py  # NUEVA — research con web_search
│   ├── campaign_validator.py         # NUEVA — checklist pre-lanzamiento
│   ├── budget_validator.py
│   ├── audience_analyzer.py
│   ├── copy_generator.py
│   ├── image_selector.py
│   ├── campaign_launcher.py
│   └── report_generator.py
├── api/
│   └── main.py
└── frontend/
    └── app.py
```

---

## KPIs del Demo para Jueces

| Métrica | Valor esperado para 30X | Fuente |
|---|---|---|
| CPL (costo por lead) | $8–25 USD | Benchmark LATAM educación ejecutiva |
| CTR esperado | 1.5–3% | Meta Ads nicho B2B premium |
| Audiencia recomendada | 150K–500K | Nicho reducido, señal fuerte |
| Presupuesto mínimo para aprender | $100 USD / 7 días | Regla de Felipe Vergara |
| Tiempo de fase de aprendizaje | 7 días sin tocar | Meta oficial |

---

## Lo que cambió vs v2 (resumen de cambios por los mentores)

| Cambio | Implementación |
|---|---|
| Framework de campaña buena | `campaign_validator` con checklist |
| Dos tipos de campaña | `CampaignType.COLD_TRAFFIC` vs `WARM_CONVERSION` |
| Tener en cuenta el público | Segmentación específica en brand_config + `decide_campaign_type()` |
| Investigación con fuentes | Tool `research_campaign_context` con web_search |
| Reducir el nicho | Audiencia 150K–500K en vez de broad |
| Verticalizar en 30X | brand_config.md con campos específicos del nicho ejecutivo |
| Felipe Vergara como referente | Sus principios codificados en el checklist y en benchmarks |
