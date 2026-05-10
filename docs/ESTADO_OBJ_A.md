# Objetivo A — Estado actual y guía de integración con B

> Última actualización: 10 May 2026  
> Tests: **56/56 ✅** | Criterios de aceptación: **6/6 ✅**

---

## Qué hace Objetivo A (resumen rápido)

El Campaign Agent recibe un prompt del usuario y ejecuta 4 tools en orden estricto vía LLM tool use. Cada paso se emite en tiempo real como SSE al frontend.

```
POST /campaign  →  SSE stream
  1. budget_validator     ← valida presupuesto contra límites de Meta y de la marca
  2. audience_analyzer    ← genera segmentación de audiencia
  3. copy_generator       ← genera headline, body, CTA
  4. campaign_validator   ← checklist final (8 criterios)
  → event: plan_ready     ← el stream para aquí, espera aprobación humana

POST /campaign/approve  →  JSON
  5. campaign_launcher    ← lanza la campaña (mock calculado / sandbox Meta)
  6. report_generator     ← genera reporte markdown final
```

---

## Bugs corregidos (esta sesión)

Todos existían en el código original de Obj A y fueron corregidos antes de documentar esta integración.

| ID | Severidad | Archivo | Qué pasaba | Fix |
|---|---|---|---|---|
| A-08 | 🔴 Crítico | `budget_validator.py` | `ZeroDivisionError` si el LLM pasaba `duracion_dias=0` | Guard: `if duracion_dias <= 0: duracion_dias = 14` |
| A-01 | 🔴 Crítico | `campaign_agent.py` | `call_llm` síncrona bloqueaba el event loop de FastAPI completo | `await asyncio.to_thread(call_llm, ...)` |
| A-06 | 🔴 Crítico | `campaign_agent.py` | `_dispatch_tool` síncrona bloqueaba el event loop | `await asyncio.to_thread(_dispatch_tool, ...)` |
| A-02 | 🔴 Crítico | `campaign_agent.py` | Supabase I/O síncrona dentro del async generator bloqueaba antes del streaming | `_get_brand_config` ahora es `async def` con `asyncio.to_thread` |
| A-04 | 🟠 Alto | `campaign_agent.py` | Tool def de `campaign_validator` con `properties: {}` → el LLM podía no llamarlo y el stream terminaba sin `plan_ready` | Se agregó campo opcional `notas: string` en la definición |
| A-09 | 🟠 Alto | `audience_analyzer.py` | `_estimate_reach` retornaba 0 si `paises` estaba vacío → reach de 0 personas en el reporte | `max(len(paises), 1)` en el factor país |
| A-11 | 🟠 Alto | `campaign_validator.py` | Falso blocker `"El presupuesto no fue aprobado"` si el dict de budget estaba vacío (default `False`) | Lambda cambiada a `.get("aprobado") is not False` |
| A-13 | 🟠 Alto | `campaign_launcher.py` | Sandbox tragaba silenciosamente cualquier error de Meta y hacía fallback al mock sin avisar | `_log.warning(...)` antes del fallback |
| A-14 | 🟠 Alto | `campaign_launcher.py` | Status inconsistente: sandbox devolvía `"PAUSED"`, mock devolvía `"ACTIVE"` | Mock ahora devuelve `"PAUSED"` (toda campaña requiere HITL antes de activarse) |
| A-10 | 🟡 Medio | `audience_analyzer.py`, `copy_generator.py` | `split("```")[1]` explotaba con backtick simple o sin backticks en la respuesta del LLM | `re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)` |
| A-05 | 🟡 Medio | `campaign_agent.py` | `approve_and_launch` podía lanzar una campaña con presupuesto $0 silenciosamente | `if budget_usd <= 0: raise ValueError(...)` |

---

## Cómo está conectado con Objetivo B

La integración **ya está hecha en el código**. No hay TODOs ni mocks para reemplazar en Obj A.

### Único punto de contacto: `_get_brand_config`

```python
# backend/agents/campaign_agent.py
async def _get_brand_config(brand_id: str) -> dict:
    from backend.db.supabase_client import get_brand_config
    config = await asyncio.to_thread(get_brand_config, brand_id)
    if config is None:
        raise ValueError(f"Brand config '{brand_id}' no encontrado en Supabase")
    return config
```

Cuando el agente arranca, llama a esto **antes** de hacer cualquier tool call. Si Supabase no responde o el `brand_id` no existe, emite `event: error` y el stream termina limpiamente — no explota el servidor.

### Qué espera recibir de Objetivo B

El dict que retorne `get_brand_config(brand_id)` debe tener estos campos. Si falta alguno, los tools usan defaults internos pero la calidad del output baja.

```python
{
    # Sin estos el agente falla o produce resultados incorrectos
    "negocio_nombre":              str,        # usado en los prompts del sistema
    "negocio_industria":           str,        # contexto para el LLM
    "publico_paises":              list[str],  # ["Colombia", "Mexico", ...]
    "publico_edad_min":            int,
    "publico_edad_max":            int,
    "publico_intereses":           list[str],  # términos en inglés como aparecen en Meta
    "presupuesto_min_campana_usd": float,
    "presupuesto_max_campana_usd": float,

    # Afectan calidad del copy y la segmentación
    "propuesta_de_valor":          str,
    "publico_roles":               list[str],  # ["Founder", "CEO", ...]
    "tono_estilo":                 list[str],  # ["aspiracional", "directo"]
    "tono_evitar":                 list[str],
    "ejemplos_copy_aprobado":      list[str],

    # No bloquea nada si está ausente
    "pixel_configurado":           bool,
}
```

### Flujo completo con Supabase activo

```
POST /campaign { user_prompt, brand_id: "demo-edu-latam" }
    ↓
_get_brand_config("demo-edu-latam")
    ↓  — asyncio.to_thread, no bloquea el event loop —
supabase_client.get_brand_config("demo-edu-latam")   ← Objetivo B lo implementa
    ↓
brand_config dict disponible en el agente
    ↓
budget_validator(monto, brand_config, dias)    ← usa presupuesto_min/max de la marca
audience_analyzer(objetivo, brand_config)      ← usa paises, edad, intereses, roles
copy_generator(producto, audiencia, tono, ...) ← usa tono_estilo, tono_evitar, ejemplos
campaign_validator(params)
    ↓
event: plan_ready  →  frontend muestra preview + botón Aprobar
```

---

## Seed requerido en Supabase

El registro `demo-edu-latam` debe existir antes del demo. Si no está, el primer request al agente falla con `event: error`.

Para verificar:

```bash
PYTHONPATH=. .venv/bin/python3 -c "
from backend.db.supabase_client import get_brand_config
cfg = get_brand_config('demo-edu-latam')
print('OK —', cfg.get('negocio_nombre') if cfg else 'FALTA EL SEED')
"
```

Si el seed de Obj B ya corrió (`backend/db/seed.py`), esto devuelve `OK — AcademiaEjecutiva LATAM`.

---

## Cómo probar la integración

### Tests sin red (56/56, ~2 segundos)

No necesitan Groq ni Supabase — todo mockeado.

```bash
PYTHONPATH=. .venv/bin/python3 -m pytest tests/ -v
```

### Con Groq + Supabase reales

```bash
# 1. Levantar el servidor
PYTHONPATH=. .venv/bin/python3 -m uvicorn backend.main:app --reload

# 2. Health check
curl http://localhost:8000/health
# {"status":"ok","model":"groq/llama-3.3-70b-versatile","environment":"sandbox","campaign_agent":true}

# 3. Stream del agente — verás los tool calls llegar uno a uno
curl -X POST http://localhost:8000/campaign \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"user_prompt": "Llenar evento Bogota junio, 200 dolares, exclusivo", "brand_id": "demo-edu-latam"}'

# 4. Aprobar el plan (pegar el objeto "plan" del evento plan_ready)
curl -X POST http://localhost:8000/campaign/approve \
  -H "Content-Type: application/json" \
  -d '{"plan": { ... }}'
# Retorna: {"campaign_id": "act_...", "status": "PAUSED", "estimated_reach": "13K–26K personas", "report": "..."}
```

---

## Variables de entorno necesarias

```bash
# .env

# LLM — cambiar solo esta línea para cambiar de modelo
LLM_MODEL=groq/llama-3.3-70b-versatile
GROQ_API_KEY=...

# Supabase (Objetivo B las configura)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Meta (Objetivo C las configura)
META_AD_ACCOUNT_ID=act_...
META_USE_SANDBOX=false   # false = mock calculado | true = API real de Meta
```

---

## Lo que no hay que modificar

- **`backend/llm.py`** — no tocar. Para cambiar de modelo, solo cambiar `LLM_MODEL` en `.env`.
- **`backend/tools/`** — los 6 tools están terminados y testeados.
- **`backend/agents/campaign_agent.py`** — la integración con Supabase ya está en `_get_brand_config`. No hay TODOs.
- **`backend/main.py`** — los 4 endpoints de campaña (`/health`, `/campaign`, `/campaign/approve`, `/campaign/{id}`) están completos.
