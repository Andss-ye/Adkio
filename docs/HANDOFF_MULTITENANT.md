# Handoff Multitenant — Para Freddy y su Claude

> **Cómo usar este doc:** dáselo entero a tu Claude. Está escrito como brief para
> un Claude Code que arranca cold sin contexto del repo. Está estructurado en
> tareas atómicas (T1, T2, T3...) con criterios de aceptación claros.
>
> **Estado del repo cuando lo recibís:** rama `feature/multichannel` con el core
> multichannel implementado y testeado (98 tests pasando). El agente ya soporta
> Meta + TikTok + Google Ads en single-tenant via env vars. Tu trabajo es el
> multitenant — agregar la capa de tenancy sin tocar el core.

---

## TL;DR del handoff

- **No toques nada en `backend/integrations/` ni `backend/tools/`.** Esas son
  mi rama. Si las cambiás, vas a tener conflictos cuando integremos.
- Tu superficie: `backend/auth/`, `backend/middleware/`, `backend/api/connections.py`,
  un schema SQL en Supabase, y extender `backend/services/credential_resolver.py`
  con una clase nueva (`DBCredentialResolver`) **sin tocar la existente**.
- Cuando termines, el switch single-tenant → multitenant es UNA línea en
  `backend/main.py`: cambiar `EnvCredentialResolver()` por
  `DBCredentialResolver(account_id=request.state.account_id, ...)`.

---

## Contexto crítico (5 minutos de lectura)

### Qué hace Adkio
Agente de IA que ejecuta campañas de ads desde lenguaje natural. El usuario
escribe "quiero llenar mi evento en Bogotá", Adkio elige Meta / TikTok / Google,
configura todo, y deja PAUSED para que el usuario apruebe en el dashboard nativo
de la plataforma (Human-In-The-Loop).

### Cómo está organizado el core hoy (lo mío — read-only para vos)
```
backend/
├── integrations/
│   ├── base.py                    # Protocol PlatformAdapter + dataclasses
│   ├── credentials.py             # MetaCreds, TikTokCreds, GoogleAdsCreds
│   ├── meta_adapter.py            # facebook-business SDK
│   ├── tiktok_adapter.py          # REST directo (requests)
│   ├── google_ads_adapter.py      # google-ads SDK
│   └── adapter_registry.py        # get_adapter(platform) -> PlatformAdapter
├── services/
│   └── credential_resolver.py     # Protocol + EnvCredentialResolver (single-tenant)
├── tools/
│   ├── platform_recommender.py    # elige plataforma según objetivo/audiencia
│   ├── campaign_launcher.py       # crea campaña en la plataforma elegida
│   ├── campaign_remover.py        # elimina (hard-delete Meta/Google, soft TikTok)
│   └── ... (resto de tools)
└── agents/
    └── campaign_agent.py          # orquesta los tools en orden
```

**Contrato del core:** todos los tools y adapters reciben `resolver:
CredentialResolver` como parámetro inyectable. Si tu `DBCredentialResolver`
cumple el Protocol (`resolve(platform) -> Credentials | None`), todo el core
funciona sin tocarlo.

### Por qué este diseño
Decisión arquitectónica deliberada: **separar el "qué plataforma" del "qué cuenta"**.

- **Core (yo, mío):** sabe cómo hablarle a Meta / TikTok / Google. No sabe nada
  de cuentas ni usuarios. Recibe credenciales por parámetro.
- **Multitenant (vos):** sabe quién es el usuario y qué cuenta tiene conectada.
  Resuelve credenciales desde la DB y se las pasa al core.

Eso significa que vos podés trabajar en multitenant sin tocar mi código y yo
puedo cambiar implementaciones internas sin afectar tu trabajo.

---

## Tareas (en orden)

### T1 — Auth + tabla `accounts`

**Qué hacer:**
1. Diseñar la tabla `accounts` en Supabase (id, email, plan, created_at).
2. Implementar signup/login con JWT. Token debe incluir `account_id` en el payload.
3. Endpoints: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`.

**Stack sugerido:** Supabase Auth (built-in) + tu propia tabla `accounts` que
referencia `auth.users(id)`. NO uses una librería pesada como FastAPI-Users —
el equipo prefiere stack mínimo.

**Criterio de aceptación:**
- `curl -X POST /auth/login -d ...` devuelve un JWT.
- El JWT decodificado contiene `account_id` (UUID).
- Existe una fila en `accounts` por usuario registrado.

---

### T2 — Tabla `platform_connections` con RLS

**Qué hacer:** crear esta tabla en Supabase:

```sql
create table platform_connections (
    id uuid primary key default gen_random_uuid(),
    adkio_account_id uuid not null references accounts(id) on delete cascade,
    platform text not null check (platform in ('meta', 'tiktok', 'google_ads')),
    provider_account_id text not null,   -- act_XXX | advertiser_id | customer_id
    access_token_encrypted text not null,
    refresh_token_encrypted text,
    token_expires_at timestamptz,
    extra_jsonb jsonb default '{}',      -- page_id, login_customer_id, app_id, etc
    scopes text[] default '{}',
    connected_at timestamptz default now(),
    last_validated_at timestamptz,
    unique (adkio_account_id, platform)  -- 1 cuenta por plataforma por Adkio account
);

-- RLS obligatorio
alter table platform_connections enable row level security;

create policy "users see only their account's connections"
  on platform_connections for all
  using (adkio_account_id = (auth.jwt() ->> 'account_id')::uuid);
```

**Por qué `unique(adkio_account_id, platform)`:** decisión de producto. Cada
Adkio account conecta máximo 1 Meta + 1 TikTok + 1 Google Ads. Multi-cuenta
queda fuera del MVP (ver `docs/PLAN_MULTI_CHANNEL.md`).

**Por qué `extra_jsonb`:** cada plataforma tiene campos extra (page_id,
login_customer_id, app_id/secret) que no quiero meter como columnas para evitar
migrations. Mi `DBCredentialResolver` los lee de ahí.

**Criterio de aceptación:**
- Tabla creada en Supabase con la constraint y RLS activa.
- `select * from platform_connections` desde un cliente con JWT solo devuelve
  las filas del account_id del JWT (probarlo con dos cuentas distintas).

---

### T3 — Cifrado de tokens (Fernet)

**Qué hacer:** crear `backend/security/token_crypto.py` con dos funciones:

```python
from cryptography.fernet import Fernet
import os

def _fernet() -> Fernet:
    key = os.environ["PLATFORM_TOKENS_ENC_KEY"]
    return Fernet(key.encode())

def encrypt_token(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()

def decrypt_token(ciphered: str) -> str:
    return _fernet().decrypt(ciphered.encode()).decode()
```

Agregá a `.env.example`:
```bash
# Generar con: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
PLATFORM_TOKENS_ENC_KEY=
```

**Criterio de aceptación:**
- `decrypt_token(encrypt_token("hola")) == "hola"`.
- Si `PLATFORM_TOKENS_ENC_KEY` no está, falla con error claro al primer uso.

---

### T4 — `DBCredentialResolver` (DROP-IN para mi `EnvCredentialResolver`)

**Importante:** **agregalo al archivo existente** `backend/services/credential_resolver.py`,
**no lo crees en archivo nuevo**. Está pensado para convivir con `EnvCredentialResolver`.

**Esqueleto listo para que tu Claude lo complete:**

```python
# backend/services/credential_resolver.py — al final del archivo, no tocar lo existente

from backend.security.token_crypto import decrypt_token


class DBCredentialResolver:
    """Multitenant: lee credenciales de platform_connections en Supabase
    filtrando por account_id. Cumple el Protocol CredentialResolver — es
    drop-in para EnvCredentialResolver."""

    def __init__(self, account_id: str, supabase_client):
        self._account_id = account_id
        self._db = supabase_client

    def resolve(self, platform: str) -> Optional[PlatformCreds]:
        if platform not in _VALID_PLATFORMS:
            raise ValueError(f"plataforma inválida: {platform!r}")

        row = (
            self._db.table("platform_connections")
            .select("*")
            .eq("adkio_account_id", self._account_id)
            .eq("platform", platform)
            .single()
            .execute()
            .data
        )
        if not row:
            return None

        access_token = decrypt_token(row["access_token_encrypted"])
        extra = row.get("extra_jsonb") or {}

        if platform == "meta":
            return MetaCreds(
                app_id=extra.get("app_id", os.environ.get("META_APP_ID", "")),
                app_secret=extra.get("app_secret", os.environ.get("META_APP_SECRET", "")),
                access_token=access_token,
                ad_account_id=row["provider_account_id"],
                page_id=extra.get("page_id"),
            )
        if platform == "tiktok":
            return TikTokCreds(
                access_token=access_token,
                advertiser_id=row["provider_account_id"],
                app_id=extra.get("app_id"),
                app_secret=extra.get("app_secret"),
                sandbox=extra.get("sandbox", False),
            )
        if platform == "google_ads":
            refresh_token = decrypt_token(row["refresh_token_encrypted"]) if row.get("refresh_token_encrypted") else ""
            return GoogleAdsCreds(
                # developer_token es de Adkio (no del usuario) — viene de env
                developer_token=os.environ.get("ADKIO_GOOGLE_ADS_DEVELOPER_TOKEN", ""),
                client_id=extra.get("client_id", os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")),
                client_secret=extra.get("client_secret", os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")),
                refresh_token=refresh_token,
                customer_id=row["provider_account_id"],
                login_customer_id=extra.get("login_customer_id"),
            )
        return None
```

**Notas para tu Claude:**

- `app_id` y `app_secret` de Meta son globales de Adkio (nuestra app de Meta).
  Vienen de env, no del usuario. El usuario aporta `access_token` (su token de
  ads) y `ad_account_id`.
- Lo mismo con Google: `developer_token` es de Adkio (variable global), el usuario
  aporta `refresh_token` y `customer_id`.
- TikTok: `app_id` y `app_secret` también son de Adkio (nuestra app). El usuario
  aporta `access_token` y `advertiser_id`.
- Importá los tipos `MetaCreds`, `TikTokCreds`, `GoogleAdsCreds`, `PlatformCreds`,
  `_VALID_PLATFORMS` desde lo que ya está en el archivo. NO los redefinas.

**Tests:** crear `tests/services/test_db_credential_resolver.py` mockeando
`supabase_client`. Cubrir: cuenta sin conexión devuelve `None`, conexión válida
devuelve el dataclass correcto con tokens desencriptados, RLS no se testea acá
(eso es responsabilidad de Supabase).

**Criterio de aceptación:**
- `isinstance(DBCredentialResolver(...), CredentialResolver)` → True.
- Test que mockea Supabase, encripta un token, llama `resolve("meta")`, y verifica
  que devuelve un `MetaCreds` con el token desencriptado correcto.

---

### T5 — Middleware FastAPI para inyectar `account_id`

**Qué hacer:** crear `backend/middleware/tenant.py`:

```python
from fastapi import Request, HTTPException
from jose import jwt, JWTError
import os

JWT_SECRET = os.environ["JWT_SECRET"]

async def tenant_middleware(request: Request, call_next):
    # Saltar para endpoints públicos
    public_paths = ("/auth/login", "/auth/signup", "/auth/refresh", "/docs", "/openapi.json", "/health")
    if any(request.url.path.startswith(p) for p in public_paths):
        return await call_next(request)

    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")

    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
        request.state.account_id = payload["account_id"]
    except (JWTError, KeyError):
        raise HTTPException(401, "invalid token")

    return await call_next(request)
```

Registralo en `backend/main.py`:
```python
from backend.middleware.tenant import tenant_middleware
app.middleware("http")(tenant_middleware)
```

**Criterio de aceptación:**
- Request sin JWT a `/campaign` → 401.
- Request con JWT inválido → 401.
- Request con JWT válido → `request.state.account_id` está poblado y la request pasa.

---

### T6 — OAuth flows por plataforma

Tres endpoints, uno por plataforma. Estructura idéntica.

**T6.1 — `POST /connect/meta`**

Redirige a Facebook OAuth. Callback: `GET /connect/meta/callback?code=...`
1. Intercambia `code` por `access_token` (Graph API `/oauth/access_token`).
2. Intercambia el short-lived por long-lived (60 días).
3. Llama `GET /me/adaccounts` para obtener las cuentas disponibles.
4. Si el usuario tiene varias → modal de selección en frontend.
5. Encripta token, upsertea en `platform_connections` con
   `platform='meta'`, `provider_account_id=act_XXX`,
   `extra_jsonb={"page_id": "...", "app_id": "...", "app_secret": "..."}`.
6. Redirige al frontend con éxito.

Scopes Meta: `ads_management`, `ads_read`, `pages_manage_ads`, `pages_read_engagement`.

**T6.2 — `POST /connect/tiktok`**

Mismo patrón. Endpoint OAuth:
`https://business-api.tiktok.com/portal/auth?app_id=...&redirect_uri=...&state=...`.
Después del callback, llamada a
`POST /open_api/v1.3/oauth2/access_token/` con `auth_code`.

Scope: "Ads Management".

`provider_account_id` = el `advertiser_id` que el usuario selecciona.

**T6.3 — `POST /connect/google_ads`**

OAuth2 estándar de Google: `https://accounts.google.com/o/oauth2/v2/auth`.
Scope: `https://www.googleapis.com/auth/adwords`.

`provider_account_id` = el `customer_id` (10 dígitos, sin guiones).
Encripta también el `refresh_token` (Google no expira los refresh tokens).

**Validación post-OAuth:** después de guardar las credenciales, llamá al adapter
correspondiente con un get/list para verificar que funcionan:

```python
from backend.integrations.adapter_registry import get_adapter
from backend.services.credential_resolver import DBCredentialResolver

resolver = DBCredentialResolver(account_id=current_user.account_id, supabase_client=supabase)
creds = resolver.resolve("meta")
adapter = get_adapter("meta")
# Validación: leer un recurso conocido. Si falla, marcar last_validated_at=null.
```

**Criterio de aceptación:**
- Conectar Meta crea una fila en `platform_connections` con tokens cifrados.
- Conectar la misma plataforma de nuevo reemplaza la fila (gracias al UNIQUE constraint).
- Hay un endpoint `DELETE /connect/{platform}` que borra la fila.
- Hay un endpoint `GET /connect/status` que devuelve qué plataformas tiene conectadas el account actual.

---

### T7 — Wire del resolver en `main.py`

**ESTE ES EL SWITCH FINAL.** Es 1 línea (más imports).

Encontrá donde el agente usa el resolver. Hoy es algo así (en `main.py` o en
`backend/agents/campaign_agent.py`):

```python
# ANTES (single-tenant)
from backend.services.credential_resolver import EnvCredentialResolver
resolver = EnvCredentialResolver()
```

Cambialo a esto:

```python
# DESPUÉS (multitenant)
from backend.services.credential_resolver import DBCredentialResolver
from backend.db.supabase_client import get_supabase
resolver = DBCredentialResolver(
    account_id=request.state.account_id,
    supabase_client=get_supabase(),
)
```

El resolver se construye **por request** (no global) porque depende del
`account_id` que pone el middleware.

**Criterio de aceptación:**
- Un usuario que conectó Meta puede lanzar una campaña en su Meta.
- Otro usuario sin Meta conectado recibe error claro ("plataforma no conectada")
  o el flujo cae al mock — ambos son aceptables según producto.
- Dos usuarios distintos pueden lanzar campañas simultáneamente sin que se
  mezclen las credenciales (ver gotcha 8.1 abajo si Meta tiene problemas).

---

### T8 — UI de Settings (frontend)

3 botones de "Conectar Meta / TikTok / Google Ads" en una página de Settings.
Cada uno:
- Hace `POST /connect/{platform}` → redirige al OAuth de la plataforma.
- Después del callback, muestra estado conectado/desconectado.
- Botón "Desconectar" que llama `DELETE /connect/{platform}`.

El frontend está en `frontend/src/`. Tu Claude puede mirar el `Settings.tsx`
existente o crear uno nuevo. Stack: Vite + React + Tailwind, sin shadcn por defecto.

---

## Gotchas críticos

### 8.1 Meta SDK es global (NO thread-safe entre tenants)

`facebook_business.api.FacebookAdsApi.init(...)` setea una sesión **global del
proceso**. Si llegan dos requests de cuentas distintas simultáneos, el segundo
pisa al primero.

**Mi adapter** (`backend/integrations/meta_adapter.py`) ya llama `init()` por
cada request, pero por la naturaleza global del SDK eso no resuelve la
concurrencia. Soluciones, de menos a más laburo:

1. **Aceptarlo y serializar requests a Meta con un lock global.** Throughput
   bajo pero seguro. Sirve para MVP con pocos usuarios.
2. **Usar `FacebookAdsApi` instances explícitas** y pasarlas a cada llamada del
   SDK. La lib lo soporta pero requiere refactor de `meta_adapter.py`.
3. **Reemplazar SDK por HTTP directo** (como hicimos con TikTok). Roadmap.

**Recomendación:** opción 1 para MVP. Cuando llegue tracción, opción 2 y avisame
para que refactorice el adapter.

### 8.2 TikTok soft-delete

TikTok no permite hard-delete vía API. Mi `campaign_remover` devuelve
`soft_delete=True` y un `rationale` listo para mostrar.

**Tu frontend tiene que ser honesto:** label recomendado del botón:
`"Eliminar (desactiva en TikTok)"`. Si decís solo "Eliminar" y después el
usuario ve la campaña como DISABLE en TikTok Ads Manager, perdés confianza.

### 8.3 Google Ads `developer_token` aprobado

El `developer_token` se obtiene del Google Ads Manager Center. En desarrollo
viene "test only" y solo puede operar contra cuentas de test. Para producción
hay que aplicar a Google y esperar aprobación (~2 semanas).

**Implicación:** el `developer_token` es **nuestro** (Adkio), no del usuario.
Solo `refresh_token` y `customer_id` son del usuario. Por eso en `DBCredentialResolver`
lo leemos de env (`ADKIO_GOOGLE_ADS_DEVELOPER_TOKEN`), no de `extra_jsonb`.

### 8.4 Refresh tokens — quién los rota

| Plataforma | Access token TTL | Refresh token TTL | Rotación |
|---|---|---|---|
| Meta | ~60 días (long-lived) | N/A | Cron antes que expire |
| Google | ~1 hora | No expira | SDK lo hace automático en cada llamada |
| TikTok | 24 horas | ~365 días | Cron antes que expire |

**Recomendación:** un cron diario que mire `token_expires_at < now() + 7 days`
y refresque. Lo agregás después del MVP.

### 8.5 RLS — testealo de verdad

No confíes en que la query con `eq("account_id", X)` es suficiente. Activá
RLS en Supabase y probá con un cliente que tenga JWT de otro account. Si podés
leer la fila, hay un bug.

---

## Punto de sincronización conmigo

**Vos mergeás primero contra `main`** con:
- Schema + RLS de `platform_connections`
- `accounts` + auth
- `DBCredentialResolver` (en el mismo archivo que `EnvCredentialResolver`)
- Middleware tenant
- Endpoints OAuth + Settings UI
- T7: switch `EnvCredentialResolver` → `DBCredentialResolver` en `main.py`

**Yo rebaseo `feature/multichannel`** después de tu merge. Mi rama no cambia
nada de lo tuyo, solo activa el wire en el agente. Cero conflictos esperados.

**Archivos que vos tocás** (NO yo):
- `backend/auth/*` (nuevo)
- `backend/middleware/*` (nuevo)
- `backend/api/connections.py` (nuevo)
- `backend/security/token_crypto.py` (nuevo)
- `backend/services/credential_resolver.py` (extensión — agregás `DBCredentialResolver` AL FINAL)
- `backend/main.py` (1 línea de switch + middleware register)
- `frontend/src/pages/Settings.tsx` (UI conexiones)
- Migración SQL en Supabase

**Archivos que YO toco** (NO vos):
- `backend/integrations/*` (todos)
- `backend/tools/*` (todos)
- `backend/agents/campaign_agent.py`

---

## Smoke test que tu Claude puede correr para validar todo end-to-end

`scripts/smoke_multitenant.py`:

```python
"""
Smoke test: conectar una cuenta de Meta vía DB, lanzar una campaña.
Requiere: PLATFORM_TOKENS_ENC_KEY y una fila en platform_connections.
"""
import os
from backend.security.token_crypto import encrypt_token
from backend.services.credential_resolver import DBCredentialResolver
from backend.db.supabase_client import get_supabase
from backend.integrations.adapter_registry import get_adapter
from backend.integrations.base import CampaignSpec

ACCOUNT_ID = "..."  # un account_id real de la DB

# 1. Insertar credenciales encriptadas (simulando OAuth callback)
db = get_supabase()
db.table("platform_connections").upsert({
    "adkio_account_id": ACCOUNT_ID,
    "platform": "meta",
    "provider_account_id": "act_TU_CUENTA_DE_TEST",
    "access_token_encrypted": encrypt_token("TU_ACCESS_TOKEN_DE_META_TEST"),
    "extra_jsonb": {
        "app_id": os.environ["META_APP_ID"],
        "app_secret": os.environ["META_APP_SECRET"],
        "page_id": os.environ["META_PAGE_ID"],
    },
}).execute()

# 2. Resolver lee + desencripta
resolver = DBCredentialResolver(account_id=ACCOUNT_ID, supabase_client=db)
creds = resolver.resolve("meta")
assert creds is not None, "Resolver no encontró las credenciales"

# 3. Adapter crea campaña en PAUSED
adapter = get_adapter("meta")
result = adapter.create_campaign(
    creds,
    CampaignSpec(
        name="Smoke test multitenant",
        objective="OUTCOME_LEADS",
        budget_usd=50,
        duration_days=3,
    ),
)
print(f"OK: {result.campaign_id} en estado {result.status}")
print(f"Rationale: {result.rationale}")
```

Si esto crea una campaña real en PAUSED en la cuenta de test → tu integración
multitenant funciona y mergeable.

---

## Variables de entorno nuevas

Agregar al `.env.example` y a la config de Railway:

```bash
# Auth
JWT_SECRET=                          # openssl rand -hex 32

# Cifrado de tokens
PLATFORM_TOKENS_ENC_KEY=             # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Google Ads — developer_token global de Adkio
ADKIO_GOOGLE_ADS_DEVELOPER_TOKEN=

# Google OAuth (client de Adkio)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/connect/google_ads/callback

# TikTok OAuth (app de Adkio)
TIKTOK_APP_ID=
TIKTOK_APP_SECRET=
TIKTOK_OAUTH_REDIRECT_URI=http://localhost:8000/connect/tiktok/callback

# Meta OAuth (ya tenés META_APP_ID/META_APP_SECRET — se reusan)
META_OAUTH_REDIRECT_URI=http://localhost:8000/connect/meta/callback
```

---

## Contacto / dudas

Si algo del core te tira un Protocol mismatch o te falta un campo en algún
dataclass de credenciales: **avisame antes de cambiarlo**. Tengo tests que
dependen de las firmas exactas. Casi seguro hay manera de extender sin romper —
agregar un campo opcional, un kwarg con default, etc.

Si tu Claude propone tocar archivos en `backend/integrations/` o
`backend/tools/`, decile que **NO** y que avise.
