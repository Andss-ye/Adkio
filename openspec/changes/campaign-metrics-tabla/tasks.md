## 1. Base de datos

- [x] 1.1 Crear `backend/db/migrations/006_campaign_metrics.sql` idempotente (tabla, UNIQUE nombrado, índices, cabecera CODESTYLE)
- [x] 1.2 Reflejar `campaign_metrics` en `backend/db/schema.sql`

## 2. Persistencia

- [x] 2.1 Agregar sección Campaign metrics en `supabase_client.py` con `_METRICS_FIELDS`, `upsert_campaign_metrics` y `list_campaign_metrics` (filtro `account_id` obligatorio)
- [x] 2.2 Tests unitarios sin red: whitelist, upsert `on_conflict`, list filtra por tenant (client mock)

## 3. API mínima

- [x] 3.1 Implementar `GET /campaigns/{campaign_id}/metrics` en `main.py` (JWT → account_id, 401 sin auth, query `from`/`to`/`limit`, rate limit)
- [x] 3.2 Tests de endpoint: 401 sin JWT; con JWT mockeado solo filas del tenant

## 4. Documentación y cierre

- [x] 4.1 Actualizar `README.md` (fila API + modelo de datos `campaign_metrics`)
- [x] 4.2 Verificar checklist ADK-9: migración+schema, insert/leer, sin tocar `_CAMPAIGN_FIELDS`, sin cron
- [ ] 4.3 Abrir PR a `main` con `Linear: ADK-9` (Julián)

## 5. Operación post-PR (después de que exista el PR)

- [ ] 5.1 **Andrew:** mergear el PR a `main` (único merge del sprint)
- [ ] 5.2 **Julián:** pegar `006_campaign_metrics.sql` en el SQL Editor de Supabase y ejecutarlo
- [ ] 5.3 **Julián:** verificar que la tabla existe (`information_schema` / select vacío)
- [ ] 5.4 **Julián:** redeploy del backend en Railway
- [ ] 5.5 **Julián:** avisar a Jonathan que ADK-15 Fase B ya puede cablear datos reales
