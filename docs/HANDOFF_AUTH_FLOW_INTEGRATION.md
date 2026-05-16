# Handoff #2 — Auth flow integration (UX completa)

> Estado: en la rama `feat/auth-flow-integration` (mergeable a main).
> Conecta el multitenant base (handoff #1) con el flujo de usuario real:
> landing → login → dashboard → settings drawer → campaña con plataforma elegida.
>
> **Antes de iterar**:
> - Leer **`HANDOFF_INDEX.md`** para el mapa completo de docs y orden de lectura.
> - Leer **`PRODUCT_STATE_ASSESSMENT.md`** para entender qué pasa si un usuario
>   real prueba la app hoy (jurado, marketer, riesgos, roadmap).
> - Leer **`AUDIT_PRODUCT.md`** para la lista de las 12 incoherencias detectadas
>   y cuáles ya se arreglaron acá.

---

## Por qué esta rama existe

El handoff #1 dejó el backend multitenant funcionando y una página `/settings`
standalone para conectar plataformas. Pero el flujo lógico de la app no llevaba
ahí — un usuario no llega a `/settings` tipeando la URL. La rama anterior se
saltó dashboard como pieza central.

Esta rama arregla eso. El flujo real ahora es:

1. **Landing** (`/`) — botones "Iniciar sesión" + "Empezar gratis" en el navbar
2. **/login** o **/signup** — pantalla de auth split-layout. Después del éxito → redirect a /dashboard
3. **Dashboard** (`/dashboard`) — top bar con UserMenu (avatar + email + dropdown)
4. **Settings drawer** — slide-over desde la derecha, NO una página separada.
   Se abre desde: sidebar "Conexiones", UserMenu "Conexiones y cuenta", o `?panel=settings`
5. **Crear campaña** (`/app`) — selector de chips "Auto / Meta / TikTok / Google"
   arriba del input. La elección se manda al backend como `platform_hint`

---

## Lo que cambia (mapa de archivos)

### Frontend

**Nuevo:**
- `frontend/src/pages/AuthPage.tsx` — `/login` y `/signup`, redirige a /dashboard
- `frontend/src/components/dashboard/SettingsDrawer.tsx` — panel slide-over con
  tabs (Conexiones | Cuenta), banner de éxito/error, form de API key manual
- `frontend/src/components/dashboard/UserMenu.tsx` — dropdown con avatar circular
  generado del email, ítems Settings / Nueva campaña / Logout

**Modificado:**
- `frontend/src/App.tsx` — agregadas rutas `/login`, `/signup`. `/settings`
  redirige a `/dashboard?panel=settings` por compat
- `frontend/src/components/landing/Navbar.tsx` — si `isLoggedIn()` muestra
  "Ir al dashboard" + Logout; si no, "Iniciar sesión" + "Empezar gratis"
- `frontend/src/pages/DashboardPage.tsx` — incluye `SettingsDrawer` controlado
  por `settingsOpen` state. Top bar usa `UserMenu`. Lee `?panel=settings` del URL
- `frontend/src/components/dashboard/Sidebar.tsx` — link "Conexiones" ahora
  ejecuta `onOpenSettings()` (no más `<a href="/settings">`)
- `frontend/src/components/app/ChatPanel.tsx` — chip row arriba del input con
  Auto / Meta / TikTok / Google. Pasa `platformHint` a `onSend`
- `frontend/src/hooks/useCampaignStream.ts` — `startStream` acepta `platformHint`
  y lo manda en el body del POST /campaign
- `frontend/src/pages/AppPage.tsx` — pasa `platformHint` desde ChatPanel al stream

**Eliminado:**
- `frontend/src/pages/SettingsPage.tsx` — reemplazada por SettingsDrawer dentro del dashboard

### Backend

**Modificado:**
- `backend/api/connections.py` — agregado `POST /connect/{platform}/manual` que
  acepta `{access_token, provider_account_id, refresh_token?, extra?}` y persiste
  cifrado en `platform_connections`. Valida formato de Google customer_id (10 dígitos)
  y prefija `act_` automáticamente para Meta si viene sin prefix.
- `backend/main.py` — `CampaignRequest` acepta opcional `platform_hint` con
  validador estricto (`meta | tiktok | google_ads | None`). Se pasa a
  `run_campaign_agent(..., platform_hint=...)`
- `backend/agents/campaign_agent.py` — `run_campaign_agent` acepta `platform_hint`.
  Si se da, agrega línea al user message para que el LLM lo sepa, y override
  determinístico del resultado de `platform_recommender` después de su dispatch.
  El override agrega `user_forced: true` y reescribe el rationale para que el
  frontend muestre claramente que fue el usuario quien forzó la elección.

---

## Endpoints y URLs

```
Landing
  /                                  Botones Login / Signup en navbar

Auth
  /login                             Pantalla split-layout
  /signup                            Misma pantalla, tab inicial "Crear cuenta"

Dashboard (la pieza central)
  /dashboard                         Workspace + Settings drawer
  /dashboard?panel=settings          Workspace con el drawer abierto

Compat
  /settings → 307 /dashboard?panel=settings

Campaign creation
  /app                               Chat + selector de plataforma (Auto/Meta/TikTok/Google)

API nueva
  POST /connect/{platform}/manual    {access_token, provider_account_id, refresh_token?, extra?}
  POST /campaign                     Acepta opcional platform_hint en el body
```

---

## Cómo usarlo (demo del flujo nuevo)

1. **Abrir `/`** → click "Empezar gratis" → `/signup`
2. **Crear cuenta** con email + password (mín 8 chars + letra + número)
3. Redirige a `/dashboard` → ya estás logueado, el UserMenu muestra tu email
4. **Click "Conexiones"** en el sidebar (o en el UserMenu) → abre el drawer
5. **Conectar Meta con API key manual:**
   - Click "↓ Conectar con API key manual" abajo del card de Meta
   - Pegá tu `access_token` del Graph API Explorer
   - Pegá tu `ad_account_id` (formato `act_XXX` o solo números)
   - Pegá tu `page_id` (opcional)
   - Click "Guardar credenciales"
6. **Crear campaña:** ir a `/app` → seleccionar chip "Meta" o dejar "Auto" →
   tipear prompt → enviar
7. El agente respeta tu elección de plataforma cuando se le forzó.

---

## Por qué API key manual existe

OAuth requiere App Review aprobado por cada provider:

| Provider | App Review |
|---|---|
| Meta | ~2 semanas + Business Verification |
| TikTok | ~3-5 días hábiles |
| Google Ads | ~2 semanas (Basic/Standard access) |

Pegar el access_token desde el Graph Explorer toma 30 segundos. Es la diferencia
entre "demo funciona hoy" y "demo funciona en 2 semanas". El backend lo trata
exactamente igual (mismo schema en `platform_connections`, mismo `DBCredentialResolver`),
solo cambia el camino de entrada del token.

`extra_jsonb.manual_entry = true` queda flagged para auditoría.

---

## Decisiones de UX

- **Drawer vs página standalone:** drawer mantiene contexto del dashboard
  (ves tus campañas detrás), no rompe la mental model.
- **Tabs Conexiones / Cuenta:** separamos billing/profile de integraciones.
  Cuenta tiene email + plan + account_id + botón rojo "Cerrar sesión".
- **Login y signup en URLs separadas:** SEO + previsibilidad (la gente espera
  poder buscar "adkio login" y caer en /login). Internamente comparten componente
  con un toggle.
- **Si abrís /login estando ya logged in:** redirect automático a /dashboard.
- **Si abrís el drawer sin login:** mostramos un "Login gate" con CTA a /login.
  El demo single-tenant sigue funcionando (las credenciales vienen de env).
- **Platform selector "Auto":** default. Adkio elige por scoring. Los otros
  3 chips fuerzan la elección y se ve en el reasoning panel
  ("Plataforma forzada por el usuario").

---

## Lo que no se hizo (queda en backlog)

- **Email verification** — signup no manda email de confirmación. Lo agregamos
  cuando integremos Resend / Postmark (probablemente Sprint 1).
- **Password reset / forgot** — no hay endpoint para resetear. Mientras tanto
  el usuario tiene que crear cuenta nueva.
- **Multi-cuenta por plataforma** — sigue siendo `UNIQUE(account_id, platform)`.
  Conectar Meta de nuevo reemplaza la fila anterior. Está documentado como
  límite del plan Starter/Growth.
- **OAuth completo testeado en producción** — la implementación está pero
  requiere providers aprobados para validar end-to-end con tokens reales.
  Por ahora el manual API key es la opción recomendada.

---

## Migración para el que merge

```bash
git checkout main
git merge feat/multitenant         # primero el handoff #1
git merge feat/auth-flow-integration  # esta rama
```

Sin conflictos esperados — esta rama es estrictamente aditiva sobre la #1.

Después del merge:

1. Verificar que `JWT_SECRET` y `PLATFORM_TOKENS_ENC_KEY` estén en Railway
2. Setear `FRONTEND_AFTER_OAUTH_URL=https://adkio.me/dashboard?panel=settings`
   en Railway (o el dominio real)
3. **No flipar `ADKIO_REQUIRE_AUTH=true` todavía** — esperar a tener email
   verification + reset password para no romper UX
4. Probar `/signup` desde el dominio real, conectar Meta con manual API key,
   lanzar una campaña de prueba
