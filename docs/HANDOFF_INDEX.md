# Handoff index — empezar acá

> Si sos Claude del equipo retomando este repo, **leé este archivo primero**.
> Es el mapa de qué está hecho, qué falta, qué documentos relevantes existen,
> y en qué orden conviene leerlos.
>
> Si sos humano del equipo: ídem.

---

## Estado en 1 párrafo

Adkio es un prototipo de AI agent para Meta/TikTok/Google Ads construido en
el GTM Hackathon Bogotá. En 36-48 horas se armó: landing, dashboard,
agente con 5 tools y streaming SSE, multitenant con auth propio + JWT,
cifrado Fernet de tokens, OAuth flows (pendientes de App Review), API key
manual flow funcionando, y CPL dinámico por contexto. **Falta para producción
real**: email verification, password reset, App Review de los providers,
calidad de campañas (variantes de copy, A/B, pixel tracking), observability.
Detalles en `PRODUCT_STATE_ASSESSMENT.md`.

---

## Orden de lectura recomendado

1. **`PRODUCT_STATE_ASSESSMENT.md`** ← empezar acá si querés entender el estado
   real del producto sin endulzar. Cubre qué pasa si un usuario real lo prueba,
   experiencia de jurado vs marketer, riesgos, y roadmap a alfa privada.

2. **`AUDIT_PRODUCT.md`** ← lista detallada de las 12 incoherencias técnicas
   detectadas y cuáles ya se arreglaron en `feat/auth-flow-integration`.

3. **`HANDOFF_MULTITENANT_DONE.md`** ← qué quedó implementado del brief
   original de Andrew (T1-T8): auth, accounts, platform_connections, Fernet,
   DBCredentialResolver, middleware, OAuth flows, Settings.

4. **`HANDOFF_AUTH_FLOW_INTEGRATION.md`** ← qué hace específicamente la rama
   `feat/auth-flow-integration`: integra el multitenant con el flujo real del
   usuario (landing → login → dashboard con drawer → /app con platform selector).

5. **`HANDOFF_MULTITENANT.md`** ← el brief ORIGINAL que escribió Andrew para
   Freddy. Útil para entender la intención de diseño detrás del multitenant.

6. **`PLAN_MULTI_CHANNEL.md`** ← plan de cómo se integran Meta CLI, TikTok y
   Google Ads. Tiene contexto histórico de las decisiones de arquitectura.

7. **`SETUP_API_KEYS.md`** ← guía paso a paso para sacar credenciales de Meta,
   TikTok, Google Ads en modo test/sandbox. Imprescindible para probar
   end-to-end.

8. **`backlog.md`** (raíz del repo) ← backlog sprints 0-4 con checkboxes.
   Lo que está hecho vs pendiente.

9. **`CLAUDE.md`** (raíz del repo) ← contexto general, stack, decisiones
   técnicas. Lo escribió Freddy al inicio del hackathon.

---

## Ramas relevantes

| Rama | Estado | Contenido |
|---|---|---|
| `main` | mergeable | Multichannel adapters (Andrew) + post-launch UI + security + landing/dashboard polish |
| `feat/multitenant` | mergeable, **NO mergeada** | T1-T8 multitenant base. Schema + auth + crypto + middleware + OAuth + Settings UI inicial |
| `feat/auth-flow-integration` | mergeable, **NO mergeada** | Auth flow real (landing → /signup → /dashboard → drawer), platform selector, CPL dinámico, dashboard incoherencias arregladas, password confirm, audit doc |

**Orden de merge sugerido**: `feat/multitenant` → `main`, después
`feat/auth-flow-integration` → `main`. Si mergeás `auth-flow-integration`
solo, también va a funcionar porque está rebased sobre multitenant
(carga todo el código necesario).

---

## Migraciones SQL pendientes

Si la DB Supabase está limpia, correr **en orden** los archivos de
`backend/db/migrations/`:

1. `001_multitenant.sql` — `accounts` + `platform_connections` + RLS
2. `002_campaigns_account_id.sql` — agrega `account_id` a campaigns (multitenant aisla)
3. `003_campaign_metadata.sql` — agrega `platform`, `cpl_min_usd`, `cpl_max_usd`, `is_mock`

Si la DB ya tenía datos del demo previo: `001` y `002` están aplicadas.
**Pegar `003` después de mergear `feat/auth-flow-integration`** o si no, el
backend va a tirar error al hacer INSERT en `campaigns` con esas columnas
nuevas (la query falla con "column does not exist").

---

## Variables de entorno críticas

Ver `.env.example` para la lista completa. Las que más importan:

| Var | Para qué | Cómo obtener |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | DB | Supabase project Settings → API |
| `JWT_SECRET` | Firmar JWTs | `openssl rand -hex 32` |
| `PLATFORM_TOKENS_ENC_KEY` | Cifrar tokens de plataforma | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ADKIO_REQUIRE_AUTH` | `true` = JWT obligatorio. `false` = permisivo (default, preserva demo) | Manual |
| `LLM_MODEL` + `GEMINI_API_KEY` | El cerebro del agente | aistudio.google.com |
| `META_*` | Credenciales globales single-tenant (fallback si no hay JWT) | Ver `SETUP_API_KEYS.md` |

---

## Cosas críticas para Claude del equipo al retomar

1. **No tocar `backend/integrations/*` ni `backend/tools/*` sin coordinarlo
   con Andrew.** Esos son sus archivos y tienen tests. La regla del handoff
   original: separación core (Andrew) vs tenancy (Freddy).

   Excepción: `campaign_launcher.py` y `campaign_remover.py` tuvieron 1 línea
   cada uno cambiada para usar `get_default_resolver()` en lugar de
   `EnvCredentialResolver()` directo. Ese cambio NO afecta los tests (mismo
   Protocol, mismo comportamiento default).

2. **El `platform_recommender` ya respeta `platform_hint` del usuario** vía
   override determinístico en `run_campaign_agent`. Si extendés el agente,
   preservá ese hook (línea ~330 de `campaign_agent.py`).

3. **Modo permisivo del middleware (`ADKIO_REQUIRE_AUTH=false`) es el default**
   porque el demo single-tenant tiene que seguir funcionando. Flipar a `true`
   solo cuando el frontend obligue login en todos lados (hoy `/dashboard` y
   `/app` toleran sesión vacía).

4. **El `developer_token` de Google Ads es de Adkio**, no del usuario. Vive
   en `ADKIO_GOOGLE_ADS_DEVELOPER_TOKEN`. El usuario solo aporta refresh_token
   + customer_id.

5. **Meta SDK no es thread-safe** (gotcha documentado por Andrew). Para MVP
   con pocos usuarios concurrentes funciona. Cuando llegue tracción, serializar
   con un lock global o reemplazar SDK por HTTP directo.

6. **TikTok no permite hard-delete**, solo soft-disable. El frontend debe ser
   honesto: "Eliminar (desactiva en TikTok)" en lugar de "Eliminar".

---

## Lo que NO está hecho (priorizado)

Sprint A — Auth/trust mínimo para abrir el link:
- Email verification con Resend
- Forgot password + reset
- Banner BETA permanente
- Privacy Policy real (no lorem ipsum)
- Sentry / Logsnag

Sprint B — Calidad de campaña:
- 3 variantes de copy en lugar de 1
- Mapping de intereses string → `interest_id` de Meta
- Selector de ad account (cuando user tiene varios)
- Pixel config en onboarding

Sprint C — Trámites:
- App Review Meta (~2 sem)
- Google Ads Basic Access (~2 sem)
- TikTok sandbox aprobado (~5 d)

Sprint D — Post-launch UX:
- `GET /campaigns/{id}/performance` con métricas reales de Meta Graph API
- Dashboard "Performance" con datos vivos
- Recomendaciones automáticas si CPL real diverge del estimado

Detalle completo en `PRODUCT_STATE_ASSESSMENT.md` sección 8.

---

## Contacto para dudas

- Andrew (`@Andss-ye` en GitHub) — owner del core multichannel
  (`backend/integrations/`, `backend/tools/`, `backend/agents/campaign_agent.py`)
- Freddy (`@FreddyB200`) — owner del multitenant + auth + UX integration
  (todo lo demás)

Si tu Claude propone tocar `backend/integrations/*` sin coordinar con Andrew,
**decile que NO y que avise primero**.
