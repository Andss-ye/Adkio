# Handoff #1 — Multitenant base (T1-T8) ✅ MERGED

> Estado: en la rama `feat/multitenant` (mergeable a main). Implementa el plan
> completo del `docs/HANDOFF_MULTITENANT.md` que escribió Andrew para el resto
> del equipo. No requiere review desde cero — esto es el reporte de lo que ya
> está hecho y listo para usar.

---

## TL;DR

Cualquier endpoint de Adkio acepta ahora un **JWT con `account_id` en el payload**
y resuelve credenciales de plataforma desde la tabla `platform_connections` en
Supabase, encriptadas con Fernet. Se preservó el modo single-tenant para que el
demo siga funcionando sin login (controlado por `ADKIO_REQUIRE_AUTH`).

**Switch single-tenant → multitenant en producción:** setear `ADKIO_REQUIRE_AUTH=true`.

---

## Lo que está implementado y testeado end-to-end

### Backend

| Path | Método | Auth | Devuelve |
|---|---|---|---|
| `/auth/signup` | POST | público | `{access_token, refresh_token, account}` |
| `/auth/login` | POST | público | `{access_token, refresh_token, account}` |
| `/auth/refresh` | POST | público | `{access_token, refresh_token, account}` |
| `/auth/me` | GET | Bearer | `{id, email, plan, created_at, last_login_at}` |
| `/connect/status` | GET | Bearer | `{connections: [...]}` |
| `/connect/{platform}` | GET | Bearer | `{authorize_url}` |
| `/connect/{platform}/callback` | GET | público | redirect a frontend |
| `/connect/{platform}` | DELETE | Bearer | `{deleted, platform}` |
| `/connect/{platform}/manual` | POST | Bearer | `{ok, platform, provider_account_id}` |
| `/connect/google_ads/customer` | POST | Bearer | `{customer_id, ok}` |

### Tablas Supabase (ya creadas)

- `accounts` — id UUID, email UNIQUE, password_hash (bcrypt), plan, timestamps
- `platform_connections` — UNIQUE(adkio_account_id, platform), tokens cifrados, extra_jsonb
- RLS activa en `platform_connections` (defensa en profundidad — el WHERE explícito
  en `DBCredentialResolver` es la protección real porque usamos service_role key)

### Crypto

- `backend/security/token_crypto.py` — Fernet AES-128 con `PLATFORM_TOKENS_ENC_KEY`
- Tests round-trip OK · falla limpia si key falta o ciphertext es inválido

### Resolver wiring

- `DBCredentialResolver` agregado a `backend/services/credential_resolver.py` —
  cumple el Protocol `CredentialResolver` que define Andrew, no toca su core
- `ContextVar` `_current_resolver` permite inyección sin modificar agent ni tools
- `backend/tools/campaign_launcher.py` y `campaign_remover.py` — **1 línea cambiada**
  cada uno: `resolver = resolver or get_default_resolver()` (en vez de `EnvCredentialResolver()`)
- Middleware setea el resolver multi-tenant cuando hay JWT válido; fallback a env

### Middleware

- `backend/middleware/tenant.py`
- `ADKIO_REQUIRE_AUTH=false` (default): permisivo — sin JWT, request pasa y cae a `EnvCredentialResolver`
- `ADKIO_REQUIRE_AUTH=true`: estricto — 401 si falta o es inválido el Bearer
- Rutas públicas: `/health`, `/auth/signup|login|refresh`, `/docs`, `*/callback`

### Frontend

- `frontend/src/lib/auth.ts` — signup/login/refresh, tokens en localStorage
- `frontend/src/lib/api.ts` — `apiFetch()` inyecta `Authorization: Bearer` y `X-API-Key`
- `frontend/src/pages/AuthPage.tsx` — pantalla `/login` y `/signup` (split layout)
- `frontend/src/components/dashboard/SettingsDrawer.tsx` — panel slide-over dentro
  del dashboard, con tabs Conexiones / Cuenta
- `frontend/src/components/dashboard/UserMenu.tsx` — dropdown con email + Settings + Logout
- `frontend/src/components/settings/ConnectionCard.tsx` — tarjeta por plataforma
  con SVG oficial, estado conectado/desconectado, accent stripe, scopes

---

## Cómo usar (smoke test desde cero)

```bash
# 1. Crear cuenta
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@empresa.com","password":"hackaton123"}'
# → guarda access_token

# 2. Conectar Meta con API key manual (cuando OAuth aún no está aprobado)
TOKEN="<el access_token de arriba>"
curl -X POST http://localhost:8000/connect/meta/manual \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "EAARealMetaAccessTokenFromGraphExplorer...",
    "provider_account_id": "269458954399128",
    "extra": {"page_id": "1029511980255910"}
  }'

# 3. Lanzar campaña — el agente usará tus credenciales automáticamente
curl -X POST http://localhost:8000/campaign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_prompt":"Llenar evento Bogotá 15jun $200 ejecutivos"}'
```

---

## Variables de entorno necesarias

```bash
# Auth
JWT_SECRET=                          # openssl rand -hex 32
ACCESS_TOKEN_TTL_MINUTES=60          # opcional, default 60
REFRESH_TOKEN_TTL_DAYS=30            # opcional, default 30

# Crypto de tokens de plataforma
PLATFORM_TOKENS_ENC_KEY=             # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Modo
ADKIO_REQUIRE_AUTH=false             # true = obliga JWT en todos los endpoints

# OAuth providers
META_APP_ID=...                      # ya existía
META_APP_SECRET=...                  # ya existía
META_OAUTH_REDIRECT_URI=http://localhost:8000/connect/meta/callback
TIKTOK_APP_ID=
TIKTOK_APP_SECRET=
TIKTOK_OAUTH_REDIRECT_URI=http://localhost:8000/connect/tiktok/callback
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/connect/google_ads/callback
ADKIO_GOOGLE_ADS_DEVELOPER_TOKEN=    # de Adkio, no del usuario

FRONTEND_AFTER_OAUTH_URL=http://localhost:5173/dashboard?panel=settings
```

---

## Notas para el equipo

1. **Bcrypt 5 + passlib 1.7.4** son incompatibles (bug conocido). Usamos
   `bcrypt` directo en `backend/auth/passwords.py` — no agregar passlib de vuelta.

2. **email-validator** se agrega a `pydantic[email]` en requirements.txt. Sin él
   el campo `EmailStr` no carga.

3. El `developer_token` de Google Ads es de **Adkio** (env var), no del usuario.
   El usuario solo aporta refresh_token + customer_id. Documentado en el resolver.

4. **Meta SDK no es thread-safe** — `FacebookAdsApi.init()` setea una sesión global.
   Para MVP con pocos usuarios concurrentes funciona; cuando llegue tracción
   serializar requests a Meta con un lock global (ver gotcha 8.1 del handoff original).

5. **Manual API key** (`POST /connect/{platform}/manual`) es nuevo respecto al
   handoff original. Es el camino de menor fricción cuando OAuth todavía no
   está aprobado por el provider (Meta App Review tarda ~2 semanas).
