## Why

ADK-9 dejó `campaign_metrics` y el GET autenticado, pero nadie escribe filas. Sin ingesta el
dashboard (ADK-15) autentica contra una tabla vacía y no hay dato defendible frente a un cliente.
Linear ADK-16 está desbloqueada: tabla en AdkioDatabase y ADK-6 fijó métricas por SDK, no MCP.

## What Changes

- Job de ingesta diaria **solo Meta** que recorre campañas reales del tenant y hace upsert en
  `campaign_metrics`.
- Extender `get_campaign` / `CampaignStatus`: `clicks` y `metric_date` opcional. Sin fecha =
  comportamiento actual (status). Con fecha = insights de ese día UTC.
- Google Ads y TikTok aceptan el kwarg y lo ignoran; el job no los visita.
- Cron Job en **Render** (servicio aparte, no dentro de uvicorn), documentado. Schedule
  `0 6 * * *` UTC. Cada run re-upserta D-1..D-3 UTC.
- Credenciales por `DBCredentialResolver(account_id)` — adapters y tools no leen env ni DB.
- Skip `is_mock`, skip sin `account_id`, skip sin conexión Meta. Meta en serie (SDK no thread-safe).
- Tests sin red ni credenciales reales. README + `.env.example` si hace falta secret de corrida
  manual.

**Fuera de este change:** UI del dashboard (ADK-15), ingestir TikTok/Google, MCP de Meta, backfill
de 90 días, FK a `campaigns`, escribir métricas por HTTP público.

## Capabilities

### New Capabilities

- `campaign-metrics-ingest`: job diario que pide insights a Meta por campaña y persiste una fila
  por `(account_id, platform, campaign_id, metric_date)` usando los helpers de ADK-9.

### Modified Capabilities

- (ninguna — `openspec/specs/` no tiene `campaign-metrics` archivado; la persistencia/GET de ADK-9
  no cambia de requisitos)

## Impact

- **Adapters:** `backend/integrations/base.py` (`CampaignStatus`, firma de `get_campaign`),
  `meta_adapter.py` (insights con `time_range` + `clicks`). Google/TikTok: firma compatible, sin
  reports.
- **Job:** orquestador nuevo (módulo de jobs, no tool del LLM). Helper para listar campañas
  ingestibles (paginado, cross-tenant, filtros).
- **DB:** sin migración. Reusa `upsert_campaign_metrics` y el UNIQUE diario.
- **API HTTP:** el GET de métricas no cambia. Opcional: endpoint interno de disparo con secret —
  solo si hace falta para smoke local; el path de producción es el Cron Job.
- **Ops:** Cron Job en Render dashboard (MCP no cubre bien Docker). Mismas env que el web service
  (`srv-da3je4ou01pc738sn8u0`). Sin llamadas al LLM.
- **Downstream:** ADK-15 Fase B deja de ver lista vacía tras el primer run.
- **No breaking:** callers de `get_campaign` sin `metric_date` siguen igual; `_CAMPAIGN_FIELDS` no
  se toca.
