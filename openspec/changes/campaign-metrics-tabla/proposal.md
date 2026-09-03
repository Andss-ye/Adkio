## Why

Hoy `get_campaign()` consulta impresiones/clics/gasto en las plataformas y descarta el resultado.
Sin persistencia no hay dashboard real (ADK-15), ni ingesta diaria (ADK-16), ni datos defendibles
frente a un cliente. Linear ADK-9 pide la tabla usable ahora; el cron queda fuera de alcance.

## What Changes

- Nueva tabla `campaign_metrics` con grano **diario**, `clicks` incluido y `account_id` **obligatorio**.
- Migración idempotente `006_campaign_metrics.sql` reflejada en `schema.sql`.
- Helpers en `supabase_client.py`: upsert + list filtrado por tenant (whitelist de campos).
- Endpoint mínimo `GET /campaigns/{campaign_id}/metrics` autenticado (JWT → `account_id`).
- Documentación en `README.md` (API + modelo de datos).
- Tests sin red ni DB real.

**Fuera de este change:** job/cron de ingesta (ADK-16), cambios a adapters/`CampaignStatus`, UI del dashboard.

## Capabilities

### New Capabilities

- `campaign-metrics`: persistencia diaria de métricas por cuenta/plataforma/campaña y lectura HTTP mínima con aislamiento de tenancy.

### Modified Capabilities

- (ninguna — no hay specs previas de métricas en `openspec/specs/`)

## Impact

- **DB:** nueva tabla + índices + UNIQUE diario; FK a `accounts`.
- **Backend:** `backend/db/migrations/`, `schema.sql`, `supabase_client.py`, `main.py` (endpoint), tests.
- **Docs:** `README.md` (contrato API / modelo de datos).
- **Downstream:** desbloquea ADK-15 (wire real) y ADK-16 (ingesta) tras merge.
- **Operación:** Julián abre el PR, aplica `006` en Supabase, redeploy Railway y avisa a Jonathan. **Andrew** mergea.
- **No breaking:** endpoints existentes intactos; `_CAMPAIGN_FIELDS` no se modifica.
