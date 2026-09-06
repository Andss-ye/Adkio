## ADDED Requirements

### Requirement: Ingesta diaria solo Meta
El job de ingesta SHALL recorrer únicamente campañas con `platform = meta`, `is_mock = false`,
`account_id` no nulo y no borradas lógicamente, y persistir métricas vía
`upsert_campaign_metrics`. MUST NOT llamar a adapters de TikTok ni Google Ads.

#### Scenario: Campaña Meta real se ingiere
- **WHEN** existe una campaña Meta con `account_id`, `is_mock = false` y conexión Meta resoluble
- **THEN** el job pide insights al adapter Meta y upserta filas en `campaign_metrics` para esa
  cuenta y `campaign_id`

#### Scenario: Mock no se consulta ni se inventa
- **WHEN** la campaña tiene `is_mock = true`
- **THEN** el job no llama a Meta y no crea ni actualiza filas de métricas para esa campaña

#### Scenario: TikTok y Google Ads se omiten
- **WHEN** el universo incluye campañas `tiktok` o `google_ads`
- **THEN** el job no las visita y no escribe filas para esas plataformas

### Requirement: Ventana D-1 a D-3 UTC
Cada corrida SHALL upsertar métricas para los tres días UTC anteriores a la fecha de corrida
(D-1, D-2, D-3) y MUST NOT persistir el día UTC en curso como si estuviera cerrado.

#### Scenario: Tres días por campaña
- **WHEN** el job corre en una fecha UTC T
- **THEN** intenta persistir `metric_date` = T-1, T-2 y T-3 para cada campaña ingestible

#### Scenario: Re-corrida del mismo día es idempotente
- **WHEN** el job corre dos veces el mismo día UTC para la misma campaña y las mismas fechas
- **THEN** no se duplican filas; los valores de métricas de esas fechas quedan actualizados

### Requirement: get_campaign con fecha diaria y clicks
`get_campaign` SHALL aceptar `metric_date` opcional. Sin fecha, MUST preservar el comportamiento
de status live actual. Con fecha, el adapter Meta MUST devolver impressions, reach, clicks y
spend de ese día (ceros si la plataforma no tiene actividad).

#### Scenario: Sin fecha no exige clicks diarios
- **WHEN** un caller invoca `get_campaign(credentials, campaign_id)` sin `metric_date`
- **THEN** recibe status de campaña como hoy (nombre, estado, insights sin rango diario) y no
  falla por ausencia de `clicks`

#### Scenario: Con fecha Meta incluye clicks del día
- **WHEN** el job llama `get_campaign(credentials, campaign_id, metric_date=d)` contra Meta
- **THEN** el `CampaignStatus` incluye `clicks` e insights acotados a `d`, y el upsert guarda
  esos valores en `campaign_metrics` para `metric_date = d`

#### Scenario: Google y TikTok aceptan el kwarg
- **WHEN** se llama `get_campaign` con `metric_date` en los adapters Google Ads o TikTok
- **THEN** la llamada no errora por el parámetro extra (el job no depende de sus insights)

### Requirement: Credenciales por tenant, nunca env de Adkio
El job de producto MUST resolver credenciales con `DBCredentialResolver(account_id)` (o
equivalente por cuenta) y MUST NOT usar `EnvCredentialResolver` como fallback de producción.
Si no hay conexión Meta, skip de esa campaña. Adapters MUST seguir recibiendo credenciales por
parámetro.

#### Scenario: Sin conexión Meta se salta
- **WHEN** una campaña Meta ingestible no tiene fila resoluble en `platform_connections`
- **THEN** el job no llama al adapter, no escribe métricas y continúa con la siguiente campaña

#### Scenario: Credenciales de la cuenta, no del proceso
- **WHEN** dos cuentas tienen campañas Meta distintas
- **THEN** cada una se consulta con las credenciales cifradas de su `account_id`, no con las
  variables de entorno del proceso

### Requirement: Fallo aislado y Meta en serie
El fallo de una campaña o un día MUST NO abortar el resto del batch. Las llamadas al adapter
Meta MUST ser secuenciales.

#### Scenario: Error de una campaña no tumba el job
- **WHEN** Meta devuelve error para la campaña A y la campaña B es válida
- **THEN** A se registra como fallida (log) y B se ingiere

#### Scenario: Un solo init de SDK a la vez
- **WHEN** el job procesa varias cuentas Meta
- **THEN** no dispara `get_campaign` de Meta en paralelo entre esas cuentas

### Requirement: Cron en Render documentado
El change SHALL documentar un Cron Job de Render aparte del web service, schedule
`0 6 * * *` UTC, mismo repo/imagen, start command del módulo de ingesta, sin alterar el `CMD`
de uvicorn del Dockerfile.

#### Scenario: Web service no es el scheduler
- **WHEN** se despliega el backend web
- **THEN** sigue sirviendo HTTP con uvicorn y no ejecuta la ingesta en el boot del proceso web

#### Scenario: Cron usa el módulo de ingesta
- **WHEN** el Cron Job dispara a la hora programada
- **THEN** corre el entrypoint de `backend.jobs` de métricas (no uvicorn) y escribe o actualiza
  filas en `campaign_metrics`
