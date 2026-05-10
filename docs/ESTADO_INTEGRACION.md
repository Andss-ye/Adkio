# Adkio — Estado de integración y handoff para Andrew
> Actualizado: 10 May 2026 — Freddy (integrador)
> Branch actual de trabajo: `bugfix/jonathan-bugs` → mergear a `main`

---

## Lo que está en `main` ahora mismo

El backend está completo e integrado. Esto corre:

```bash
PYTHONPATH=. .venv/bin/python3 -m uvicorn backend.main:app --reload
```

### Endpoints disponibles

| Endpoint | Descripción |
|---|---|
| `GET /health` | 200 + `campaign_agent: true` |
| `POST /campaign` | SSE stream: 4 tool calls + `plan_ready` |
| `POST /campaign/approve` | Lanza campaña, retorna `campaign_id` + reporte |
| `GET /campaign/{id}` | Estado de la campaña |
| `POST /onboarding/start` | Inicia conversación de onboarding |
| `POST /onboarding/message` | Turno de onboarding con confidence_score |
| `GET /brand-config/{id}` | Lookup por UUID o slug (`demo-edu-latam`) |

### Test e2e completo (corre esto para verificar)

```bash
# Terminal 1
PYTHONPATH=. .venv/bin/python3 -m uvicorn backend.main:app --port 8000

# Terminal 2
PYTHONPATH=. .venv/bin/python3 scripts/test_e2e_campaign.py
# Resultado esperado: 5s, 0 fallbacks, flujo completo OK
```

---

## Qué hizo esta sesión de integración

### Mergeado de Andrew (obj-a/campaign-agent)
Los 11 bugs del Objetivo A ya están en `main`:
- A-01/02/06: async fixes (bloqueaban el event loop completo de FastAPI)
- A-08: ZeroDivisionError en budget_validator con duracion=0
- A-04: campaign_validator no se llamaba por tool definition vacía
- A-05/09/10/11/13/14: fixes menores de calidad

### Bugs de Jonathan corregidos (branch: `bugfix/jonathan-bugs`)

| Bug | Archivo | Fix |
|---|---|---|
| B-02 | `supabase_client.py` | `_SCHEMA_FIELDS` whitelist filtra `campos_inferidos` del LLM |
| B-03 | `supabase_client.py` | Guard `if not result.data: raise RuntimeError(...)` |
| B-05 | `onboarding_agent.py` | `_parse_json()` con try/except — fallback `{}` fuerza nueva pregunta |
| B-06 | `onboarding_agent.py` | `_next_question` usa `FIELD_QUESTIONS` directo (1 LLM call/turno en vez de 2) |
| B-08 | `main.py` | Historial guarda mensaje del asistente también cuando `type="config"` |

Bugs que NO aplican: B-01/B-11 (slug existe en Supabase), B-04/07/09/10/12 (edge cases, no bloquean demo).

---

## Supabase — configuración actual

**Proyecto:** `adkio` (ref: `aphrujuaklsytbnhcthm`, West US Oregon)

**Tabla `brand_configs`** ya creada con este schema (ver `backend/db/schema.sql`):

```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
slug         TEXT UNIQUE                    -- "demo-edu-latam", lookup amigable
negocio_nombre              TEXT NOT NULL
negocio_industria           TEXT NOT NULL
propuesta_de_valor          TEXT NOT NULL
publico_roles               TEXT[]
publico_paises              TEXT[]
publico_edad_min            INTEGER
publico_edad_max            INTEGER
publico_intereses           TEXT[]
presupuesto_min_campana_usd NUMERIC(10,2)
presupuesto_max_campana_usd NUMERIC(10,2)
tono_estilo                 TEXT[]
tono_evitar                 TEXT[]
ejemplos_copy_aprobado      TEXT[]
pixel_configurado           BOOLEAN
metadata                    JSONB
created_at                  TIMESTAMPTZ DEFAULT NOW()
updated_at                  TIMESTAMPTZ DEFAULT NOW()
```

**Seed `demo-edu-latam` ya insertado.** Para verificar:

```bash
PYTHONPATH=. .venv/bin/python3 -c "
from dotenv import load_dotenv; load_dotenv()
from backend.db.supabase_client import get_brand_config
cfg = get_brand_config('demo-edu-latam')
print('OK —', cfg['negocio_nombre'] if cfg else 'FALTA EL SEED')
"
# Esperado: OK — AcademiaEjecutiva LATAM
```

---

## Variables de entorno necesarias (`.env`)

```bash
LLM_MODEL=groq/llama-3.3-70b-versatile
GROQ_API_KEY=...           # ya configurada

SUPABASE_URL=https://aphrujuaklsytbnhcthm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # pedir a Freddy

META_AD_ACCOUNT_ID=act_...
META_USE_SANDBOX=false     # false=mock calculado | true=API real
META_ACCESS_TOKEN=...      # para sandbox real
META_APP_ID=...
META_APP_SECRET=...

# Cuando lleguen créditos Anthropic (sponsor del hackathon):
# LLM_MODEL=anthropic/claude-sonnet-4-5
# ANTHROPIC_API_KEY=sk-ant-...
```

---

## Para Andrew — próximos pasos del backend

### 1. Mergear `bugfix/jonathan-bugs` a `main`

```bash
git fetch origin
git checkout main
git merge origin/bugfix/jonathan-bugs
git push origin main
```

### 2. Test e2e con Meta sandbox real (cuando tengas credenciales)

Los scripts de conexión ya están en `scripts/`:

```bash
# Verificar conexión
PYTHONPATH=. .venv/bin/python3 scripts/test_meta_connection.py

# Crear campaña en sandbox
PYTHONPATH=. .venv/bin/python3 scripts/test_meta_campaign.py

# Si funciona → cambiar en .env:
META_USE_SANDBOX=true
```

### 3. Switch a Anthropic cuando lleguen créditos (1 línea)

```bash
# En .env:
LLM_MODEL=anthropic/claude-sonnet-4-5
ANTHROPIC_API_KEY=sk-ant-...
```

El resto del código no cambia. litellm maneja el switch.

### 4. Deploy en Railway (cuando el frontend esté listo)

```bash
# railway.json ya tiene la config básica
railway up
```

---

## Para el frontend (Jonathan/Julian)

El backend corre en `http://localhost:8000`.
Swagger UI interactivo: `http://localhost:8000/docs`

**Flujo del producto (3 paneles):**

```
1. Usuario escribe en el chat
2. Frontend hace: POST /campaign { user_prompt, brand_id: "demo-edu-latam" }
3. Parsear SSE stream:
   - event: tool_start  → mostrar card del tool con spinner
   - event: tool_result → actualizar card con rationale + checkmark
   - event: plan_ready  → llenar panel derecho con copy + targeting + presupuesto
4. Botón "Aprobar y lanzar" → POST /campaign/approve { plan: <plan_del_evento> }
5. Mostrar campaign_id y reporte
```

**Eventos SSE:**

```javascript
const es = new EventSource('/campaign') // no funciona con POST
// Usar fetch con stream:
const resp = await fetch('/campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_prompt, brand_id })
})
const reader = resp.body.getReader()
// parsear líneas: "event: tool_start\ndata: {...}\n\n"
```

---

## Estado de las ramas

| Rama | Estado | Acción |
|---|---|---|
| `main` | Fuente de verdad — backend completo | Base de trabajo |
| `bugfix/jonathan-bugs` | 5 bugs corregidos, 56 tests ✅ | **Mergear a main** |
| `sprint-2/e2e-hardening` | Test e2e + objetivos sprint 2 | Mergear a main |
| `integration/main` | Obsoleta | Borrar |
| `obj-a/campaign-agent` | Mergeado | Borrar |
| `obj-b/onboarding` | Mergeado | Borrar |
| `obj-c/meta-integration` | Mergeado | Borrar |
