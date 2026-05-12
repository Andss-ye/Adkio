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
| `fix/scroll-and-mock-data` | ✅ mergeado | Scroll dashboard+/app, eliminar mocks, skeleton loading |
| `feat/dashboard-refactor` | ✅ mergeado | Refactor DashboardPage, StatsBar, InstagramAdPreview, CPL honesto |
| `feat/post-launch-ui` | ✅ mergeado | UI estado honesto post-aprobación, Meta SSO coming soon, GTM badge |
| `feat/security-sprint0` | ✅ mergeado | Rate limiting, CORS, API key, sanitización, token caps, DELETE /campaigns |
| `fix/app-ux-improvements` | 🔲 pendiente | Post-launch UX fixes (ver Sprint 0.2 revisado abajo) |
| `fix/dashboard-buttons` | 🔲 pendiente | Botones Refinar/Duplicar/Reanudar en dashboard |
| `fix/landing-sponsors` | 🔲 pendiente | Logos sponsors más grandes, Inboxes altura vertical |

---

## SPRINT 0 — INMEDIATO

### 0.1 — Seguridad ✅ COMPLETO

- [x] **Rate limiting** — slowapi in-memory: /campaign 10/min, /onboarding 20/min, público 30/min
- [x] **Validación estricta de inputs** — Pydantic v2: max length, control chars, regex en IDs
- [x] **Protección contra prompt injection** — regex guard antes de pasar al LLM (400 si detecta)
- [x] **Variables de entorno — auditoría** — startup check, exit en production si faltan vars críticas
- [x] **CORS configurado** — `ALLOWED_ORIGINS` env var (default: localhost only)
- [x] **API Key para endpoints LLM** — `X-API-Key` header + `ADKIO_API_KEY` env var
- [x] **Límite de tokens por request** — `max_tokens`: 2000 campaign agent, 500 onboarding; logging de uso
- [x] **Headers de seguridad HTTP** — X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS
- [x] **No exponer stack traces** — generic 500 handler, detalles solo en server logs
- [x] **Frontend api.ts** — todas las llamadas al backend pasan por `apiFetch()` con X-API-Key

---

### 0.2 — Post-launch UX fixes (PENDIENTE — trabajar mañana)

- [ ] **Clarificar mensaje de verificación Meta en /app**
  - El texto actual puede parecer que el *usuario* espera 2-5 días — corregir para que quede claro que es **Adkio** (app nueva creada hace 1 día en el hackathon) quien espera la aprobación de Meta, no el usuario
  - Texto sugerido: *"Adkio está en proceso de verificación oficial con Meta (nuestra app fue creada hace 1 día en el GTM Hackathon). Mientras tanto, podés ver tu campaña funcionando en el sandbox."*
  - Agregar botón/link visible "Ver en sandbox" que muestre el screenshot de Meta Ads Manager

- [ ] **Campaign ID y próximos pasos no visibles por falta de espacio vertical**
  - En el estado post-lanzamiento, el campaign_id y la sección "Próximos pasos" quedan fuera de la pantalla
  - Fix: asegurar que el panel de CampaignPreview tenga scroll interno (`overflow-y-auto`) cuando el contenido supera la altura disponible
  - Verificar en pantallas de 768px y 1080px

- [ ] **Persistir campaña seleccionada al volver a /dashboard (SPA)**
  - Si el usuario navega a /app y vuelve al dashboard, la selección se pierde
  - Fix: guardar `selectedId` en `sessionStorage` al cambiar, restaurarlo al montar
  - No usar localStorage (se limpia entre sesiones de demo está bien)

---

### 0.3 — Refactorización Dashboard ✅ COMPLETO

- [x] Descomponer Dashboard.tsx en componentes (Sidebar, CampaignList, CampaignDetail, StatsBar, StatusBadge)
- [x] Eliminar todos los mock data — solo datos reales de Supabase
- [x] Skeleton loading mientras carga (sin flash de mocks)
- [x] Scroll funcional en todas las secciones
- [x] CPL como rango honesto ($8–25 USD)
- [x] GTM Hackathon badge en sidebar

---

### 0.4 — Dashboard: botones funcionales (PENDIENTE — trabajar mañana)

- [ ] **Botón "Refinar" en CampaignDetail**
  - Al hacer click, navegar a `/app` pre-llenando el chat con: `"Refinar campaña: [nombre de campaña]. [prompt original]"`
  - Usar `sessionStorage.setItem('prefill_prompt', ...)` y que AppPage lo lea al montar

- [ ] **Botón "Duplicar" en CampaignDetail**
  - Al hacer click, navegar a `/app` pre-llenando con: `"Duplicar campaña para [canal/audiencia diferente]: [prompt original]"`
  - Mismo mecanismo que Refinar

- [ ] **Botón "Reanudar/Pausar" en CampaignDetail**
  - Toggle visual del status de la campaña (Activa ↔ Pausada)
  - Llamar `PATCH /campaigns/{id}/status` en el backend (endpoint a crear)
  - Actualizar el estado local en React sin recargar toda la lista

---

### 0.5 — Landing: fixes visuales (PENDIENTE — trabajar mañana)

- [ ] **Logos de sponsors más grandes en HackathonBadge**
  - Actualmente son muy pequeños — aumentar a `h-14` o `h-16`
  - Asegurar que tengan suficiente padding/margen entre ellos
  - Verificar que el filtro `brightness` los hace visibles sobre el fondo oscuro

- [ ] **Inboxes: más espacio vertical en el panel de detalle**
  - El preview de Instagram Ad queda cortado en la parte inferior
  - Aumentar `h-[640px]` a `h-[720px]` o hacer que el panel de detalle tenga `overflow-y-auto`
  - Verificar que en mobile el layout apilado se vea completo

---

## SPRINT 1 — FUNCIONALIDADES QUE SUMAN

### 1.1 — Campaign History Dashboard

- [ ] **Tabla de campañas históricas**
  - Columnas: Fecha, Prompt original, Canal, Presupuesto, CPL estimado, Alcance estimado, Status
  - Status con color: pending (gris), active (verde), paused (amarillo), failed (rojo)
  - Click en fila → detalle con reasoning panel completo
  - Paginación: 10 por página

- [ ] **Export a CSV**
  - Botón "Exportar" en el dashboard
  - CSV: todas las columnas + copy completo + audiencia
  - Endpoint `GET /campaigns/export/csv`
  - Frontend: blob download directo

---

### 1.2 — Ad Preview ✅ COMPLETO

- [x] **Mockup de Instagram Ad** — componente InstagramAdPreview con copy real del agente
- [x] **Preview en Inboxes (landing)** — reemplazó "Variantes creativas"
- [ ] **Mockup de Facebook Ad** — toggle Instagram / Facebook
- [ ] **Phone frame** — envolver el preview en un mockup de phone para más realismo

---

### 1.3 — Copy Bank UI

- [ ] Grid de cards: headline, body, CTA, fecha, campaña origen
- [ ] Botón estrella para favoritos
- [ ] Filtro: todos / favoritos / por canal
- [ ] "Usar en nueva campaña" pre-llena el chat

---

### 1.4 — Audience Insights Visual ✅ COMPLETO

- [x] **Breakdown visual en ToolCard para audience_analyzer**
  - Flags de países con emoji
  - Barra horizontal de rango de edad (escala 18–65, gradiente cyan)
  - Top 5 intereses como tags (#00D4A8)
  - Reach estimado en monospace

---

### 1.5 — Onboarding mejorado

- [ ] Barra de progreso visual con confidence_score
- [ ] Preview del brand_config generado en cards visuales (no YAML crudo)
- [ ] Botón "Editar" por sección → edición conversacional

---

## SPRINT 2 — DIFERENCIADORES COMPETITIVOS

### 2.1 — Fatigue Detector
- [ ] Monitorear CTR cada 24h (requiere token Meta real)
- [ ] Alerta si CTR cae >30% en 3 días — sugerencia automática de variaciones
- [ ] Click en sugerencia → chat pre-llenado con contexto de campaña

### 2.2 — Performance Tracker real
- [ ] Conectar Meta Graph API para métricas reales (impresiones, clics, CTR, gasto, leads, CPL real)
- [ ] Endpoint `GET /campaigns/{id}/performance`
- [ ] Card de performance: métricas reales vs estimadas

### 2.3 — WhatsApp Weekly Report
- [ ] Resumen semanal vía WhatsApp (Evolution API o Twilio)
- [ ] Contenido: campañas activas, gasto semana, CPL promedio, recomendación
- [ ] Número de WhatsApp en onboarding (campo extra en brand_config)

### 2.4 — Campaign Memory + Learning
- [ ] RAG básico: embeddings de copies exitosos + rationales de audience_analyzer
- [ ] copy_generator mejora con historial de la marca
- [ ] Implementar con pgvector en Supabase

---

## SPRINT 3 — PRODUCCIÓN REAL

### 3.1 — Meta OAuth SSO
- [ ] OAuth 2.0 con Meta: permisos ads_management, ads_read, business_management
- [ ] Token encriptado en Supabase por usuario
- [ ] Proceso de verificación oficial con Meta (video + docs)

### 3.2 — Multi-tenant + Auth
- [ ] Supabase Auth (email/password + magic link)
- [ ] Row Level Security en todas las tablas
- [ ] Roles: admin / member

### 3.3 — Stripe + Planes
- [ ] Starter $99 / Growth $249 / Scale $599
- [ ] Free trial 14 días real — bloquea campaign launcher al terminar
- [ ] Webhook Stripe para activar/desactivar acceso
- [ ] Portal de billing

### 3.4 — Dominio y producción
- [ ] Dominio propio (adkio.app o similar), SSL automático
- [ ] Vars separadas dev/staging/production
- [ ] Sentry + uptime check

### 3.5 — Multi-canal
- [ ] TikTok Ads API
- [ ] LinkedIn Ads API
- [ ] El usuario elige canal en el chat

---

## SPRINT 4 — MOAT Y ESCALABILIDAD

- [ ] **A/B Testing automático** — 2 versiones del copy, pausa el perdedor a los 3 días
- [ ] **Competitor Ad Spy** — Meta Ad Library para inspiración de copy por nicho
- [ ] **Vertical Knowledge Base** — benchmarks por industria y país
- [ ] **CRM Integration** — leads de Meta → HubSpot/Pipedrive vía webhook
- [ ] **Campaign Memory avanzado** — mejora con cada campaña de la marca
- [ ] **API pública** — para agencias que integran Adkio en sus workflows

---

## Decisiones de arquitectura pendientes

- [ ] **Redis** para rate limiting en producción
- [ ] **pgvector** en Supabase para RAG del Sprint 2
- [ ] **Background jobs** (APScheduler o Celery) para Fatigue Detector y WhatsApp Report
- [ ] **CDN** para assets estáticos del frontend
- [ ] **`PATCH /campaigns/{id}/status`** — endpoint para toggle Activa/Pausada (necesario para Sprint 0.4)

---

## Log de cambios del backlog

```
12 May 2026 — v2.0 — Actualización post-hackathon día 2
  Sprint 0.1 seguridad: COMPLETO (rate limiting, API key, prompt injection, CORS, token caps, headers)
  Sprint 0.2 post-launch UX: 3 fixes pendientes para mañana
    - Clarificar mensaje Meta verification (es Adkio quien espera, no el usuario)
    - Campaign ID y próximos pasos fuera de pantalla (scroll fix)
    - Persistir selectedId en sessionStorage al navegar SPA
  Sprint 0.3 dashboard refactor: COMPLETO
  Sprint 0.4 botones dashboard: 3 botones a implementar (Refinar, Duplicar, Reanudar)
  Sprint 0.5 landing fixes: logos sponsors más grandes, Inboxes más altura
  Sprint 1.2 Ad Preview: COMPLETO (Instagram mockup)
  Sprint 1.4 Audience Insights: COMPLETO (flags + barra edad + intereses)

10 May 2026 — v1.0 — Backlog inicial creado post-hackathon
  Sprint 0: seguridad crítica, estrategia post-lanzamiento, refactor dashboard, CRUD Supabase
  Sprint 1: funcionalidades que suman para demo y primeros clientes
  Sprint 2: diferenciadores vs competidores
  Sprint 3: producción real, pagos, multi-tenant
  Sprint 4: moat y escalabilidad
```
