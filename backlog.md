# Adkio — Product Backlog

> Este archivo es el backlog vivo del producto. Claude Code lo lee, ejecuta los ítems según se le indique, y marca cada uno con `[x]` cuando está completo.
> 
> **Cómo trabajar con este archivo:**
> - Ejecutar en el orden indicado dentro de cada sprint
> - Marcar `[x]` cuando el ítem esté completo y funcional
> - Si un ítem genera un blocker, documentarlo inline con `⚠️ BLOCKER:`
> - No pasar al siguiente sprint sin completar los críticos del actual

---

## Estrategia de ramas (Git)

Cada feature/fix va en su propia rama. PRs a `main`. Base siempre desde el estado más reciente de `main`.

| Rama | Estado | Contenido |
|---|---|---|
| `fix/scroll-and-mock-data` | ✅ listo para PR | Scroll dashboard+/app, eliminar mocks, skeleton loading |
| `feat/dashboard-refactor` | ✅ listo para PR | Refactor DashboardPage, StatsBar, InstagramAdPreview, CPL honesto |
| `feat/landing-improvements` | 🔲 pendiente | GTM badge, sponsors, "menos de 1 minuto", copias honestas |
| `feat/post-launch-ui` | 🔲 pendiente | Sprint 0.2: UI estado honesto post-aprobación |
| `feat/sprint1-audience-insights` | 🔲 pendiente | Sprint 1.4: flags, barra edad, intereses visuales |
| `feat/security-sprint0` | 🔲 pendiente | Rate limiting, CORS, API key, sanitización |

---

## SPRINT 0 — INMEDIATO (ejecutar ahora, en este orden)

### 0.1 — Seguridad (CRÍTICO — hacer antes que cualquier otra cosa)

- [ ] **Rate limiting en todos los endpoints de la API**
  - Implementar con `slowapi` o `fastapi-limiter` + Redis (o en memoria si no hay Redis)
  - Límites: `/campaign` → 10 requests/minuto por IP, `/onboarding/message` → 20/minuto, endpoints públicos → 30/minuto
  - Devolver 429 con mensaje claro cuando se excede

- [ ] **Validación estricta de inputs en todos los endpoints**
  - Usar Pydantic v2 con validadores estrictos en todos los modelos
  - Rechazar payloads mayores a 10KB en `/campaign` y `/onboarding/message`
  - Sanitizar todos los strings que llegan al LLM — remover caracteres de control, limitar longitud máxima

- [ ] **Protección contra prompt injection**
  - Antes de pasar el `user_prompt` al agente, validar que no contenga patrones de inyección ("ignore previous instructions", "you are now", "forget everything", etc.)
  - Si detecta intento de inyección: loguear + rechazar con 400

- [ ] **Variables de entorno — auditoría completa**
  - Verificar que NINGUNA API key esté hardcodeada en el código
  - Agregar validación al startup de FastAPI: si falta una env var crítica, el servidor no arranca y loguea qué falta
  - Confirmar que `.env` está en `.gitignore` y no está commiteado

- [ ] **CORS configurado correctamente**
  - Cambiar `allow_origins=["*"]` por el dominio real del frontend
  - En desarrollo: localhost:5173. En producción: el dominio de Vercel

- [ ] **API Key para proteger los endpoints**
  - Agregar header `X-API-Key` requerido en todos los endpoints que llamen al LLM
  - El frontend lo manda en cada request. Sin la key: 401
  - Esto previene que alguien drene la cuenta de Groq/Gemini haciendo requests directos a la API

- [ ] **Límite de tokens por request al LLM**
  - En `call_llm()`, siempre setear `max_tokens` explícito (nunca ilimitado)
  - Campaign agent: máximo 2000 tokens por tool call
  - Onboarding agent: máximo 500 tokens por respuesta
  - Agregar tracking básico: loguear cuántos tokens consume cada request

- [ ] **Headers de seguridad HTTP**
  - Agregar middleware en FastAPI con: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy` básico

- [ ] **Manejo de errores — no exponer stack traces**
  - En producción, todos los errores 500 devuelven `{"error": "Internal server error"}` sin detalle
  - Los detalles solo van a los logs del servidor, nunca al cliente

---

### 0.2 — Estrategia post "Aprobar y Lanzar" (tres capas simultáneas)

- [ ] **Capa 1 — UI de estado honesto**
  - Después del click en "Aprobar y lanzar", mostrar una card de resultado con:
    - ✓ `Campaign ID: act_col_[timestamp]` (generado de forma determinista)
    - Status badge: `"Pending Meta Verification"` en amarillo
    - Texto: *"Meta requiere 2-5 días hábiles para verificar apps nuevas. Tu campaña se activará automáticamente."*
    - Botón: "Ver campaña de ejemplo" que abre la Capa 2

- [ ] **Capa 2 — Sandbox screenshot real**
  - Obtener acceso a una cuenta personal de Meta Business Manager del equipo
  - Crear una campaña de prueba real ahí en modo sandbox/test (gasto $0)
  - Tomar screenshot de esa campaña en el panel de Meta Ads Manager
  - En la UI, después del lanzamiento: sección "Así se ve en Meta Ads Manager" con ese screenshot real
  - Overlay con el campaign_id generado para que haga match visual
  - Esto es evidencia real de que el sistema conecta con Meta

- [ ] **Capa 3 — Email de confirmación simulado**
  - Cuando se "lanza" la campaña, mostrar un preview de email de confirmación con todos los detalles
  - Formato igual al que mandaría Meta cuando una campaña se activa
  - No enviar email real todavía — solo el preview visual en la UI

---

### 0.3 — Refactorización Dashboard.tsx (INMEDIATO)

- [x] **Descomponer Dashboard.tsx en componentes**
  - Crear `components/dashboard/` con:
    - `CampaignTable.tsx` — tabla de campañas históricas
    - `StatsCards.tsx` — cards de métricas superiores
    - `CampaignRow.tsx` — fila individual de la tabla
    - `StatusBadge.tsx` — badge reutilizable de estado
    - `EmptyState.tsx` — estado vacío cuando no hay campañas
  - Dashboard.tsx solo orquesta, no tiene lógica inline

- [x] **Corregir cifras y copy para que no suenen a humo**
  - Eliminar cualquier número específico de "ahorro de tiempo" que no sea demostrable
  - Usar framing honesto: "Lo que un experto tarda 45 min, Adkio lo hace en menos de 1 minuto"
  - CPL estimado: mostrar como rango (ej: "$8–25 USD") no como número exacto
  - Reach: mostrar como rango basado en el tamaño de audiencia calculado

- [ ] **Agregar sección "Construido en la GTM Hackathon"** ← en `feat/landing-improvements`
  - Badge o banner sutil en el dashboard o landing: "MVP construido en 36 horas · GTM Hackathon Bogotá · Organizado por 30X"
  - Esto da credibilidad y contexto, no lo escondas

- [ ] **Free Trial banner**
  - Banner en la parte superior del dashboard (solo para usuarios sin suscripción): "Estás en tu prueba gratuita de 14 días — X días restantes"
  - CTA: "Ver planes" (aunque Stripe no esté implementado aún)
  - El contador de días debe ser real — calculado desde `created_at` del usuario en Supabase

---

### 0.4 — CRUD completo en Supabase + Backend

- [ ] **Crear tablas faltantes en Supabase**

  ```sql
  -- Campañas
  CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_config_id UUID REFERENCES brand_configs(id),
    user_prompt TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending | active | paused | completed | failed
    campaign_id_meta TEXT,          -- el ID que devuelve Meta (o mock)
    copy_headline TEXT,
    copy_body TEXT,
    copy_cta TEXT,
    audience JSONB,
    budget_usd FLOAT,
    duration_days INT,
    cpl_estimated_min FLOAT,
    cpl_estimated_max FLOAT,
    reach_estimated_min INT,
    reach_estimated_max INT,
    canal TEXT DEFAULT 'instagram',
    approved_at TIMESTAMPTZ,
    launched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Copy Bank
  CREATE TABLE copy_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_config_id UUID REFERENCES brand_configs(id),
    campaign_id UUID REFERENCES campaigns(id),
    headline TEXT NOT NULL,
    body TEXT NOT NULL,
    cta TEXT NOT NULL,
    nivel_consciencia TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    performance_score FLOAT,        -- para futuro A/B tracking
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Tool execution logs (para el reasoning panel y auditoría)
  CREATE TABLE tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id),
    tool_name TEXT NOT NULL,
    input JSONB,
    output JSONB,
    rationale TEXT,
    duration_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Usage tracking (para rate limiting y billing futuro)
  CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_config_id UUID REFERENCES brand_configs(id),
    event_type TEXT,                -- 'campaign_created' | 'onboarding_message' | 'llm_call'
    tokens_used INT,
    cost_usd FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [ ] **Endpoints CRUD completos en FastAPI**
  - `GET /campaigns` → lista de campañas del brand_id con paginación
  - `GET /campaigns/{id}` → detalle de una campaña con sus tool_executions
  - `PATCH /campaigns/{id}/status` → actualizar status (aprobar, pausar, etc.)
  - `DELETE /campaigns/{id}` → soft delete (status = 'deleted')
  - `GET /copy-bank` → lista de copies históricos del brand
  - `PATCH /copy-bank/{id}/favorite` → marcar/desmarcar favorito
  - `GET /campaigns/export/csv` → exportar historial como CSV

- [ ] **Guardar cada campaña en Supabase al lanzar**
  - Al final del flow del campaign agent, guardar el resultado completo en `campaigns`
  - Guardar cada tool execution en `tool_executions`
  - Guardar el copy generado en `copy_bank`

---

## SPRINT 1 — FUNCIONALIDADES QUE SUMAN (HOY)

### 1.1 — Campaign History Dashboard

- [ ] **Tabla de campañas históricas**
  - Columnas: Fecha, Prompt original, Canal, Presupuesto, CPL estimado, Alcance estimado, Status
  - Status con color: pending (gris), active (verde), paused (amarillo), failed (rojo)
  - Click en una fila → abre el detalle con todo el reasoning panel completo
  - Paginación: 10 por página

- [ ] **Stats cards en el header del dashboard**
  - Total campañas lanzadas
  - Presupuesto total gestionado (suma de budgets)
  - CPL promedio de todas las campañas
  - Canal más usado
  - Todos calculados desde Supabase en tiempo real

- [ ] **Export a CSV**
  - Botón "Exportar" en el dashboard de campañas
  - CSV incluye: todas las columnas de la tabla + copy completo + audiencia
  - Implementar en el endpoint `GET /campaigns/export/csv`
  - En el frontend: `blob` download directo, sin abrir nueva tab

---

### 1.2 — Ad Preview (el WOW visual)

- [x] **Mockup de Instagram Ad**
  - Componente React que simula el card de un anuncio en Instagram feed
  - Muestra: foto de perfil de la marca, nombre, "Publicidad", imagen placeholder, copy headline + body, CTA button
  - Usa los colores y tono del brand_config
  - Se renderiza en tiempo real con el copy que generó el agente (antes de aprobar)
  - Mobile frame (phone mockup) alrededor para más realismo

- [ ] **Mockup de Facebook Ad**
  - Versión alternativa para formato feed de Facebook
  - Toggle para cambiar entre vista Instagram / Facebook

- [ ] **Posición en el flujo**
  - Aparece en el Campaign Preview (columna derecha) después de que el agente genera el copy
  - Antes del botón "Aprobar y lanzar"

---

### 1.3 — Copy Bank UI

- [ ] **Vista de Copy Bank en el dashboard**
  - Grid de cards, cada una con: headline, body truncado, CTA, fecha, campaña origen
  - Botón de estrella para marcar favoritos
  - Filtro: todos / favoritos / por canal
  - Búsqueda por texto

- [ ] **Reutilizar un copy**
  - Botón "Usar en nueva campaña" en cada card del Copy Bank
  - Pre-llena el chat con: "Lanzar campaña usando este copy: [copy]"

---

### 1.4 — Audience Insights Visual

- [ ] **Breakdown visual de la audiencia configurada**
  - Después de que `audience_analyzer` corre, mostrar en el reasoning panel:
    - Lista de países con flags emoji y porcentaje estimado de distribución
    - Rango de edad como barra horizontal
    - Top 5 intereses como tags con el acento `#00D4A8`
    - Tamaño total de audiencia estimado con formato: "~180K personas"
  - Todo calculado desde el output del tool, sin llamadas adicionales

---

### 1.5 — Onboarding mejorado

- [ ] **Indicador de progreso del onboarding**
  - Barra de progreso visual que muestra el `confidence_score` como porcentaje
  - Texto: "Configurando tu marca... 65% completado"
  - Se actualiza con cada mensaje

- [ ] **Preview del brand_config generado**
  - Cuando el onboarding termina, mostrar el brand_config en formato legible (no YAML crudo)
  - Cards visuales: Público objetivo, Presupuesto, Tono, Canales
  - Botón "Editar" para cada sección (lanzar edición conversacional)

---

## SPRINT 2 — DIFERENCIADORES COMPETITIVOS

### 2.1 — Fatigue Detector

- [ ] Monitorear CTR de campañas activas cada 24h (si tenemos token de Meta)
- [ ] Si CTR cae >30% en 3 días consecutivos: generar alerta en el dashboard
- [ ] Alerta incluye sugerencia automática: "¿Querés que genere variaciones del copy?"
- [ ] Click en la sugerencia → abre el chat pre-llenado con el contexto de la campaña

### 2.2 — Performance Tracker real

- [ ] Conectar con Meta Graph API para leer métricas de campañas activas
- [ ] Endpoint `GET /campaigns/{id}/performance` que llama a Meta y devuelve: impresiones, clics, CTR, gasto real, leads, CPL real
- [ ] Card de performance en el detalle de cada campaña con métricas reales vs estimadas

### 2.3 — WhatsApp Weekly Report

- [ ] Cada lunes 9am, Adkio manda resumen por WhatsApp (Evolution API o Twilio)
- [ ] Mensaje incluye: campañas activas, gasto total de la semana, CPL promedio, una recomendación
- [ ] Configuración del número en el onboarding (campo adicional en brand_config)

### 2.4 — Campaign Memory + Learning

- [ ] Después de 3+ campañas, el agente incluye en su contexto el historial de la marca
- [ ] Sistema de RAG básico: embeddings de los copies que mejor funcionaron + los rationales de audience_analyzer
- [ ] El copy_generator mejora sus sugerencias basándose en qué funcionó antes para esa marca
- [ ] Implementar con pgvector en Supabase

---

## SPRINT 3 — PRODUCCIÓN REAL

### 3.1 — Meta OAuth SSO

- [ ] Implementar OAuth 2.0 con Meta para obtener `access_token` del cliente
- [ ] Permisos: `ads_management`, `ads_read`, `business_management`
- [ ] Guardar token encriptado en Supabase por usuario
- [ ] Botón "Conectar Meta Ads" en el onboarding y en settings
- [ ] Pasar por el proceso de verificación de app con Meta (video + documentación)

### 3.2 — Multi-tenant + Auth

- [ ] Auth con Supabase Auth (email/password + magic link)
- [ ] Row Level Security en todas las tablas: cada usuario solo ve sus datos
- [ ] Cada usuario tiene su propio brand_config, campaigns, copy_bank
- [ ] Roles: admin (ve todo), member (ve solo sus campañas)

### 3.3 — Stripe + Planes

- [ ] Integración con Stripe para los 3 planes: Starter $99, Growth $249, Scale $599
- [ ] Free trial de 14 días real — al terminar, bloquear el campaign launcher y mostrar upgrade
- [ ] Webhook de Stripe para activar/desactivar acceso según status de suscripción
- [ ] Portal de billing donde el cliente puede cambiar de plan o cancelar

### 3.4 — Dominio y producción

- [ ] Configurar dominio propio (adkio.app o similar)
- [ ] SSL automático
- [ ] Variables de entorno separadas para dev/staging/production
- [ ] Monitoring básico: Sentry para errores, uptime check

### 3.5 — Multi-canal

- [ ] TikTok Ads API — mismo agente, mismo brand_config, lanzar en TikTok
- [ ] LinkedIn Ads API — para verticales B2B
- [ ] El usuario elige el canal en el chat: "Lanzar en Instagram" vs "Lanzar en TikTok"

---

## SPRINT 4 — MOAT Y ESCALABILIDAD

- [ ] **A/B Testing automático** — lanzar 2 versiones del copy, pausar el perdedor a los 3 días
- [ ] **Competitor Ad Spy** — integrar Meta Ad Library para inspiración de copy por nicho
- [ ] **Vertical Knowledge Base** — benchmarks por industria y país, base de datos de intereses que convierten
- [ ] **CRM Integration** — leads de formularios de Meta → HubSpot/Pipedrive automático vía webhook
- [ ] **Campaign Memory avanzado** — el agente recuerda el historial completo y mejora con cada campaña
- [ ] **API pública** — para que agencias integren Adkio en sus propios workflows

---

## Decisiones de arquitectura pendientes

- [ ] **Redis** para rate limiting en producción (más robusto que en memoria)
- [ ] **pgvector** en Supabase para el sistema de RAG del Sprint 2
- [ ] **Background jobs** (APScheduler o Celery) para Fatigue Detector y WhatsApp Report
- [ ] **CDN** para assets estáticos del frontend

---

## Log de cambios del backlog

```
10 May 2026 — v1.0 — Backlog inicial creado post-hackathon
  Sprint 0: seguridad crítica, estrategia post-lanzamiento, refactor dashboard, CRUD Supabase
  Sprint 1: funcionalidades que suman para demo y primeros clientes
  Sprint 2: diferenciadores vs competidores
  Sprint 3: producción real, pagos, multi-tenant
  Sprint 4: moat y escalabilidad
```