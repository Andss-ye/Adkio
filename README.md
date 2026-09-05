# Adkio

Agente de IA que planifica y lanza campañas publicitarias en **Meta, TikTok y Google Ads** desde
lenguaje natural, con aprobación humana antes de cada lanzamiento.

El usuario escribe lo que quiere ("llenar el evento de Bogotá del 15 de junio, $200, tono
exclusivo"). Adkio conoce la marca, valida el presupuesto, arma la audiencia, elige plataforma,
redacta el copy, corre un checklist de calidad y muestra el razonamiento paso a paso. Nada se
publica sin un click de aprobación, y todo se crea en estado **PAUSED** en la plataforma destino.

> **Estado: prototipo avanzado / beta cerrada.** El flujo end-to-end funciona contra APIs reales
> con credenciales propias, pero faltan piezas para producción (App Review de los providers,
> verificación de email, variantes de copy, tracking de pixel). Ver [`docs/STATUS.md`](docs/STATUS.md).

Este README es la referencia práctica del proyecto: cómo correrlo, cómo está armado, qué expone la
API y qué hay en la base de datos.

| Otros documentos | Para qué |
|---|---|
| [`docs/STATUS.md`](docs/STATUS.md) | Qué funciona hoy, qué está bloqueado, deuda técnica, roadmap |
| [`docs/CODESTYLE.md`](docs/CODESTYLE.md) | Cómo se escribe código acá: bases no negociables y dónde hay libertad |
| [`docs/SETUP_API_KEYS.md`](docs/SETUP_API_KEYS.md) | Conseguir credenciales de test de Meta, TikTok y Google Ads |
| [`docs/COMPETITIVE_BRIEF.md`](docs/COMPETITIVE_BRIEF.md) | Panorama competitivo y posicionamiento |
| [`docs/adr/`](docs/adr/) | Decisiones de arquitectura registradas |
| [`CLAUDE.md`](CLAUDE.md) | Contexto operativo para agentes de código |
| `openspec/` | Historias de usuario y propuestas de cambio — ver [Flujo de trabajo](#flujo-de-trabajo) |
| [`plugins/adkio-workflow/`](plugins/adkio-workflow/README.md) | Plugin de Claude Code del equipo: guardrails, comandos de checkpoint y PR |

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11 + FastAPI, SSE para el streaming del agente |
| LLM | `litellm` como wrapper — modelo configurable con `LLM_MODEL`, sin tocar código |
| Frontend | Vite + React 18 + TypeScript + Tailwind (SPA, sin router externo) |
| Base de datos | Supabase (Postgres vía PostgREST) |
| Plataformas de ads | `facebook-business` (Meta), REST directo (TikTok), `google-ads` (Google) |
| Auth | Propia: tabla `accounts` + bcrypt + JWT HS256 (**no** Supabase Auth) |
| Deploy | Railway (backend + frontend), Supabase gestionado aparte |

---

## Quickstart

Requisitos: **Python 3.11+**, Node 20+, un proyecto Supabase y una API key de LLM.

```bash
git clone <repo> && cd Adkio
cp .env.example .env      # completar SUPABASE_URL, la key del LLM, JWT_SECRET, etc.
```

### Base de datos

Pegar `backend/db/schema.sql` en el SQL Editor de Supabase y después las migraciones de
`backend/db/migrations/` **en orden numérico**. Todas son idempotentes.

⚠️ **La tabla `campaigns` no está en `schema.sql`** — se creó a mano y solo sus columnas
posteriores viven en migraciones. En una DB nueva hay que crearla manualmente con las columnas
listadas en [Modelo de datos](#modelo-de-datos).

### Backend

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
python backend/db/seed.py                          # opcional: carga la marca demo-edu-latam
uvicorn backend.main:app --reload --port 8000      # correr SIEMPRE desde la raíz del repo
```

Los imports son absolutos (`backend.*`), así que uvicorn tiene que arrancar desde la raíz.
API en `http://localhost:8000` · OpenAPI en `/docs` · health en `/health`.

### Frontend

```bash
cd frontend && npm install
npm run dev          # http://localhost:5173
npm run build        # tsc -b + vite build — el gate de tipos
```

`VITE_BACKEND_URL` (en `frontend/.env`, ver `frontend/.env.example`) apunta al backend. Si el
backend tiene `ADKIO_API_KEY` configurada, el frontend necesita el mismo valor en `VITE_API_KEY`
para que `apiFetch` lo mande en el header `X-API-Key`.

### Docker

```bash
docker compose up --build       # backend :8000, frontend :3000
```

### Tests

```bash
pip install pytest pytest-asyncio        # sobre el venv que ya tiene backend/requirements.txt
pytest                                   # ~120 tests, sin red ni credenciales reales
pytest tests/test_tools.py               # un archivo
pytest -k "resolver" -v                  # por patrón
```

`pytest.ini` fija `asyncio_mode = auto`: las corrutinas se testean sin decorador.
`scripts/*.py` son smoke tests **manuales** contra APIs reales — pytest no los corre.

---

## Flujo de trabajo

Las historias de usuario y las propuestas de cambio se manejan con
[OpenSpec](https://github.com/Fission-AI/OpenSpec), instalado como devDependency en la raíz.
Un cambio pasa por cuatro artefactos: `proposal.md` (el problema y las historias) →
`specs/<capability>/spec.md` (comportamiento esperado) → `design.md` (cómo) → `tasks.md` (pasos).

```bash
npm install                # instala el CLI (raíz; el frontend tiene su propio package.json)
npm run spec:list          # changes activos
npm run spec:dashboard     # dashboard interactivo de specs y changes
npm run spec:validate      # valida artefactos
```

Desde Claude Code: `/opsx:propose "<idea>"` genera los cuatro artefactos, `/opsx:apply` implementa un
change aprobado, `/opsx:archive` lo cierra. Proponer e implementar están separados a propósito:
proponer no toca código.

`openspec/config.yaml` lleva el contexto del proyecto y las reglas por artefacto (historias en
formato "Como… quiero… para…" con criterios Dado/Cuando/Entonces, y las bases que ninguna propuesta
puede romper). Si cambian las bases, actualizá ese archivo junto con
[`docs/CODESTYLE.md`](docs/CODESTYLE.md).

> OpenSpec envía estadísticas de uso anónimas por default. Para desactivarlo:
> `OPENSPEC_TELEMETRY=0` o `npx openspec config set telemetry.enabled false` (config global de la
> máquina, no del repo).

### Guardrails y checkpoints

El repo trae un plugin de Claude Code ([`plugins/adkio-workflow/`](plugins/adkio-workflow/README.md))
que aplica las reglas del proyecto de forma automática y cierra cada bloque de trabajo con
verificación. Instalación desde un clon:

```bash
claude plugin marketplace add ./
claude plugin install adkio-workflow@adkio
```

Da cinco comandos (`/adkio:checkpoint`, `/adkio:verify`, `/adkio:summary`, `/adkio:pr`,
`/adkio:bases`) y cuatro hooks que corren solos: bloquean commits con atribución a Claude,
avisan cuando una edición rompe una base arquitectónica, e inyectan el estado del repo al
arrancar la sesión.

El gauntlet de verificación se puede correr suelto, sin Claude Code:

```bash
bash plugins/adkio-workflow/scripts/verify.sh
```

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────────────┐
│  FRONTEND — Vite + React SPA                                         │
│  Landing · Auth · Dashboard (+ drawer conexiones) · Workspace /app   │
└───────────────┬──────────────────────────────────────────────────────┘
                │  fetch + SSE  (lib/api.ts: X-API-Key + Bearer JWT)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  BACKEND — FastAPI                                                   │
│                                                                      │
│  CORS → security_headers → tenant_middleware (JWT → account_id)      │
│                                                                      │
│  campaign_agent — loop de tool use vía litellm, emite SSE            │
│                                                                      │
│  credential_resolver — ContextVar por request                        │
│    EnvCredentialResolver (.env)  |  DBCredentialResolver (Fernet)    │
│                                                                      │
│  adapter_registry → MetaAdapter · TikTokAdapter · GoogleAdsAdapter   │
└──────┬─────────────────────────────────┬─────────────────────────────┘
       ▼                                 ▼
  Supabase (Postgres)          Meta · TikTok · Google Ads
```

Tres capas con contratos explícitos, y un invariante que las sostiene:

1. **Tools** (`backend/tools/`) — funciones planas, I/O en `dict` porque el LLM las serializa a
   JSON. Cada una devuelve `rationale`.
2. **Resolver de credenciales** (`backend/services/credential_resolver.py`) — el **único** lugar
   del sistema que sabe de dónde salen las credenciales.
3. **Adapters** (`backend/integrations/`) — `PlatformAdapter` es un `Protocol` runtime-checkable;
   `adapter_registry.py` es el único punto de despacho. Reciben credenciales por parámetro.

> **Invariante: tools y adapters nunca leen env ni DB.** Es lo que los mantiene stateless y
> tenant-agnostic. Romperlo rompe el multitenant sin que ningún test falle.

---

## El agente

El human-in-the-loop es **estructural**, no una opción de configuración: el generador SSE termina
en `plan_ready` y el lanzamiento vive en otro endpoint. Las tools de lanzamiento no se le exponen
al LLM durante la planificación.

```
POST /campaign  (SSE)
   ├─ budget_validator        ¿el presupuesto es viable para la duración?
   ├─ audience_analyzer       intereses, edades, países, exclusiones
   ├─ platform_recommender    Meta / TikTok / Google Ads (respeta platform_hint)
   ├─ copy_generator          headline + body + CTA en el tono de la marca
   └─ campaign_validator      checklist de calidad → warnings / blockers
   └─▶ event: plan_ready      el plan viaja al frontend y el agente se detiene

POST /campaign/approve
   ├─ campaign_launcher       crea la campaña en PAUSED vía el adapter de la plataforma
   └─ report_generator        reporte final en markdown
```

Las tools viven en `backend/tools/`, una por archivo, con el nombre del archivo:

| Tool | Devuelve |
|---|---|
| `budget_validator` | `aprobado`, `warnings`, `presupuesto_diario_calculado`, `rationale` |
| `audience_analyzer` | `intereses`, `edad_min`, `edad_max`, `paises`, `tamano_estimado`, `exclusiones`, `rationale` |
| `platform_recommender` | `platform` (`meta`\|`tiktok`\|`google_ads`), `rationale` |
| `copy_generator` | `headline`, `body`, `cta`, `rationale` |
| `campaign_validator` | `passed`, `warnings`, `blockers`, `checklist_results`, `rationale` |
| `campaign_launcher` | `campaign_id`, `status`, `platform`, `is_mock`, `estimated_reach`, `preview_url`, `kpis` (leads y CPL estimados, budget diario), `next_steps`, `rationale` |
| `campaign_remover` | resultado de baja: hard-delete o soft-disable según la plataforma |
| `report_generator` | markdown con el reporte final |

**`rationale` no es opcional**: es lo que el panel de razonamiento muestra en vivo mientras el
agente trabaja, y es el momento fuerte del producto. Sin credenciales conectadas,
`campaign_launcher` cae a mock y marca la campaña con `is_mock=true` — la UI lo dice explícitamente.

### Eventos SSE de `POST /campaign`

`text/event-stream`, formato `event: <nombre>\ndata: <json>\n\n`.

| Evento | Payload | Cuándo |
|---|---|---|
| `tool_start` | `{tool, args}` | Antes de ejecutar cada tool |
| `tool_result` | `{tool, result}` | Output completo de la tool, incluido `rationale` |
| `plan_ready` | `{plan}` | Al terminar `campaign_validator`. **Fin del stream** |
| `error` | `{message}` | Falla del LLM/tool, o pedido no accionable (el mensaje es para el usuario) |

El plan que viaja en `plan_ready` es el mismo que `POST /campaign/approve` espera de vuelta en
`{"plan": ...}`: `brand`, `copy`, `targeting`, `budget`, `platform_recommendation`, `validation`,
`duracion_dias`. El launcher calcula `budget_usd = presupuesto_diario_calculado × duracion_dias`.

---

## API HTTP

Convenciones transversales:

- Los endpoints que gastan tokens del LLM exigen el header `X-API-Key` (`ADKIO_API_KEY`). Si la var
  está vacía quedan abiertos y se loguea un warning.
- Rate limit por IP con slowapi, declarado endpoint por endpoint.
- Auth de usuario con `Authorization: Bearer <access_token>`.
- Errores esperados: `HTTPException` con `detail` en español. Inesperados: `500 {"error":
  "Internal server error"}`, sin stack trace.

### Campañas

| Método | Ruta | Límite | API key | Descripción |
|---|---|---|---|---|
| `POST` | `/campaign` | 10/min | ✅ | Corre el agente y streamea SSE hasta `plan_ready` |
| `POST` | `/campaign/approve` | 10/min | ✅ | Lanza la campaña del plan aprobado y devuelve el reporte |
| `POST` | `/campaign/refine` | 15/min | ✅ | Ajusta un plan según feedback, con 1 sola llamada al LLM |
| `GET` | `/campaign/{id}` | — | — | Estado de una campaña **en memoria del proceso** |
| `GET` | `/campaigns` | 30/min | — | Historial desde Supabase (por `account_id` si hay JWT, si no por `brand_id`) |
| `GET` | `/campaigns/{id}/metrics` | 30/min | — | Métricas diarias de la campaña. **JWT obligatorio** (401 sin auth). Query opcionales: `from`, `to` (ISO date), `limit` (máx. 90) |
| `PATCH` | `/campaigns/{id}` | 20/min | ✅ | Cambia estado: `ACTIVE` \| `PAUSED` |
| `DELETE` | `/campaigns/{id}` | 20/min | ✅ | Borrado **lógico** (`deleted_at`) |

Request de `POST /campaign`:

```json
{
  "user_prompt": "Llenar el evento de Bogotá del 15 de junio, $200, tono exclusivo",
  "brand_id": "demo-edu-latam",
  "platform_hint": "meta"
}
```

- `user_prompt`: 10–2000 chars, mínimo 3 palabras de ≥2 caracteres. Se limpian caracteres de
  control y se corre el guard de prompt injection (400 si matchea).
- `brand_id`: `^[a-zA-Z0-9_\-]{1,64}$`. **Si la request está autenticada y la cuenta tiene marca
  propia, el backend ignora este valor** y usa la marca de la cuenta.
- `platform_hint`: `meta` \| `tiktok` \| `google_ads` \| `null`. Cuando viene, hace override
  determinístico de `platform_recommender`.

### Auth

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `POST` | `/auth/signup` | público | `{access_token, refresh_token, account}` + provisiona la marca de la cuenta |
| `POST` | `/auth/login` | público | `{access_token, refresh_token, account}` |
| `POST` | `/auth/refresh` | público | `{access_token, refresh_token, account}` |
| `GET` | `/auth/me` | Bearer | `{id, email, plan, created_at, last_login_at}` |

### Conexiones de plataforma

`platform` ∈ `meta` \| `tiktok` \| `google_ads`.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/connect/status` | Bearer | Estado de las 3 plataformas para la cuenta |
| `GET` | `/connect/{platform}` | Bearer | Devuelve `authorize_url` para iniciar OAuth |
| `GET` | `/connect/{platform}/callback` | **público** | Callback del provider → redirige al frontend |
| `POST` | `/connect/{platform}/manual` | Bearer | Alta pegando access token — **el camino que funciona hoy** |
| `GET` | `/connect/{platform}/assets` | Bearer | Ad accounts, páginas e IG que alcanza la conexión (`?asset_type=` filtra) |
| `POST` | `/connect/{platform}/assets/select` | Bearer | Elige con qué asset se publica — `{asset_type, external_id}` |
| `POST` | `/connect/google_ads/customer` | Bearer | Setea el `customer_id` de Google Ads |
| `DELETE` | `/connect/{platform}` | Bearer | Desconecta la plataforma |

Los callbacks son públicos porque el provider redirige sin nuestro JWT: el middleware exime
cualquier ruta que termine en `/callback`.

### Marca, onboarding y otros

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/onboarding/start` | — | Abre conversación, devuelve `conversation_id` |
| `POST` | `/onboarding/message` | ✅ | Turno conversacional → `question` \| `config` + `confidence_score` |
| `GET` | `/brand-config/me` | ✅ + Bearer | Marca de la cuenta autenticada |
| `PATCH` | `/brand-config/me` | ✅ + Bearer | Edita campos de la marca (edades validadas 13–65) |
| `GET` | `/brand-config/{brand_id}` | — | Marca por slug o UUID |
| `GET` | `/health` | — | `{status, model, environment, campaign_agent}` |
| `POST` | `/whitelist/tally-webhook` | — | Webhook de Tally → upsert en `whitelist` por email |

### Estado en memoria del proceso

No hay Redis ni sesión compartida. Estos tres stores viven en el proceso, **se pierden en cada
reinicio y no funcionan con más de una réplica**: `_campaigns` (lo que sirve `GET /campaign/{id}`),
`_conversations` (historial de onboarding) y los contadores del rate limiter.

---

## Tenancy y credenciales

```
tenant_middleware
  ├─ ruta pública (/health, /auth/*, /docs, */callback) → pasa sin decodificar JWT
  ├─ JWT válido   → request.state.account_id; set_current_resolver(DBCredentialResolver)
  ├─ sin JWT + ADKIO_REQUIRE_AUTH=false → account_id = None → EnvCredentialResolver
  └─ sin JWT + ADKIO_REQUIRE_AUTH=true  → 401
```

Dos modos según `ADKIO_REQUIRE_AUTH`:

- **Permisivo (`false`, default)** — sin JWT la request pasa y las credenciales salen del `.env`.
  Es el modo del demo single-tenant.
- **Estricto (`true`)** — toda ruta no pública exige JWT válido y las credenciales salen de
  `platform_connections`, descifradas con Fernet. Es el modo de producción.

`resolve(platform)` devuelve `MetaCreds | TikTokCreds | GoogleAdsCreds | None`. `None` significa
"no configurada" y el caller decide el fallback (típicamente mock); solo lanza `ValueError` si el
nombre de plataforma es inválido.

**El aislamiento real de tenancy está en el `WHERE` del resolver, no en RLS**: el backend usa la
service role key, que bypassa RLS. Las políticas RLS del schema son defensa en profundidad para
clientes que usen la anon key.

---

## Plataformas: qué cambia entre adapters

| Plataforma | Create | Delete | Lo que hay que saber |
|---|---|---|---|
| Meta | ✅ | ✅ hard-delete | **El SDK no es thread-safe** (`FacebookAdsApi.init()` es global). Sin `META_PAGE_ID` en `extra_jsonb` solo se crea el shell de Campaign, sin Ad Set ni Ad. Los intereses se pasan como strings, no `interest_id` |
| TikTok | ✅ | ⚠️ **soft-delete** | No existe hard-delete: la campaña queda DISABLED. `DeleteResult.soft_delete=True` y la UI debe decir "Eliminar (desactiva en TikTok)" |
| Google Ads | ✅ | ✅ `REMOVE` | El `developer_token` es **de Adkio** (`ADKIO_GOOGLE_ADS_DEVELOPER_TOKEN`), no del usuario; el usuario aporta refresh token + customer_id |

Agregar una plataforma = adapter que cumpla el `Protocol` + entrada en `_ADAPTERS` + dataclass de
credenciales + rama en el resolver. `tests/integrations/test_contract.py` valida el Protocol sin
que haya que tocarlo.

---

## Modelo de datos

`backend/db/schema.sql` es el estado consolidado para una DB nueva.
`backend/db/migrations/00N_*.sql` son los cambios incrementales, idempotentes, a aplicar en orden.

| Tabla | Qué guarda |
|---|---|
| `brand_configs` | Una fila por marca. `slug` es el lookup amigable (`demo-edu-latam`); `get_brand_config` acepta slug o UUID. Campos de negocio en español, arrays `TEXT[]` para roles/países/intereses/tono, `metadata` JSONB para lo inferido en onboarding |
| `accounts` | `email` UNIQUE, `password_hash` bcrypt, `plan` (`starter`\|`growth`\|`scale`, **cosmético**: no hay billing), `brand_id` → `brand_configs` |
| `platform_connections` | Tokens cifrados con Fernet. `UNIQUE (adkio_account_id, platform)` → una cuenta conecta una credencial por plataforma; los assets que esa credencial alcanza viven en `platform_assets` |
| `platform_assets` | Los ad accounts, páginas y cuentas de Instagram que alcanza una conexión, una fila cada uno. `is_selected` marca el que usa el launcher, con un índice único parcial que impide dos elegidos del mismo `asset_type` |
| `campaigns` | Historial de campañas lanzadas. **No está en `schema.sql`** |
| `campaign_metrics` | Métricas diarias por `(account_id, platform, campaign_id, metric_date)`. `account_id` obligatorio. `clicks` puede quedar en 0 hasta la ingesta (ADK-16). Sin FK a `campaigns` |
| `whitelist` | Altas del webhook de Tally, upsert por `email` |

Columnas de `campaigns` que el backend escribe (`_CAMPAIGN_FIELDS` en `db/supabase_client.py`):
`account_id`, `brand_id`, `campaign_id`, `status`, `estimated_reach`, `preview_url`, `user_prompt`,
`copy_headline`, `copy_body`, `copy_cta`, `budget_usd`, `duration_days`, `paises`,
`expected_leads`, `cpl_usd`, `cpl_min_usd`, `cpl_max_usd`, `platform`, `is_mock`; más `deleted_at`
y `created_at`. **Cualquier clave fuera de ese set se descarta en silencio al insertar.**

Columnas de `campaign_metrics` que el backend escribe (`_METRICS_FIELDS`): `account_id`,
`brand_id`, `platform`, `campaign_id`, `metric_date`, `impressions`, `reach`, `clicks`,
`spend_usd`. Upsert por el UNIQUE diario; listado siempre filtra por `account_id`. No hay
escritura HTTP pública — solo helpers Python. `clicks` se llena con la ingesta (ADK-16).

| Migración | Qué agrega |
|---|---|
| `001_multitenant.sql` | `accounts` + `platform_connections` + RLS |
| `002_campaigns_account_id.sql` | `campaigns.account_id` → aislamiento multitenant |
| `003_campaign_metadata.sql` | `platform`, `cpl_min_usd`, `cpl_max_usd`, `is_mock` |
| `004_campaign_soft_delete.sql` | `campaigns.deleted_at` |
| `005_account_brand.sql` | `accounts.brand_id` → una marca por cuenta |
| `006_campaign_metrics.sql` | Tabla `campaign_metrics` (grano diario, UNIQUE por tenant+plataforma+campaña+fecha) |
| `007_platform_assets.sql` | `platform_assets` + backfill desde `extra_jsonb` de las conexiones existentes |

Cambiar el asset elegido se hace en **una sola sentencia** (`SET is_selected = (external_id = '<nuevo>')`) o dentro de una transacción que primero apague el anterior: el índice único parcial rechaza dos elegidos del mismo tipo.

---

## LLM

`backend/llm.py` es el **único** punto de configuración. Cambiar de modelo = cambiar `LLM_MODEL`,
sin tocar código. Los caps de tokens son duros: una sola llamada no puede vaciar la cuota. Cada
llamada loguea modelo, tokens y latencia.

| `LLM_MODEL` | Notas |
|---|---|
| `anthropic/claude-sonnet-4-5` | Default en código. Mejor tool use |
| `gemini/gemini-2.5-flash` | Alternativa económica, la que sugiere `.env.example` |
| `groq/llama-3.3-70b-versatile` | Gratis pero con rate limits; tool use menos predecible |

⚠️ `GET /health` reporta el default histórico de Groq cuando `LLM_MODEL` no está seteada, mientras
`llm.py` cae a Anthropic. El valor real es el de `llm.py`.

---

## Variables de entorno

Plantillas: `.env.example` (local) y `.env.production.example` (Railway). En producción viven en
Railway Variables, nunca en la imagen.

### Críticas

| Var | Para qué | Cómo se obtiene |
|---|---|---|
| `SUPABASE_URL` | DB. **Debe resolver por DNS** — si no, signup/login dan 500 (`Errno -2`) | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso del backend (bypassa RLS) | ídem |
| `SUPABASE_ANON_KEY` | Cliente restringido | ídem |
| `LLM_MODEL` + key del proveedor | El cerebro del agente | Según proveedor |
| `JWT_SECRET` | Firma de JWTs | `openssl rand -hex 32` |
| `PLATFORM_TOKENS_ENC_KEY` | Cifrado Fernet de tokens | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

`backend/main.py` valida al arrancar que existan `SUPABASE_URL` y `ANTHROPIC_API_KEY`: con
`ENVIRONMENT=production` hace `sys.exit(1)`; en dev solo advierte.

### Comportamiento y seguridad

| Var | Default | Efecto |
|---|---|---|
| `ADKIO_REQUIRE_AUTH` | `false` | `true` = JWT obligatorio en rutas no públicas |
| `ADKIO_API_KEY` | vacío | Header `X-API-Key` en endpoints de LLM. Vacío = abiertos |
| `ALLOWED_ORIGINS` | `localhost:5173,localhost:4173` | Orígenes CORS, coma-separados |
| `ENVIRONMENT` | `sandbox` | `production` activa el exit-on-missing-vars |
| `PORT` | `8000` | Puerto de uvicorn |
| `MAX_TOKENS_CAMPAIGN` / `MAX_TOKENS_ONBOARDING` | `2000` / `500` | Caps de tokens por llamada |

### Credenciales de plataforma (single-tenant, leídas por `EnvCredentialResolver`)

- **Meta**: `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` (`act_…`),
  `META_PAGE_ID`, `META_USE_SANDBOX`, `META_GRAPH_API_VERSION` (default `v25.0`; cada versión de
  Graph vence ~2 años después de su release)
- **TikTok**: `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID`, `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`,
  `TIKTOK_USE_SANDBOX`
- **Google Ads**: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`,
  `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`,
  `GOOGLE_ADS_LOGIN_CUSTOMER_ID`

### OAuth (multitenant)

`META_OAUTH_REDIRECT_URI`, `TIKTOK_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`,
`ADKIO_GOOGLE_ADS_DEVELOPER_TOKEN`, `FRONTEND_AFTER_OAUTH_URL`.

### Frontend (build-time, Vite)

`VITE_BACKEND_URL` (URL pública del backend, sin slash final) y `VITE_API_KEY` (mismo valor que
`ADKIO_API_KEY`).

Guía paso a paso para conseguir credenciales de test: [`docs/SETUP_API_KEYS.md`](docs/SETUP_API_KEYS.md).

---

## Frontend

SPA sin router: `App.tsx` hace un `switch` sobre `window.location.pathname`.

| Ruta | Pantalla |
|---|---|
| `/` | Landing |
| `/login`, `/signup` | Auth (split layout) |
| `/dashboard` | Historial de campañas + drawer de conexiones (`?panel=settings`) |
| `/app` | Workspace de campaña: chat + panel de razonamiento + preview |
| `/privacidad`, `/terminos`, `/seguridad`, `/cookies` | Legales |

Todas las llamadas a la API pasan por `lib/api.ts` (`apiFetch` / `apiUrl`), que agrega `X-API-Key` y
el `Bearer` desde `localStorage` — **nunca `fetch` directo a la API**. El SSE se consume en
`hooks/useCampaignStream.ts`. Los errores de FastAPI se normalizan con `errorMessageFromDetail`,
que cubre el caso de Pydantic (`detail` como array de objetos).

---

## Estructura del repo

```
backend/
  main.py                  FastAPI: campaña, onboarding, marca, whitelist
  llm.py                   único punto de configuración del LLM (litellm)
  agents/                  campaign_agent (loop de tool use + SSE), onboarding_agent
  tools/                   8 tools del agente — cada una devuelve rationale
  integrations/            adapters por plataforma + contratos (base.py) + registry
  services/                credential_resolver (env / DB) con ContextVar por request
  auth/                    signup, login, refresh, JWT, hashing bcrypt
  api/connections.py       OAuth y API-key manual por plataforma
  middleware/tenant.py     valida JWT y publica account_id en request.state
  security/                cifrado Fernet de tokens de plataforma
  db/                      cliente Supabase, schema.sql, migrations/, seed.py
frontend/src/
  pages/                   Landing, AuthPage, DashboardPage, AppPage, LegalPage
  components/              landing/, dashboard/, app/, shell/, settings/, ui/
  hooks/                   useCampaignStream (SSE), useViewport
  lib/                     api.ts, auth.ts, dashboard-data.ts, styles.ts
tests/                     pytest del core: tools, adapters, endpoints, resolver
scripts/                   smoke tests manuales contra APIs reales y timings
docs/                      ver tabla al inicio
```

---

## Deploy

Dos servicios en un proyecto de Railway (backend con `backend/Dockerfile`, frontend estático con
`frontend/Dockerfile`) y Supabase gestionado fuera. Variables en Railway, nunca en la imagen.
Plantilla en `.env.production.example`.

Criterio de aceptación del deploy: `GET /health` responde 200 y `POST /auth/signup` devuelve
200/201/409, nunca 500. Un "Failed to fetch" en el browser se interpreta primero como 500 del
backend por DNS a Supabase, **no** como CORS.

Topología, contrato de variables entre servicios y el runbook del fallo de DNS (incluido
`ipv6EgressEnabled`) en
[`docs/adr/ADR-001-railway-production-deploy.md`](docs/adr/ADR-001-railway-production-deploy.md).

---

## Seguridad

| Control | Dónde |
|---|---|
| Rate limiting por IP | slowapi, por endpoint |
| API key en endpoints de LLM | `require_api_key` (`X-API-Key`) |
| Guard de prompt injection | `_INJECTION_PATTERNS` en `main.py` → 400 |
| Validación estricta de input | Pydantic v2: longitudes, control chars, regex de IDs, tamaño de payload |
| Caps de tokens | `llm.py` |
| Headers HTTP | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS en https |
| Sin fuga de errores | Handler global → `{"error": "Internal server error"}` |
| Passwords | bcrypt |
| Tokens de plataforma | Cifrados con Fernet en reposo; nunca se loguean |
| Guardrail de gasto | Toda campaña se crea PAUSED |

Gaps conocidos (verificación de email, password reset, rate limit por cuenta, observability) y
riesgos de abrir el link público: [`docs/STATUS.md`](docs/STATUS.md).

**No usar con ad accounts de producción todavía.**
