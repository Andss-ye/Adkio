# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es Adkio

Agente de IA que planifica y lanza campañas en Meta, TikTok y Google Ads desde lenguaje natural,
con aprobación humana obligatoria antes de publicar. Prototipo avanzado / beta cerrada.

| Documento | Cuándo leerlo |
|---|---|
| `README.md` | Referencia práctica: quickstart, API completa, modelo de datos, env vars, deploy |
| `docs/CODESTYLE.md` | **Antes de escribir código.** Bases no negociables y dónde hay libertad |
| `docs/STATUS.md` | Qué funciona hoy, qué está bloqueado por terceros, deuda técnica, roadmap |
| `docs/SETUP_API_KEYS.md` | Credenciales de test de Meta / TikTok / Google |
| `docs/adr/` | Decisiones de arquitectura (deploy en Railway, runbook de DNS a Supabase) |

Si cambiás un contrato — firma de tool, tabla, evento SSE, env var — actualizá `README.md` y
`.env.example` en el mismo PR.

## Plugin del equipo: adkio-workflow

El repo trae un plugin de Claude Code en `plugins/adkio-workflow/` que aplica las reglas
solo. Documentación completa en `plugins/adkio-workflow/README.md`.

| Comando | Qué hace |
|---|---|
| `/adkio:checkpoint` | Verifica, audita contra las bases y commitea con el summary del equipo |
| `/adkio:verify` | Gauntlet: tests, build del frontend, higiene, atribución |
| `/adkio:summary` | Genera el summary sin commitear |
| `/adkio:pr` | Abre el PR con ese summary como body |
| `/adkio:bases` | Audita un diff contra las bases arquitectónicas |

Cuatro hooks corren solos: **bloquean** cualquier commit o PR que atribuya autoría a
Claude, avisan cuando una edición rompe una base del proyecto, inyectan el estado del repo
al arrancar, y recuerdan commitear al cerrar el turno.

**Commits y PRs sin atribución a Claude.** Ni `Co-Authored-By`, ni footer de herramienta,
ni `🤖`. El autor es la persona que pidió el trabajo. `includeCoAuthoredBy: false` está en
`.claude/settings.json` y el hook de PreToolUse bloquea el commit si aparece igual.

## Historias de usuario y cambios: OpenSpec

Las historias de usuario y las propuestas de cambio se manejan con
[OpenSpec](https://github.com/Fission-AI/OpenSpec) (`@fission-ai/openspec`, devDependency en la raíz).
Los comandos viven en `.claude/commands/opsx/`:

| Comando | Para qué |
|---|---|
| `/opsx:propose "<idea>"` | Crea el change y genera proposal + specs + design + tasks |
| `/opsx:explore` | Explora el espacio del problema antes de proponer |
| `/opsx:apply` | Implementa un change ya aprobado |
| `/opsx:update` | Ajusta los artefactos de un change en curso |
| `/opsx:sync` | Sincroniza los specs principales |
| `/opsx:archive` | Archiva un change terminado y actualiza los specs |

```bash
npm run spec:list         # changes activos
npm run spec:dashboard    # dashboard interactivo de specs y changes
npm run spec:validate     # valida artefactos
```

**`propose` y `apply` están separados a propósito**: proponer genera solo artefactos de
planificación y se detiene — no toca código del proyecto, incluso si el pedido dice "construí esto".
Implementar requiere un pedido nuevo y explícito.

`openspec/config.yaml` lleva el contexto de Adkio y las reglas por artefacto (historias en formato
"Como… quiero… para…" con criterios Dado/Cuando/Entonces, secciones de fuera de alcance, en qué capa
cae cada pieza). Se le inyecta a la IA en cada generación: si cambian las bases del proyecto,
actualizá ese archivo también.

## Comandos

```bash
# Backend — SIEMPRE desde la raíz del repo: los imports son absolutos (backend.*)
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000     # API en :8000, OpenAPI en /docs
python backend/db/seed.py                          # carga la marca demo-edu-latam

# Tests — pytest con asyncio_mode=auto: las corrutinas no llevan decorador.
# Requiere backend/requirements.txt instalado (tests/test_endpoints.py importa backend.main).
pip install pytest pytest-asyncio
pytest                                             # ~120 tests, sin red ni credenciales
pytest tests/test_tools.py                         # un archivo
pytest tests/test_tools.py::TestBudgetValidator::test_aprobado_con_presupuesto_normal  # un test
pytest -k "resolver" -v                            # por patrón

# Frontend
cd frontend && npm install
npm run dev                                        # :5173
npm run build                                      # tsc -b + vite build — el gate de tipos
```

No hay linter ni formateador en CI. El único gate automático es que `tsc -b` pase en el frontend.
`scripts/*.py` son smoke tests **manuales** contra APIs reales; pytest no los corre y `backend/` no
debe importarlos.

## Arquitectura

### El flujo central: HITL en dos endpoints

El human-in-the-loop es estructural, no una opción de configuración:

```
POST /campaign  (SSE)   budget_validator → audience_analyzer → platform_recommender
                        → copy_generator → campaign_validator ──▶ event: plan_ready → FIN
POST /campaign/approve   campaign_launcher → report_generator   (crea en PAUSED)
```

El generador SSE **termina** en `plan_ready`; las tools de lanzamiento no se le exponen al LLM
durante la planificación. Eventos: `tool_start`, `tool_result`, `plan_ready`, `error`.

### Las tres capas del backend

1. **Tools** (`backend/tools/`) — funciones módulo-level con el nombre del archivo, I/O en `dict`
   porque el LLM las serializa a JSON.
2. **Resolver de credenciales** (`backend/services/credential_resolver.py`) — el **único** lugar del
   sistema que sabe de dónde salen las credenciales. `EnvCredentialResolver` lee `.env`;
   `DBCredentialResolver(account_id)` lee `platform_connections` y descifra con Fernet. Se inyecta
   por request con un `ContextVar` desde `middleware/tenant.py`.
3. **Adapters** (`backend/integrations/`) — `PlatformAdapter` es un `Protocol` runtime-checkable;
   `adapter_registry.py` es el único punto de despacho. Reciben credenciales por parámetro.

**Invariante: tools y adapters nunca leen env ni DB.** Es lo que mantiene el core stateless y
tenant-agnostic. Romperlo rompe el multitenant sin que ningún test falle.

**Meta habla por el SDK (`facebook-business`), no por el MCP oficial.** Los Ads AI Connectors
(`mcp.facebook.com/ads` y `@meta/ads-cli`) evitan el App Review, pero meten un LLM o un binario
Node en el camino del gasto. Crear, aprobar, activar y leer métricas se quedan en el SDK; listar
assets va por Graph directo con `httpx`, como ya hace `connections.py`.

### Contratos de las tools

```python
budget_validator(monto_usd: float, brand_config: dict, duracion_dias: int) -> dict
audience_analyzer(objetivo: str, brand_config: dict) -> dict
platform_recommender(objetivo: str, audiencia: dict, brand_config: dict,
                     presupuesto_usd: float = 0.0) -> dict
copy_generator(producto: str, audiencia: dict, canal: str, tono: dict,
               nivel_consciencia: str) -> dict
claims_validator(copy: dict, industria: str = "") -> dict
campaign_validator(campaign_params: dict) -> dict
campaign_launcher(canal: str, copy: dict, targeting: dict, budget: float,
                  duracion_dias: int, platform: str | None = None) -> dict
campaign_remover(platform: str, campaign_id: str, confirm: bool = False) -> dict
report_generator(campaign_result: dict, all_tool_outputs: dict) -> str  # markdown
```

`claims_validator` **no está** en `_TOOL_DEFINITIONS`: lo corre el agente solo, antes de
`campaign_validator`, con sus propios eventos SSE. Un guardrail que el LLM puede saltarse no sirve.

El schema que ve el LLM (`_TOOL_DEFINITIONS` en `agents/campaign_agent.py`) expone **menos**
parámetros que la firma de Python: el agente inyecta el resto (`brand_config`, `audiencia`,
`presupuesto_usd`). Si agregás un parámetro, decidí explícitamente de qué lado va.

Tres reglas al escribir o modificar una tool:

- **Devolvé `rationale`** (1-3 oraciones en español). Es lo que el panel de razonamiento muestra en
  vivo. Sin `rationale` la UI queda vacía.
- **Nunca rompas el stream.** Si el LLM devuelve basura o el proveedor falla, caé a un default
  razonable y explicá la degradación en el `rationale`. El agente tiene que llegar a `plan_ready`.
- **Parseo defensivo del JSON del LLM** (regex + `json.loads` en `try/except`): asumí que va a venir
  envuelto en texto o en un bloque ` ```json `.

### Tenancy

`ADKIO_REQUIRE_AUTH` decide el comportamiento del middleware:

- `false` (**default**) — permisivo: sin JWT la request pasa con `account_id = None` y se cae a las
  credenciales del `.env`. Es el modo del demo single-tenant.
- `true` — estricto: toda ruta no pública exige JWT válido; credenciales desde
  `platform_connections`.

Auth propia (tabla `accounts` + bcrypt + JWT HS256), **no Supabase Auth**. El aislamiento real de
tenancy está en el `WHERE` del resolver, no en RLS: el backend usa la service role key y bypassa RLS.

### LLM

`backend/llm.py` es el **único** punto de configuración. Cambiar de modelo = cambiar `LLM_MODEL`,
sin tocar código. Caps de tokens duros por llamada. No agregues llamadas al proveedor por fuera de
`call_llm`.

### Frontend

SPA sin router: `App.tsx` hace un `switch` sobre `window.location.pathname`. Todas las llamadas a la
API pasan por `lib/api.ts` (`apiFetch` / `apiUrl`), que agrega `X-API-Key` y el `Bearer` de
`localStorage` — nunca uses `fetch` directo a la API. El SSE se consume en
`hooks/useCampaignStream.ts`. Componentes agrupados por superficie (`landing/`, `dashboard/`,
`app/`, `shell/`, `settings/`, `ui/`).

## Gotchas que cuestan tiempo

- **La tabla `campaigns` no está en `schema.sql`** — se creó a mano en Supabase; solo sus columnas
  posteriores viven en migraciones. Una DB nueva requiere crearla manualmente. Las claves que no
  estén en `_CAMPAIGN_FIELDS` (`db/supabase_client.py`) se descartan **en silencio** al insertar.
- **Migraciones**: aplicar `backend/db/migrations/*.sql` en orden numérico, siempre idempotentes.
  `schema.sql` es el estado consolidado; si agregás una migración, reflejala ahí.
- **Estado en memoria del proceso**: `_campaigns` y `_conversations` en `main.py` más los contadores
  del rate limiter. Se pierden en cada reinicio y no funcionan con >1 réplica.
- **`brand_id` del body se ignora** si la request está autenticada y la cuenta tiene marca propia
  (`_resolve_brand_id`).
- **`platform_hint` hace override determinístico** de `platform_recommender` dentro de
  `run_campaign_agent`. Si extendés el agente, preservá ese hook.
- **El SDK de Meta no es thread-safe** — `FacebookAdsApi.init()` es global. Con concurrencia real
  hay que serializar con un lock o pasar a HTTP directo.
- **TikTok no permite hard-delete**: solo soft-disable. `DeleteResult.soft_delete=True` y la UI debe
  decir "Eliminar (desactiva en TikTok)".
- **El `developer_token` de Google Ads es de Adkio** (`ADKIO_GOOGLE_ADS_DEVELOPER_TOKEN`), no del
  usuario; el usuario aporta refresh token + customer_id.
- **Sin credenciales conectadas, `campaign_launcher` cae a mock** y marca la fila con
  `is_mock=true`. La UI tiene que seguir siendo honesta al respecto.
- **`/health` reporta el modelo default de Groq** mientras `llm.py` cae a Anthropic. El valor real
  es el de `llm.py`.
- Los endpoints que gastan tokens del LLM exigen `X-API-Key`; si `ADKIO_API_KEY` está vacía quedan
  abiertos y se loguea un warning. El frontend necesita el mismo valor en `VITE_API_KEY`.

## Convenciones mínimas

Detalle y razones en `docs/CODESTYLE.md`. Lo indispensable:

- **Idioma**: identificadores en inglés; campos de dominio que ya existen en DB y tools en español
  (`negocio_nombre`, `monto_usd`, `rationale`); docstrings, comentarios, errores al usuario y
  commits en español; logs en inglés con `%s` por parámetro.
- **Python 3.11**, imports absolutos `backend.*`, `Optional[X]`, dataclasses `frozen=True` para
  contratos, `Protocol` para interfaces, Pydantic v2 validando en el borde con mensajes accionables.
- **React**: `export default function`, props con `type Props = {...}`, alias `@/`, Tailwind para
  layout y estilos inline para colores derivados en runtime.
- **Commits**: conventional commits con scope y descripción en español
  (`feat(dashboard): rediseño con hero y tabla responsive`). Ramas `feat/`, `fix/`, `docs/`,
  `chore/`; PR a `main`.
- **Tests sin red ni credenciales**: adapters con dobles, resolver con un `dict` de entorno
  inyectado (`EnvCredentialResolver(environ={...})`), nunca parcheando `os.environ` global.

## Restricciones de producto

Toda campaña se crea en **PAUSED** — es el guardrail de gasto y no se negocia. La app no debe
presentar como real algo que fue mock. No agregues librerías de routing ni de UI al frontend sin
discutirlo: el stack es deliberadamente chico.
