## Context

Linear **ADK-9** (`campaign_metrics: tabla + migración`) en el sprint *Plata real Meta — 12–17 ago*.
Hoy los adapters (`CampaignStatus`) leen reach/impressions/spend y no persisten nada. La tabla
`campaigns` vive fuera de `schema.sql` (gotcha histórico); las métricas serán tabla nueva.

Decisiones cerradas en explore con Julián (El bossi):

1. Grano diario
2. Incluir `clicks`
3. `account_id` obligatorio
4. Endpoint GET mínimo (no solo helpers)

Referencias: `docs/features/FEATURES_2026_08.md`, `docs/CODESTYLE.md` §1.7 / receta endpoint,
`backend/db/supabase_client.py`, CODESTYLE SQL (`TIMESTAMPTZ`, `UUID`, snake_case).

Stakeholders: Julián (implementación), Jonathan (ADK-15 consume el GET), Andrew (merge), Freddy
(apoyo posterior en ADK-16).

## Goals / Non-Goals

**Goals:**

- Tabla `campaign_metrics` usable (insert/upsert + read) con tenancy fuerte.
- Unicidad diaria para re-ingesta idempotente (ADK-16).
- GET mínimo autenticado para cablear el dashboard.
- Migración + `schema.sql` + README alineados al contrato.

**Non-Goals:**

- Job/cron Railway ni llamada a plataformas (ADK-16).
- Extender `CampaignStatus` / adapters para pedir clicks (puede quedar 0 hasta ADK-16).
- UI del dashboard (ADK-15).
- FK a `campaigns` (tabla no consolidada en `schema.sql`).
- Escritura HTTP pública de métricas (solo helpers Python en este change).

## Decisions

### 1. Schema y unicidad

```sql
UNIQUE (account_id, platform, campaign_id, metric_date)
```

- `platform` con `CHECK (platform IN ('meta', 'tiktok', 'google_ads'))` alineado a
  `platform_connections`.
- `campaign_id` TEXT = id en la plataforma (mismo significado que en `campaigns`).
- `metric_date` DATE en UTC.
- Métricas: `impressions`, `reach`, `clicks` INT DEFAULT 0; `spend_usd NUMERIC(12,2)` DEFAULT 0.
- `brand_id` TEXT NULL (facilita queries de marca; **no** sustituye tenancy).
- `ON DELETE CASCADE` desde `accounts`.

**Alternativa descartada:** UNIQUE sin `account_id` — más frágil si algún día dos tenants
compartieran ids de prueba.

### 2. Helpers en `supabase_client.py`

Nueva sección `# ── Campaign metrics ──` con:

- `_METRICS_FIELDS` (whitelist; no tocar `_CAMPAIGN_FIELDS`).
- `upsert_campaign_metrics(data) -> str` usando `on_conflict` del UNIQUE.
- `list_campaign_metrics(account_id, campaign_id=None, date_from=None, date_to=None, limit=...)`.

Patrón calcado de `upsert_brand_config` / `list_campaigns`. Tests con client mockeado (sin red).

### 3. Endpoint mínimo

`GET /campaigns/{campaign_id}/metrics`

- Query opcionales: `from`, `to` (ISO date), `limit` (cap razonable, p.ej. 90).
- `account_id` desde `request.state` (JWT). Sin JWT → **401** (más estricto que `GET /campaigns`,
  coherente con `account_id` NOT NULL).
- Rate limit al estilo vecinos (`30/minute`).
- Pydantic solo si hay query params que validar; respuesta `list[dict]` o modelo de lectura simple.
- Documentar en tabla API del README.

**Alternativa descartada:** `GET /campaign-metrics?brand_id=` sin auth — rompe la decisión de
tenancy obligatorio.

### 4. Sin FK a `campaigns`

`campaigns` no está en `schema.sql`; referencias por `(platform, campaign_id)` texto. Evita migraciones
fantasma y no bloquea demos donde la fila de campaña aún no exista.

### 5. Numeración de migración

Siguiente archivo: `006_campaign_metrics.sql` (última existente: `005_account_brand.sql`).

## Risks / Trade-offs

- **[Risk]** Clicks en 0 hasta que ADK-16 pida el campo a Meta/Google → **Mitigation:** columna
  lista; documentar en rationale/README que la ingesta llena clicks después.
- **[Risk]** Demo single-tenant sin JWT no puede leer métricas por este GET → **Mitigation:**
  aceptado; dashboard autenticado. Escritura vía helpers siempre exige `account_id`.
- **[Risk]** Reaplicar UNIQUE en upsert depende del nombre de constraint en PostgREST →
  **Mitigation:** nombrar constraint explícitamente en la migración y usarlo en `on_conflict`.
- **[Trade-off]** Incluir `reach` aunque ADK-15 pida solo gasto/impresiones/clics → barato y Meta
  ya lo trae; útil para reportes.

## Migration Plan

1. **Julián** abre PR a `main` (`Linear: ADK-9`).
2. **Andrew** mergea el PR a `main` (único merge del sprint).
3. **Julián** pega `006_campaign_metrics.sql` en el SQL Editor de Supabase y lo ejecuta.
4. **Julián** verifica que la tabla existe y hace redeploy del backend en Railway.
5. **Julián** avisa a Jonathan (ADK-15 Fase B) y desbloquea preparación de ADK-16.

**Rollback:** `DROP TABLE IF EXISTS campaign_metrics;` (sin datos de producción críticos aún) +
revert del PR. No afecta `campaigns` ni auth.

## Open Questions

Ninguna bloqueante — las 4 decisiones de explore están cerradas. Detalle de naming exacto del
constraint UNIQUE se fija en implementación (`campaign_metrics_account_platform_campaign_date_key`
o similar).
