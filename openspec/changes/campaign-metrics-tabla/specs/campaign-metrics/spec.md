## ADDED Requirements

### Requirement: Persistencia diaria de métricas por tenant
El sistema SHALL persistir métricas de campaña en la tabla `campaign_metrics` con exactamente una fila por combinación `(account_id, platform, campaign_id, metric_date)`.

#### Scenario: Upsert del mismo día actualiza la fila
- **WHEN** se upsertan métricas para la misma cuenta, plataforma, `campaign_id` y `metric_date` que ya existen
- **THEN** el sistema actualiza impresiones, reach, clicks y `spend_usd` de esa fila sin crear un duplicado

#### Scenario: Días distintos crean filas distintas
- **WHEN** se upsertan métricas para el mismo `campaign_id` en dos `metric_date` diferentes
- **THEN** el sistema conserva dos filas independientes

### Requirement: account_id obligatorio en cada fila
Cada fila de `campaign_metrics` MUST incluir un `account_id` no nulo que referencie `accounts(id)`.

#### Scenario: Insert sin account_id es inválido
- **WHEN** un caller intenta persistir métricas sin `account_id`
- **THEN** la operación falla (validación en capa de datos o rechazo del helper) y no se crea la fila

### Requirement: Columnas de métricas mínimas
Cada fila SHALL almacenar al menos `impressions`, `reach`, `clicks` y `spend_usd`, con default 0 si no se informan.

#### Scenario: Upsert parcial rellena ceros
- **WHEN** se upsertan métricas omitiendo `clicks` y `reach`
- **THEN** esos campos quedan en 0 (o se preservan valores previos en un upsert parcial según el helper) y la fila es legible

### Requirement: Lectura filtrada por tenancy
El helper de listado MUST filtrar siempre por `account_id` del caller autenticado y NUNCA devolver filas de otra cuenta.

#### Scenario: Listado solo del tenant
- **WHEN** una cuenta A lista métricas de un `campaign_id`
- **THEN** solo recibe filas con `account_id = A`

### Requirement: Endpoint GET mínimo autenticado
El sistema SHALL exponer `GET /campaigns/{campaign_id}/metrics` que requiere JWT con `account_id` y devuelve las filas diarias de esa campaña para ese tenant.

#### Scenario: Lectura exitosa con JWT
- **WHEN** un cliente autenticado pide `GET /campaigns/{campaign_id}/metrics`
- **THEN** recibe una lista de métricas diarias (impresiones, reach, clicks, spend_usd, metric_date, platform) de su cuenta

#### Scenario: Sin JWT se rechaza
- **WHEN** un cliente sin JWT válido pide el endpoint
- **THEN** la API responde 401 y no consulta filas de ningún tenant

#### Scenario: Campaña de otro tenant no filtra
- **WHEN** la cuenta A pide métricas de un `campaign_id` que solo tiene filas de la cuenta B
- **THEN** la respuesta es una lista vacía (no 403 de existencia cruzada) o equivalente que no filtre datos ajenos

### Requirement: Migración idempotente y schema consolidado
El cambio SHALL agregar `backend/db/migrations/006_campaign_metrics.sql` idempotente (`IF NOT EXISTS`) y reflejar la tabla en `backend/db/schema.sql`.

#### Scenario: Reaplicar migración no falla
- **WHEN** la migración 006 se ejecuta dos veces sobre la misma base
- **THEN** la segunda ejecución no errora y el schema permanece equivalente
