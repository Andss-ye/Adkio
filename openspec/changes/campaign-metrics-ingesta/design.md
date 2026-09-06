## Context

Linear **ADK-16** (`Ingesta diaria de métricas`) en el milestone *M3 Ver y recordar*.
ADK-9 ya entregó tabla, helpers (`upsert_campaign_metrics` / `list_campaign_metrics`) y
`GET /campaigns/{id}/metrics`. ADK-6 fijó métricas por **SDK**, no MCP.

Hoy `get_campaign()` pide insights a Meta/Google (TikTok ni eso) **sin rango diario ni clicks**
y el resultado se descarta. Meter esos totales en `campaign_metrics` envenenaría el dashboard
(ADK-15): lifetime no es un día.

Decisiones cerradas en explore con Julián (El bossi), 2026-09-05:

1. Solo Meta
2. Extender `get_campaign` (no método nuevo)
3. Cron en Render
4. Ventana D-1..D-3 UTC, schedule `0 6 * * *` UTC
5. ADK-16 desbloqueada (Todo, sin label `bloqueada`)

Referencias: `docs/features/FEATURES_2026_08.md`, ADK-6 comentario de Andrew, CLAUDE.md
(invariante tools/adapters sin env/DB; Meta SDK no thread-safe), change `campaign-metrics-tabla`.

Stakeholders: Julián (implementación), Freddy (TikTok/Google **fuera** de este issue), Jonathan
(ADK-15 consume filas), Andrew (merge).

Host de producto: backend [Render `srv-da3je4ou01pc738sn8u0`](https://dashboard.render.com/web/srv-da3je4ou01pc738sn8u0);
frontend Cloudflare Pages `adkio`. El cron es un **servicio aparte** en el mismo proyecto Render.

## Goals / Non-Goals

**Goals:**

- Un job repetible que, por cada campaña Meta real de un tenant, persista filas diarias con
  impressions, reach, clicks y spend_usd.
- Extender el contrato de adapters sin romper callers que hoy piden status live.
- Cron documentado en Render (comando, schedule, env). Idempotente vía UNIQUE de ADK-9.
- Tests con dobles; sin red ni credenciales.

**Non-Goals:**

- Ingestir TikTok o Google Ads.
- UI / Fase B del dashboard (ADK-15).
- Endpoint HTTP público de escritura. El disparo de producción es el Cron Job.
- Backfill histórico (>3 días).
- Migrar `meta_adapter` a MCP o HTTP directo (el lock de SDK queda: serializar).
- Meter el scheduler dentro de uvicorn (estado in-memory / réplicas).

## Decisions

### 1. Extender `get_campaign`, no agregar `get_daily_insights`

```python
def get_campaign(
    credentials, campaign_id: str, metric_date: Optional[date] = None
) -> CampaignStatus
```

`CampaignStatus` suma `clicks: int = 0` (default; tests actuales no rompen).

| `metric_date` | Comportamiento |
|---|---|
| `None` | Igual que hoy: status + insights sin rango (clicks queda 0) |
| `date` | Insights de ese día UTC, **incluyendo clicks** |

El job **siempre** pasa fecha. Así no se escribe lifetime en una fila diaria.

Google Ads y TikTok: mismo kwarg, lo ignoran (alcance A). El Protocol exige la firma en los tres
para que `test_contract.py` siga pasando.

**Alternativa descartada:** método nuevo `get_daily_insights`. Más limpio semánticamente, pero
Julián eligió extender el existente. El default `None` cumple el mismo aislamiento.

### 2. Meta: `time_range` de un día + `clicks`

Con fecha, `Campaign.get_insights` pide `reach`, `impressions`, `spend`, `clicks` con
`time_range = {since, until}` igual al ISO de `metric_date` y `time_increment=1`.

`metric_date` es DATE UTC (contrato de la tabla). Meta interpreta `time_range` en timezone de la
ad account. El desfase de medianoche lo absorbe la ventana de 3 días (decisión 4).

Sin fecha: no cambiar el request actual (compat).

**Alternativa descartada:** reusar insights lifetime y guardarlas como “hoy”. Rompe ADK-15.

### 3. Walker en `backend/jobs/`, no tool ni `scripts/`

Orquestador: `backend/jobs/ingest_campaign_metrics.py` (o paquete equivalente), entrypoint

```bash
python -m backend.jobs.ingest_campaign_metrics
```

No es tool del LLM (ADK-6: el cron no gasta tokens). No vive en `scripts/` (smoke manual; el
backend no los importa).

Flujo:

```
listar campañas ingestibles
  → platform=meta, is_mock=false, account_id NOT NULL, deleted_at IS NULL
  → paginar (no limit 50 de list_campaigns)
por campaña, en serie:
  DBCredentialResolver(account_id).resolve("meta")
  si None → skip + log
  por d in {D-1, D-2, D-3} UTC:
    status = adapter.get_campaign(creds, campaign_id, metric_date=d)
    si status.error → log y seguir (no abortar el batch)
    upsert_campaign_metrics(...)
resumen en log: ingested / skipped / failed
```

Nueva helper de listado en `supabase_client.py` (whitelist/filtros). `list_campaigns` actual no
sirve: es tenant-scoped y `limit=50`.

**Alternativa descartada:** `POST /internal/ingest` + secret. Suma superficie de auth. Local y
Render usan el mismo módulo. Si más adelante hace falta un disparo HTTP, se agrega aparte.

### 4. Ventana D-1..D-3 UTC a las 06:00 UTC

- `today_utc - 1`, `- 2`, `- 3`. Nunca “hoy” (día incompleto).
- Primer run = misma ventana. Sin backfill de 90 días (campañas PAUSED, poco historial).
- Re-upsert cubre atribución tardía de Meta. El UNIQUE
  `(account_id, platform, campaign_id, metric_date)` es la idempotencia.

Schedule cron: `0 6 * * *` → 01:00 America/Bogota.

### 5. Cron Job en Render, imagen Docker, comando override

Mismo repo y Dockerfile que el web service. El `CMD` de `backend/Dockerfile` sigue siendo
uvicorn. El Cron Job **overridea** el start command a
`python -m backend.jobs.ingest_campaign_metrics`.

Env: las mismas que el backend (`SUPABASE_*`, `PLATFORM_TOKENS_ENC_KEY`). No hace falta
`LLM_*` ni `ADKIO_API_KEY`.

Creación: [dashboard Render Cron](https://dashboard.render.com/create). El MCP `create_cron_job`
no cubre bien Docker (el backend es imagen). Documentar pasos en README (sección Deploy).

**Alternativa descartada:** APScheduler dentro de FastAPI — choca con restarts y >1 réplica
(gotcha de CLAUDE.md). Railway cron: el producto ya no corre ahí.

### 6. Tenancy y honestidad mock

- Creds **solo** vía `DBCredentialResolver(account_id)` instanciado por fila. Nunca
  `EnvCredentialResolver` en el job de producto (evitaría el bug de “página/ads de Adkio”).
- Skip `is_mock=true`: no llamar a Meta, no inventar filas.
- Skip `account_id` NULL: el helper de upsert lo rechaza; el walker no llega.
- Fallo de un tenant/campaña no aborta el resto.
- Meta en **serie** (`FacebookAdsApi.init` es global).

Tests: adapters con dobles; resolver inyectado o client mock; `EnvCredentialResolver` solo en
unit tests del adapter, no como path del job de producción.

## Risks / Trade-offs

- **[Risk]** `get_campaign` con y sin fecha mezclan “status live” y “serie diaria” en un método →
  **Mitigation:** el job nunca omite `metric_date`; callers actuales no pasan fecha.
- **[Risk]** Timezone ad account ≠ UTC en el corte de medianoche → **Mitigation:** ventana de 3
  días; documentar en README que `metric_date` es UTC.
- **[Risk]** Usar `EnvCredentialResolver` “para el demo” escribe métricas en la cuenta de Adkio →
  **Mitigation:** el job de producto no tiene ese fallback. Sin conexión DB, skip.
- **[Risk]** Paralelizar tenants Meta cruza tokens → **Mitigation:** loop síncrono, un
  `_init_api` a la vez.
- **[Risk]** `list_campaigns(limit=50)` como fuente pierde campañas en silencio → **Mitigation:**
  helper propio con paginación.
- **[Risk]** Primeros días el dashboard muestra ceros (campañas PAUSED, ADK-21 no hecho) →
  **Trade-off aceptado:** ceros reales ≠ mock. ADK-15 no debe pintarlos como “sin datos” ni como
  mock.
- **[Trade-off]** Solo Meta. TikTok/Google quedan 0 hasta otro change. Alineado al sprint de
  plata real Meta.
- **[Risk]** Cron mal configurado en el web service (historial Railway: cron en el frontend) →
  **Mitigation:** servicio Cron Job **aparte**; Dockerfile no cambia el `CMD` de uvicorn.

## Migration Plan

1. Julián implementa en `feature/julian-ingesta-metricas` (Linear: ADK-16).
2. Tests `pytest` sin red. PR a `main`, merge Andrew.
3. Redeploy del **web** en Render (el código del adapter/job entra en la imagen).
4. Julián crea el Cron Job en el dashboard (mismo repo/branch `main`, Docker, start command del
   módulo, env copiadas del web, schedule `0 6 * * *`). Primer run manual desde el dashboard
   para verificar logs.
5. Verificar filas en AdkioDatabase (`campaign_metrics`) y avisar a Jonathan (ADK-15).
6. Cerrar checklist Linear ADK-16.

**Rollback:** pausar o borrar el Cron Job en Render. El código de `get_campaign` con default
`None` no rompe el API existente. Filas mal ingestidas: borrar por `metric_date` o re-correr el
job (upsert). No hay migración SQL que revertir.

## Open Questions

Ninguna bloqueante. Hosting, alcance, firma y ventana quedaron fijos en explore.
