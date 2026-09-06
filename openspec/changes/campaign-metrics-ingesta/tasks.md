## 1. Contrato de adapters

- [x] 1.1 Agregar `clicks: int = 0` y `metric_date: Optional[date] = None` a `get_campaign` en `PlatformAdapter` y `CampaignStatus` (`backend/integrations/base.py`)
- [x] 1.2 Meta: con `metric_date`, `get_insights` de un día UTC (`time_range` + `time_increment=1`) incluyendo `clicks`; sin fecha, comportamiento actual
- [x] 1.3 Google Ads y TikTok: aceptar `metric_date` y ignorarlo (sin reports nuevos)
- [x] 1.4 Actualizar tests de contrato y de `get_campaign` (Meta con fecha + clicks; sin fecha no rompe; Google/TikTok no fallan con el kwarg)

## 2. Listado ingestible

- [x] 2.1 Helper en `supabase_client.py` que pagina campañas `platform=meta`, `is_mock=false`, `account_id` NOT NULL, `deleted_at` IS NULL (no reusar `list_campaigns` con limit 50)
- [x] 2.2 Tests del helper con client mock: filtros, skip mock, paginación

## 3. Job de ingesta

- [x] 3.1 Módulo `backend/jobs/ingest_campaign_metrics.py` con entrypoint `python -m backend.jobs.ingest_campaign_metrics`
- [x] 3.2 Walker: `DBCredentialResolver(account_id)` por campaña; skip sin conexión; Meta en serie; ventana D-1..D-3 UTC; upsert; error de una campaña no aborta el batch
- [x] 3.3 Tests del walker con adapter y client mock: ingest Meta, skip mock, skip sin creds, skip TikTok/Google, idempotencia del mismo día, aislamiento de errores. Sin red ni env real

## 4. Documentación

- [x] 4.1 README: cómo corre el job, schedule `0 6 * * *` UTC, `metric_date` en UTC, clicks llegan con la ingesta, Cron Job en Render (no Railway, no dentro de uvicorn)
- [x] 4.2 Verificar que el `CMD` de `backend/Dockerfile` sigue siendo uvicorn (el Cron overridea start command)

## 5. PR

- [x] 5.1 Checklist ADK-16 en código: creds por parámetro, sin env en adapters, sin tocar `_CAMPAIGN_FIELDS`, sin LLM en el job
- [ ] 5.2 Abrir PR a `main` con `Linear: ADK-16` desde `feature/julian-ingesta-metricas`

## 6. Operación post-merge

- [ ] 6.1 **Andrew:** mergear el PR a `main`
- [ ] 6.2 **Julián:** redeploy del web service Render (`srv-da3je4ou01pc738sn8u0`) para que la imagen incluya adapter + job
- [ ] 6.3 **Julián:** crear Cron Job en el [dashboard Render](https://dashboard.render.com/create) (Docker, mismo repo/`main`, start command del módulo, env copiadas del web, `0 6 * * *`). El MCP no cubre bien Docker
- [ ] 6.4 **Julián:** disparo manual del cron y verificar filas en AdkioDatabase (`campaign_metrics`)
- [ ] 6.5 **Julián:** avisar a Jonathan (ADK-15) que ya hay (o puede haber) filas reales, no solo el GET vacío
- [ ] 6.6 **Julián:** tildar checklist de ADK-16 en Linear y pasarlo a Done
