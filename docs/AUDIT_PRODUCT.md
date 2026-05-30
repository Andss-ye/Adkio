# Audit de producto — Adkio MVP

> Estado al **16 may 2026**, después de feat/multitenant + feat/auth-flow-integration.
>
> Esto es lo que **realmente** funciona, lo que es smoke, y lo que falta
> para que un usuario final no detecte que estamos a medias. Sin endulzar.

---

## 🟢 Lo que SÍ funciona

| Feature | Estado | Notas |
|---|---|---|
| Signup / Login / Refresh JWT | ✅ End-to-end OK | Tabla `accounts` con bcrypt + JWT HS256 |
| `/auth/me` y middleware tenant | ✅ OK | `ADKIO_REQUIRE_AUTH=true` activa modo estricto |
| Crear campaña con LLM (Gemini 2.5) | ✅ OK | SSE streaming, tool calls reales |
| Persistir campaña en Supabase | ✅ OK | Con account_id ahora (migración 002) |
| Listar campañas del usuario | ✅ OK | Filtrado por JWT account_id |
| Manual API key flow | ✅ OK | `POST /connect/{platform}/manual`, cifrado Fernet |
| Platform hint en `/campaign` | ✅ OK | Usuario fuerza Meta/TikTok/Google desde la UI |
| Adapter Meta (single-tenant via env) | ✅ OK | Crea campañas reales en PAUSED |
| Settings drawer dentro del dashboard | ✅ OK | Slide-over con tabs Conexiones/Cuenta |

---

## 🟡 Lo que está implementado pero NO funciona end-to-end

### 1. OAuth Meta / TikTok / Google

**Estado**: endpoints existen, frontend los llama, pero falla porque:

- **Meta**: requiere App Review (`ads_management`, `pages_manage_ads`) — ~2 semanas con Business Verification
- **TikTok**: requiere App Review — ~3-5 días hábiles
- **Google Ads**: requiere Developer Token aprobado (Basic/Standard access) — ~2 semanas

**Sin esos approvals**, hacer click en "Conectar Meta" en `/dashboard?panel=settings`:

1. Redirige a `https://www.facebook.com/v20.0/dialog/oauth?...` correctamente
2. Meta dice "App no verificada" o pide al usuario aceptar permisos en modo dev
3. Callback regresa pero solo funciona con ad accounts agregados manualmente como testers

**Mitigación actual**: el botón **"↓ Conectar con API key manual"** abre un form
para pegar el `access_token` + `provider_account_id` directo desde Graph
Explorer / TikTok Sandbox / Google `generate_user_credentials.py`. Eso
**sí funciona hoy** sin esperar approvals.

**Bloqueador para producción real**: alguien del equipo tiene que iniciar
los 3 trámites de App Review en paralelo. Calendario realista: aprobado
todo en ~2-3 semanas si arrancamos hoy.

**Action items para desbloquear**:
- [ ] Crear Privacy Policy URL pública (`/privacidad` ya existe — ¿tiene
      contenido real o lorem ipsum?)
- [ ] Business verification de Meta (documentos legales de la empresa)
- [ ] Video demo de cómo Adkio usa cada permiso (3-5 min, mandatory para Meta)
- [ ] App in production en Meta Developer Console
- [ ] Solicitar Basic Access en Google Ads API Center
- [ ] Solicitar acceso a sandbox de TikTok for Business

---

### 2. Adapters TikTok y Google Ads

**Estado**: el código de los adapters existe en `backend/integrations/`
(lo escribió Andrew). Pero:

- **TikTok**: requiere `app_id` + `app_secret` + `access_token` válidos. Sin esos,
  cae a mock. Hoy `.env` no los tiene.
- **Google Ads**: requiere `developer_token` + `client_id` + `refresh_token`.
  El `developer_token` "test" se consigue al toque, pero solo opera contra
  cuentas marcadas como Test Account en MCC.

**Mitigación**: el agente cae a `_launch_mock(...)` cuando el resolver no
encuentra credenciales. El frontend no distingue visualmente — desde la
UI parece que se lanzó la campaña pero en realidad nunca tocó la API.

**Fix recomendado**: el SSE event `tool_result` para `campaign_launcher`
debe incluir `is_mock: true/false`, y el `CampaignPreview` debe mostrar
banner si está en mock (similar a como `AppPage` muestra "modo demo" si
backend está offline).

---

### 3. Email verification + password reset

**Estado**: **no existe**. Signup acepta cualquier email sin verificar.

**Implicaciones de seguridad**:
- Cualquiera puede crear cuentas con email fake
- No hay forma de recuperar password si lo olvidás
- Si alguien te roba el password, no podés expirarlo via email

**Lo mínimo para producción**:
1. Tabla `email_verifications(token, account_id, expires_at, used_at)`
2. Setup de Resend / SendGrid / Postmark (no SMTP raw — bounce rate alto)
3. `POST /auth/verify-email` que consume el token y marca `accounts.email_verified_at`
4. `POST /auth/forgot-password` y `POST /auth/reset-password`
5. Frontend: pantalla "Revisá tu email" después del signup, con resend button

**Estimación**: 4-6 horas si elegimos Resend (más simple). El cron de reenvío
y rate limiting llevan un par más.

**Para esta sesión, dejo**:
- Tabla `email_verifications` en migración 003 (sin SMTP setup)
- Campo `email_verified_at` en accounts (nullable, default NULL)
- Backend listo para emitir tokens pero NO los envía hasta que pongas la SMTP key

---

## 🔴 Incoherencias de producto detectadas

### 4. CPL hardcoded en 6 lugares

**Síntoma**: cualquier campaña, en cualquier país, con cualquier objetivo,
muestra "CPL estimado: $8–25 USD".

**Fuente**:
- `backend/tools/campaign_launcher.py:30` → `_CPL_BENCHMARK_LATAM_EDU = 15.0`
- `frontend/src/components/app/CampaignPreview.tsx:14` → constants
- `frontend/src/components/dashboard/StatsBar.tsx:20` → `'$8–25 USD'`
- `frontend/src/components/dashboard/CampaignDetail.tsx:159` → `'$8–25 USD'`
- `frontend/src/pages/DashboardPage.tsx:48` → `'$8–25 USD'`

**Realidad de mercado** (orden de magnitud):
- Lead B2B founder LATAM: $30-80 USD
- Lead estudiante e-commerce: $2-8 USD
- Lead seguro de auto: $15-40 USD
- Installs app gaming: $0.40-1.50 USD

**Fix de esta sesión**: backend calcula rango basado en plataforma, países,
edad mínima, y un coeficiente por tipo de objetivo. Lo devuelve en
`campaign_result.kpis.cpl_min_usd` / `cpl_max_usd`. Frontend lo lee.

---

### 5. Dashboard "Sincronizado con Meta" siempre verde

**Síntoma**: el indicador del top bar dice "Sincronizado con Meta" con
dot verde animado independientemente de si el usuario tiene Meta conectado.

**Fix**: leer `/connect/status` y mostrar:
- 0 conectadas → "Sin plataformas · Conectar" (link al drawer)
- 1+ conectadas → "Conectado: Meta" / "Conectado: Meta + TikTok"

---

### 6. `platform: 'Meta'` hardcoded en mapBackendCampaign

**Síntoma**: `DashboardPage.tsx:39` siempre marca cada campaña como Meta,
aunque el `campaign_launcher` la haya creado en TikTok.

**Fix**: agregar columna `platform` a la tabla campaigns; `create_campaign_result`
ya recibe `platform` desde `approve_and_launch`. Solo hay que persistirlo
y leerlo en el frontend.

---

### 7. StatsBar "Canal: Meta Ads" siempre

**Síntoma**: el chip en la barra superior del dashboard dice Meta Ads aunque
no haya ninguna campaña en Meta.

**Fix**: contar las plataformas únicas en `campaigns`, mostrar la lista.

---

### 8. relTime solo muestra HH:MM (pierde día)

**Síntoma**: campaña creada hace 3 días aparece como "14:30" en la lista —
indistinguible de una de hoy a esa hora.

**Fix**: `formatRelativeDate(created_at)` con lógica:
- < 1h → "hace N min"
- < 24h → "hace N h"
- < 7d → "hace N días"
- > 7d → "12 may"

---

### 9. Landing "Probá Adkio gratis" lleva a `/dashboard` sin login

**Síntoma**: Hero + FinalCTA tienen `<AppleButton href="/dashboard">` directo.
Bypassea todo el flujo de signup. El multitenant queda inutilizado para esos
usuarios.

**Fix**: si `isLoggedIn() === true` → `/dashboard`, else → `/signup`.

---

### 10. Signup sin confirmación de contraseña

**Síntoma**: una sola input "Contraseña" → typo en el password = cuenta inaccesible
(porque no hay reset).

**Fix**: 2do campo "Confirmar contraseña" con validación de match antes del submit.

---

### 11. Sidebar dice "campaña · Meta Ads"

`frontend/src/components/dashboard/Sidebar.tsx:126`. Mismo issue que StatsBar — hardcoded.

---

### 12. Mock launch sin indicar al usuario

Si el usuario no tiene credenciales conectadas (Meta/TikTok/Google) y le da
"Aprobar y lanzar", el `campaign_launcher` cae a `_launch_mock(...)` y devuelve
un `campaign_id` con formato `act_demo_XXXX`. El frontend no distingue — muestra
"Campaña creada" con el ID. El usuario cree que lanzó algo cuando no.

**Fix**: el `campaign_result` debe incluir `is_mock: bool` y la UI muestra
banner amarillo "Esta campaña no está en Meta — conectá una cuenta para lanzar de verdad".

---

## 📊 Resumen de prioridades

### Fix en esta sesión (alto impacto, código solamente)
- [x] Audit doc (este archivo)
- [ ] CPL dinámico backend + frontend
- [ ] Dashboard: platform real, sincronización real, StatsBar dinámico, relTime
- [ ] Landing CTAs respetan auth
- [ ] Password confirmation en signup
- [ ] is_mock flag en campaign_launcher + UI banner
- [ ] Scaffold email_verifications table (sin SMTP envío)

### Necesita trabajo de infra externa (no se puede en una sesión)
- [ ] Meta App Review (~2 semanas)
- [ ] TikTok App Review (~5 días)
- [ ] Google Ads Basic Access (~2 semanas)
- [ ] Privacy Policy con contenido real (legal)
- [ ] Business verification de la empresa con Meta
- [ ] Video demo de uso de cada permiso
- [ ] Setup de Resend/Postmark para emails (cuenta + dominio verificado)
- [ ] DNS / SPF / DKIM para deliverability de email

### Nice to have (sprint próximo)
- [ ] 2FA con TOTP
- [ ] Audit log de quién hizo qué (campaigns, connections)
- [ ] Rate limit por account_id, no solo por IP
- [ ] Forgot password con magic link
- [ ] Resend email verification
- [ ] Account settings (cambiar password, email, eliminar cuenta)
- [ ] Billing real con Stripe (hoy `plan` es solo cosmético)
