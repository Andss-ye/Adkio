# Adkio — Master Context

> **Lee esto completo antes de escribir código.** Única fuente de verdad del proyecto.
> Si cambiás un schema, una decisión técnica, o una integración → actualizá este archivo en el mismo PR.
>
> Última actualización: 10 May 2026, 01:00 — stack definitivo confirmado.

---

## Estado del proyecto

- Pitch del sábado entregado. Idea recibió feedback muy positivo de mentores.
- Mentora de 30X interesada — si hay MVP funcional mañana en la tarde, agenda reunión con Andrés Bilbao (co-founder de Rappi y 30X).
- Deadline real: mañana 12 AM (entrega final hackathon). Deadline interno: tarde de mañana (mentoría 1-a-1 por videollamada).
- Equipo: 4 personas, todos con Claude Code, todos trabajan en backend + tools según objetivos asignados.

---

## Qué es Adkio

Agente de IA que ejecuta campañas en Meta Ads desde lenguaje natural. El usuario escribe lo que quiere, Adkio conoce su marca, configura todo correctamente (audiencia, copy, presupuesto, validación de fase de aprendizaje de Meta), y lanza con aprobación humana.

**No es un generador de copy.** Codifica conocimiento experto de Meta Ads y lo ejecuta autónomamente.

**Vertical inicial:** educación ejecutiva en LATAM. Alto CPL, ROI claro de automatización, mentora de 30X involucrada.

**Human-in-the-loop (HITL):** modo default. Adkio prepara el plan completo, el usuario aprueba con un click, entonces lanza. Esto es un feature, no una limitación — se vende como "transparencia y control."

---

## Modelo de negocio

SaaS en la nube. El cliente ya gasta en ads — Adkio es eficiencia sobre lo que ya pagan.

| Plan | Precio | Incluye |
|---|---|---|
| Starter | $99/mes | Hasta $2K USD/mes en ad spend, 1 marca |
| Growth | $249/mes | Hasta $10K USD/mes, 3 marcas |
| Scale | $599/mes + 1% ad spend | Ilimitado, multi-usuario |

---

## Stack técnico — DEFINITIVO

| Capa | Tech | Decisión |
|---|---|---|
| LLM | Groq (Llama 3.3 70B) — gratis ahora | Cambia a Anthropic Claude con 1 línea cuando lleguen créditos |
| Wrapper LLM | `litellm` | Abstrae Groq / Gemini / Anthropic — misma API para todos |
| Backend | Python 3.11 + FastAPI | Async, rápido, tool use via litellm |
| Frontend | Vite + React 18 + TypeScript + Tailwind | Sin Next.js — SPA puro, más rápido de desarrollar |
| Componentes UI | Tailwind custom + shadcn solo donde duele (Dialog, Toast) | NO shadcn default — look propio |
| DB | Supabase (Postgres) | 5 min setup, free tier suficiente para demo |
| Meta Ads | Sandbox/mock (verificación oficial en proceso) | Meta API real esperando aprobación esta semana |
| Deploy | Vercel (front) + Railway (back) | Deploy en 1 click, URLs públicas |

**NO usar:** Next.js, LangChain, MCP servers (van en roadmap), Docker para el demo, Streamlit.

---

## Cómo cambiar de modelo LLM

Toda la lógica de LLM pasa por `litellm`. Para cambiar de modelo, solo cambiás la variable de entorno `LLM_MODEL`. Sin tocar código.

```python
# backend/llm.py — único lugar donde se configura el LLM
from litellm import completion
import os

LLM_MODEL = os.environ.get("LLM_MODEL", "groq/llama-3.3-70b-versatile")

def call_llm(messages, tools=None, stream=False):
    kwargs = {
        "model": LLM_MODEL,
        "messages": messages,
        "stream": stream,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    return completion(**kwargs)
```

Modelos disponibles (sin cambiar código, solo env var):

| Proveedor | `LLM_MODEL` | Estado |
|---|---|---|
| Groq | `groq/llama-3.3-70b-versatile` | Default — gratis |
| Groq alternativa | `groq/llama-3.1-70b-specdec` | Más rápido, menos capaz |
| Gemini | `gemini/gemini-2.0-flash` | Gratuito, buena alternativa |
| Anthropic | `anthropic/claude-sonnet-4-5` | Mejor tool use — activar cuando lleguen créditos |

**Nota importante sobre tool use en Groq:** `llama-3.3-70b-versatile` tiene buen soporte de function calling pero puede ser menos predecible que Claude. El Objetivo A debe testearlo temprano y ajustar los system prompts si hace falta.

---

## Arquitectura del sistema

```
┌────────────────────────────────────────────────────────┐
│               FRONTEND (Vite + React)                  │
│  Chat conversacional + Panel de razonamiento + Preview │
└──────────────────────┬─────────────────────────────────┘
                       │ POST /campaign  (SSE streaming)
                       ▼
┌────────────────────────────────────────────────────────┐
│              BACKEND (FastAPI + Python)                │
│                                                        │
│  ┌──────────────────┐    ┌────────────────────────┐    │
│  │ Onboarding Agent │    │    Campaign Agent      │    │
│  │  (genera config) │───▶│  (litellm + tool use)  │    │
│  └──────────────────┘    └────────────┬───────────┘    │
│                                       │                │
│       ┌───────────────────────────────┼──────────┐     │
│       ▼               ▼              ▼           ▼     │
│  budget_validator  audience_   copy_       campaign_   │
│                    analyzer    generator   validator   │
│                                            campaign_   │
│                                            launcher    │
│                                            report_     │
│                                            generator   │
└────────────────────────────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   Meta Ads API         │
          │   (sandbox / mock)     │
          └────────────────────────┘
```

`brand_config` persiste en Supabase. Una fila por marca.

---

## Schemas — NO cambiar sin avisar al equipo

### `brand_config` (tabla Supabase)

```python
{
  "id": "uuid",
  "negocio_nombre": "str",
  "negocio_industria": "str",
  "propuesta_de_valor": "str",
  "publico_roles": ["str"],
  "publico_paises": ["str"],
  "publico_edad_min": "int",
  "publico_edad_max": "int",
  "publico_intereses": ["str"],
  "presupuesto_min_campana_usd": "float",
  "presupuesto_max_campana_usd": "float",
  "tono_estilo": ["str"],
  "tono_evitar": ["str"],
  "ejemplos_copy_aprobado": ["str"],
  "pixel_configurado": "bool",
  "created_at": "timestamp"
}
```

### Tool I/O contracts

```python
copy_generator(
  producto: str,
  audiencia: dict,
  canal: str,             # "instagram" | "facebook"
  tono: dict,
  nivel_consciencia: str  # "problem_aware" | "solution_aware" | "product_aware"
) -> {
  "headline": str,
  "body": str,
  "cta": str,
  "rationale": str        # explicacion — se muestra en el panel de razonamiento del frontend
}

audience_analyzer(
  objetivo: str,
  brand_config: dict
) -> {
  "intereses": list[str],
  "edad_min": int,
  "edad_max": int,
  "paises": list[str],
  "tamano_estimado": int,
  "exclusiones": list[str],
  "rationale": str
}

campaign_validator(
  campaign_params: dict
) -> {
  "passed": bool,
  "warnings": list[str],
  "blockers": list[str],
  "checklist_results": dict,
  "rationale": str
}

budget_validator(
  monto_usd: float,
  brand_config: dict,
  duracion_dias: int
) -> {
  "aprobado": bool,
  "warnings": list[str],
  "presupuesto_diario_calculado": float,
  "rationale": str
}

campaign_launcher(
  canal: str,
  copy: dict,
  targeting: dict,
  budget: float,
  duracion_dias: int
) -> {
  "campaign_id": str,
  "status": str,
  "estimated_reach": str,
  "preview_url": str | None
}

report_generator(
  campaign_result: dict,
  all_tool_outputs: dict
) -> str  # markdown con el reporte final
```

**Todos los tools deben incluir `rationale`** — es el texto que el frontend muestra en el panel de razonamiento mientras el agente trabaja. Es el momento WOW de la demo.

---

## Demo flow (mañana — este es el guion)

1. Brand config ya cargado en Supabase (`demo-edu-latam` — AcademiaEjecutiva LATAM)
2. Usuario escribe en el chat: *"Quiero llenar nuestro evento en Bogotá, 15 de junio, $200, somos exclusivos"*
3. El panel de razonamiento muestra en streaming los tool calls uno por uno con sus rationales
4. Preview de campaña aparece a la derecha: copy generado, audiencia configurada, CPL estimado, advertencias
5. Botón grande "Aprobar y lanzar"
6. Click → mock de Meta devuelve campaign_id real con formato correcto → reporte final

**El momento WOW es el paso 3.** No puede ser un loading genérico — tienen que verse los pasos del agente pensando.

### Qué decir sobre Meta en el pitch

> *"El flujo end-to-end con Meta Marketing API está implementado. La verificación oficial de nuestra app está en proceso — Meta toma 2 a 5 días hábiles. Lo que ven es nuestro sandbox con el mismo schema de la API real."*

Esto es honesto, profesional, y no genera preguntas.

---

## Sistema de diseño del frontend

Claude Code del Objetivo D usa esto como referencia:

```
Background principal:  #0A0E14
Surface / cards:       #131820
Accent:                #00D4A8  (verde mate — NO neon, NO purple)
Texto principal:       #E8ECF1
Texto muted:           #6B7280
Border:                rgba(255, 255, 255, 0.07)
Font body:             Inter (Google Fonts)
Font mono:             JetBrains Mono (para tool names, IDs, campaign_id)
Border radius base:    8px
Border radius cards:   12px
Spacing:               múltiplos de 4px

Prohibido: gradientes purple, azul Vercel, shadcn out-of-the-box,
           cualquier cosa que se vea como "AI hackathon genérico"
Inspiración: Linear, Raycast, Anthropic Console
```

---

## Estructura del repo

```
adkio/
├── CONTEXT.md               ← este archivo — leer siempre primero
├── OBJECTIVES.md            ← objetivos vivos — actualizar con status
├── .env.example
├── backend/
│   ├── main.py              ← FastAPI entry + endpoints
│   ├── llm.py               ← wrapper litellm — ÚNICO punto de config del LLM
│   ├── agents/
│   │   ├── campaign_agent.py
│   │   └── onboarding_agent.py
│   ├── tools/
│   │   ├── copy_generator.py
│   │   ├── audience_analyzer.py
│   │   ├── campaign_validator.py
│   │   ├── budget_validator.py
│   │   ├── campaign_launcher.py
│   │   └── report_generator.py
│   ├── integrations/
│   │   └── meta_ads.py
│   ├── db/
│   │   └── supabase_client.py
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   └── components/
    │       ├── Chat.tsx
    │       ├── ReasoningPanel.tsx
    │       └── CampaignPreview.tsx
    └── package.json
```

---

## Variables de entorno

```bash
# .env.example — copiar a .env y completar

# LLM — cambiar solo esta línea para cambiar de modelo
LLM_MODEL=groq/llama-3.3-70b-versatile

# Groq (default, gratis)
GROQ_API_KEY=

# Gemini (alternativa gratuita)
GEMINI_API_KEY=

# Anthropic (cuando lleguen créditos)
ANTHROPIC_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Meta Ads
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=
META_USE_SANDBOX=true

# Frontend
VITE_BACKEND_URL=http://localhost:8000
```

---

## Workflow de coordinación entre Claudes

- Repo en GitHub, `main` protegida.
- Cada Claude Code trabaja en su rama: `obj-a/...`, `obj-b/...`, `obj-c/...`, `obj-d/...`
- Commits con formato: `[obj-X] descripción`
- PRs con descripción clara de qué hace, qué archivos toca, qué dependencias agregó
- Si cambiás un schema → actualizá CONTEXT.md en el mismo PR
- Mock-first: si dependés de otro objetivo que no está listo, escribí un mock que respete el schema exacto

---

## Lo que NO se hace mañana

Multi-tenant con auth, TikTok Ads, Stripe, tests automatizados, onboarding visual elaborado, MCPs. Todo es roadmap.

---

## Roadmap para el pitch

- Sprint 2: TikTok Ads, LinkedIn Ads, Meta verificación completa
- Sprint 3: MCP integrations (HubSpot, Salesforce, Slack)
- Sprint 4: Modo autopiloto, reglas de optimización automática
- Sprint 5: Multi-vertical (e-commerce, SaaS B2B)

---

## Log de cambios

```
10 May 01:00 — v3.0 — stack definitivo
  • LLM: Groq (Llama 3.3 70B) via litellm — gratis ahora, Anthropic con 1 línea cuando lleguen créditos
  • Frontend: Vite + React (NO Next.js) — SPA puro
  • Meta: sandbox/mock confirmado, verificación oficial iniciada
  • Sistema de diseño definido para frontend
  • HITL confirmado como feature default
```
