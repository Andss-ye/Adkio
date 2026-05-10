# Objetivo A — Campaign Agent: estado y puntos de integración

## Qué está construido y funcionando

| Archivo | Qué hace |
|---|---|
| `backend/llm.py` | Wrapper de litellm. Una sola función `call_llm(messages, tools, stream)`. Modelo configurable con `LLM_MODEL` en `.env`. |
| `backend/tools/budget_validator.py` | Valida presupuesto contra mínimo diario de Meta y config de la marca. |
| `backend/tools/audience_analyzer.py` | Genera segmentación de audiencia vía LLM a partir del objetivo y `brand_config`. |
| `backend/tools/copy_generator.py` | Genera headline, body y CTA con LLM, respetando el tono de la marca. |
| `backend/tools/campaign_validator.py` | Checklist final de 8 criterios. Separa blockers (críticos) de warnings. |
| `backend/tools/campaign_launcher.py` | Lanza la campaña (mock calculado). Tiene hook para Meta real cuando Obj C entregue `meta_ads.py`. |
| `backend/tools/report_generator.py` | Genera reporte final en Markdown con resumen LLM. |
| `backend/agents/campaign_agent.py` | Orquesta los 4 tools vía litellm tool use. Emite SSE. Expone `approve_and_launch()`. |
| `backend/main.py` | FastAPI con 4 endpoints: `/health`, `/campaign`, `/campaign/approve`, `/campaign/{id}`. |
| `tests/` | 56 tests passing (tools + agent + endpoints), todos mockeados, sin red. |

---

## Lo que Objetivo B tiene que entregar para que A funcione con datos reales

Actualmente el agente usa un `brand_config` hardcodeado para `demo-edu-latam`. El único cambio que hay que hacer en Objetivo A para conectar Supabase es este:

### Archivo: `backend/agents/campaign_agent.py`, líneas 158–162

**Estado actual (mock):**
```python
def _get_brand_config(brand_id: str) -> dict:
    # TODO: replace with Supabase call when Objetivo B is merged
    # from backend.db.supabase_client import get_brand_config
    # return get_brand_config(brand_id)
    return _DEMO_BRAND_CONFIG
```

**Cambio a hacer cuando Obj B esté mergeado:**
```python
def _get_brand_config(brand_id: str) -> dict:
    from backend.db.supabase_client import get_brand_config
    return get_brand_config(brand_id)
```

Eso es todo. El dict `_DEMO_BRAND_CONFIG` puede eliminarse o dejarse como fallback de tests.

---

## Lo que Objetivo B debe entregar (contrato exacto)

### 1. Función `get_brand_config` en `backend/db/supabase_client.py`

```python
def get_brand_config(brand_id: str) -> dict:
    ...
```

Debe retornar un dict con **exactamente** estos campos (todos requeridos):

```python
{
    "id": str,
    "negocio_nombre": str,
    "negocio_industria": str,
    "propuesta_de_valor": str,
    "publico_roles": list[str],
    "publico_paises": list[str],        # nombres completos: "Colombia", "Mexico", etc.
    "publico_edad_min": int,
    "publico_edad_max": int,
    "publico_intereses": list[str],     # términos en inglés, como aparecen en Meta
    "presupuesto_min_campana_usd": float,
    "presupuesto_max_campana_usd": float,
    "tono_estilo": list[str],
    "tono_evitar": list[str],
    "ejemplos_copy_aprobado": list[str],
    "pixel_configurado": bool,
}
```

Si `brand_id` no existe, puede lanzar `KeyError` o `ValueError` — el agente lo captura y emite `event: error`.

### 2. Seed obligatorio en Supabase

El registro `demo-edu-latam` debe existir en la tabla `brand_configs` antes de que A funcione en producción. El seed está definido en `objectives.md` → Objetivo B.

### 3. Funciones opcionales (para Obj B interno, no afectan a A)

```python
def create_brand_config(data: dict) -> str   # retorna el id
def update_brand_config(id: str, data: dict) -> None
```

---

## Cómo probar los endpoints

### Arrancar el servidor

```bash
PYTHONPATH=. .venv/bin/python3 -m uvicorn backend.main:app --reload
# http://localhost:8000
# Docs interactivos: http://localhost:8000/docs
```

### GET /health

```bash
curl http://localhost:8000/health
```

```json
{"status": "ok", "model": "groq/llama-3.3-70b-versatile", "environment": "sandbox"}
```

---

### POST /campaign — stream completo del agente

```bash
curl -X POST http://localhost:8000/campaign \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"user_prompt": "Llenar evento Bogota junio, 200 dolares, exclusivo", "brand_id": "demo-edu-latam"}'
```

Verás los eventos llegar en tiempo real:

```
event: tool_start
data: {"tool": "budget_validator", "args": {"monto_usd": 200.0, "duracion_dias": 14}}

event: tool_result
data: {"tool": "budget_validator", "result": {"aprobado": true, ...}}

...

event: plan_ready
data: {"plan": {"copy": {...}, "targeting": {...}, "budget": {...}, "validation": {...}, "duracion_dias": 14}}
```

Guarda el objeto `plan` del evento `plan_ready` — lo necesitas para el siguiente paso.

---

### POST /campaign/approve — lanzar la campaña

```bash
curl -X POST http://localhost:8000/campaign/approve \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "copy": {"headline": "Lidera el cambio", "body": "...", "cta": "Reserva tu lugar", "rationale": "..."},
      "targeting": {"intereses": ["entrepreneurship"], "edad_min": 28, "edad_max": 52, "paises": ["Colombia"], "tamano_estimado": 600000, "exclusiones": [], "rationale": "..."},
      "budget": {"aprobado": true, "warnings": [], "presupuesto_diario_calculado": 14.29, "rationale": "..."},
      "validation": {"passed": true, "warnings": [], "blockers": [], "checklist_results": {}, "rationale": "..."},
      "duracion_dias": 14
    }
  }'
```

```json
{
  "campaign_id": "act_1545605356989188_1715308800",
  "status": "ACTIVE",
  "estimated_reach": "13K–26K personas",
  "preview_url": null,
  "report": "# Reporte de Campaña Adkio\n..."
}
```

---

### GET /campaign/{id}

```bash
curl http://localhost:8000/campaign/act_1545605356989188_1715308800
```

---

### Tests (sin Groq ni Meta)

```bash
PYTHONPATH=. .venv/bin/python3 -m pytest tests/ -v
# 56 tests, ~2 segundos
```
