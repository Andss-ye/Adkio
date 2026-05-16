# Handoff Multitenant — Para Freddy

> Contexto: la rama `feature/multichannel` ya tiene el core de los 3 canales
> (Meta, TikTok, Google Ads) listo en single-tenant. Tu parte es ponerle
> arriba el multitenant sin tocar el core de los adapters. Este doc resume
> qué te dejé hecho, qué tenés que construir, y los puntos donde el diseño
> ya tiene en cuenta tu trabajo.

---

## TL;DR

- El **core es stateless y tenant-agnostic** — los adapters reciben credenciales
  por parámetro, no leen env ni DB. No los toques.
- Lo único que cambia con multitenant es **de dónde** salen las credenciales
  (env → tabla `platform_connections` en Supabase).
- Tu trabajo es: schema en Supabase + `DBCredentialResolver` + middleware
  FastAPI que extrae `account_id` del JWT + UI de OAuth.
- Cuando termines, **tu resolver es drop-in** para el `EnvCredentialResolver`
  que ya existe — misma interfaz, misma firma.

---

## 1. Lo que ya está hecho (no tocar)

### `backend/integrations/`

- `base.py` — Protocol `PlatformAdapter` + dataclasses (`CampaignSpec`, `CreateResult`, `DeleteResult`, `CampaignStatus`, `AdapterError`).
- `credentials.py` — dataclasses `MetaCreds`, `TikTokCreds`, `GoogleAdsCreds` con método `validate()`.
- `meta_adapter.py` — wrapper de `facebook-business` SDK. Hard-delete real.
- `tiktok_adapter.py` — REST directo a TikTok Business API. **Soft-delete** (la API no soporta hard-delete).
- `google_ads_adapter.py` — wrapper de `google-ads` SDK. Hard-delete real.

### `backend/services/credential_resolver.py`

- Protocol `CredentialResolver` con un solo método: `resolve(platform) -> Credentials | None`.
- Impl `EnvCredentialResolver` que lee del `.env`. Esto es lo que se reemplaza con tu `DBCredentialResolver`.

### Tests (42 nuevos, todos pasan)

- `tests/integrations/test_contract.py` — los 3 adapters cumplen el Protocol.
- `tests/integrations/test_{meta,tiktok,google_ads}_adapter.py` — happy path + errores + edge cases.
- `tests/services/test_credential_resolver.py` — mapeo env → dataclass.

---

## 2. Lo que tenés que hacer

### 2.1 Schema en Supabase

Tabla nueva, **separada** de `brand_config`. Las credenciales NO van en `brand_config`.

```sql
create table platform_connections (
    id uuid primary key default gen_random_uuid(),
    adkio_account_id uuid not null references accounts(id) on delete cascade,
    platform text not null check (platform in ('meta', 'tiktok', 'google_ads')),
    provider_account_id text not null,         -- act_XXX | advertiser_id | customer_id
    access_token_encrypted text not null,
    refresh_token_encrypted text,
    token_expires_at timestamptz,
    extra_jsonb jsonb default '{}',            -- page_id (meta), login_customer_id (google), etc
    scopes text[] default '{}',
    connected_at timestamptz default now(),
    last_validated_at timestamptz,
    unique (adkio_account_id, platform)        -- 1 cuenta por plataforma por Adkio account
);
```

**Decisión clave del plan:** `UNIQUE(adkio_account_id, platform)` — un Adkio account conecta máximo 1 Meta + 1 TikTok + 1 Google Ads. Multi-cuenta queda fuera del MVP.

**Cifrado:** tokens van encriptados con clave del backend (no en el JWT). Sugerencia: `cryptography.fernet` con una key en env (`PLATFORM_TOKENS_ENC_KEY`).

**`extra_jsonb`** existe porque cada plataforma tiene campos extra (page_id, login_customer_id, app_id/secret) que no quiero meter como columnas para evitar migrations. El `DBCredentialResolver` los lee de ahí.

### 2.2 `DBCredentialResolver`

Cumple el mismo Protocol que `EnvCredentialResolver`. Mirá el resolver actual como referencia: `backend/services/credential_resolver.py`.

```python
# backend/services/credential_resolver.py (agregar al mismo archivo)

class DBCredentialResolver:
    """Multitenant: lee credenciales de Supabase filtrando por account_id."""

    def __init__(self, account_id: str, supabase_client, encryption_key: bytes):
        self._account_id = account_id
        self._db = supabase_client
        self._fernet = Fernet(encryption_key)

    def resolve(self, platform: str) -> Optional[PlatformCreds]:
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
        access_token = self._fernet.decrypt(row["access_token_encrypted"].encode()).decode()
        extra = row.get("extra_jsonb") or {}

        if platform == "meta":
            return MetaCreds(
                app_id=extra.get("app_id", ""),
                app_secret=extra.get("app_secret", ""),
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
            refresh_token = self._fernet.decrypt(
                row["refresh_token_encrypted"].encode()
            ).decode()
            return GoogleAdsCreds(
                developer_token=extra.get("developer_token", ""),
                client_id=extra.get("client_id", ""),
                client_secret=extra.get("client_secret", ""),
                refresh_token=refresh_token,
                customer_id=row["provider_account_id"],
                login_customer_id=extra.get("login_customer_id"),
            )
```

Lo importante: **misma firma que `EnvCredentialResolver`**. Los tools/agente que reciben un `CredentialResolver` no saben ni les importa de dónde sale.

### 2.3 Middleware FastAPI

```python
# backend/middleware/tenant.py (archivo nuevo)

from fastapi import Request, HTTPException

async def tenant_middleware(request: Request, call_next):
    # Extraer account_id del JWT (auth ya implementada para multitenant)
    account_id = get_account_id_from_jwt(request)
    if not account_id:
        raise HTTPException(401, "missing account context")
    request.state.account_id = account_id
    return await call_next(request)
```

Luego en el agente / tools:

```python
# Hoy en main.py el resolver es global. Con multitenant:
resolver = DBCredentialResolver(
    account_id=request.state.account_id,
    supabase_client=get_supabase(),
    encryption_key=os.environ["PLATFORM_TOKENS_ENC_KEY"].encode(),
)
```

### 2.4 OAuth flows por canal

3 endpoints `/connect/{platform}/callback`. Cada uno:

1. Recibe `code` del OAuth provider.
2. Lo intercambia por access_token + refresh_token.
3. Llama al adapter para validar (`adapter.get_campaign` con un id dummy o un `me` endpoint).
4. Cifra y upsertea en `platform_connections` (la unique constraint hace que reconectar reemplace).
5. Redirige al frontend.

Endpoints OAuth de referencia:
- **Meta:** `https://www.facebook.com/v21.0/dialog/oauth?...` — scopes: `ads_management`, `ads_read`, `pages_read_engagement`, `pages_manage_ads`.
- **TikTok:** `https://business-api.tiktok.com/portal/auth?...` — scope: `Ads Management`.
- **Google:** `https://accounts.google.com/o/oauth2/v2/auth?...` — scope: `https://www.googleapis.com/auth/adwords`.

### 2.5 UI de Settings

3 botones "Conectar Meta / TikTok / Google Ads" + estado actual + botón "Desconectar" (que hace DELETE en `platform_connections`).

---

## 3. Cosas a tener en cuenta (gotchas)

### 3.1 Meta SDK es global (NO thread-safe entre tenants)

`facebook_business.api.FacebookAdsApi.init(...)` setea una sesión **global** del proceso. Si dos requests de cuentas distintas llegan simultáneos, el segundo pisa al primero.

**Soluciones (de menos a más laboriosa):**

1. **Lock global por request** — serializás llamadas a Meta. Simple, pero serializa todo el throughput.
2. **`FacebookAdsApi.set_default_api(custom_api_instance)` por request** — la lib permite construir instancias separadas. Esto es lo que recomiendo.
3. **Reemplazar el SDK por HTTP directo** (como hicimos con TikTok). Más laburo pero elimina el problema. Roadmap.

Mirá `backend/integrations/meta_adapter.py:_init_api` — ese método es el único punto que necesita refactor para concurrencia multitenant.

### 3.2 TikTok soft-delete

La UI tiene que ser honesta. El plan ya recomienda label "Eliminar (desactiva en TikTok)". El `DeleteResult` te devuelve `soft_delete=True` y un `rationale` listo para mostrar en el panel. **No mientas al usuario** — si lo descubre, perdés confianza.

### 3.3 Google Ads requiere developer_token aprobado

El `developer_token` se obtiene del Google Ads Manager Center. En desarrollo viene "test only" y solo puede operar contra cuentas de test. Para producción hay que aplicar a Google y esperar aprobación (~2 semanas).

**Implicación:** durante onboarding de un usuario nuevo, el `developer_token` es nuestro (Adkio), no del usuario. Solo el `refresh_token` y `customer_id` son del usuario. Por eso en `extra_jsonb` puede vivir el `developer_token` como fallback, pero idealmente lo lees de un env var de Adkio:

```python
developer_token=os.environ["ADKIO_GOOGLE_ADS_DEVELOPER_TOKEN"]
```

Decidí guardarlo en `extra_jsonb` por flexibilidad, pero hablalo con el equipo — puede ser global.

### 3.4 Refresh tokens — quién los rota

- **Meta:** los access tokens de larga duración duran ~60 días. Hay que refrescar antes que expiren. La columna `token_expires_at` está pensada para esto.
- **Google:** el `refresh_token` no expira (salvo revocación). El `access_token` se regenera con cada llamada via SDK. No problem.
- **TikTok:** los access tokens duran 24 horas; el refresh token dura ~365 días. Necesitás un job que los rote.

Sugerencia: un cron diario que mire `token_expires_at < now() + 7 days` y refresque.

### 3.5 RLS en Supabase

Activar Row Level Security en `platform_connections`:

```sql
alter table platform_connections enable row level security;

create policy "users see only their account's connections"
  on platform_connections for all
  using (adkio_account_id = (auth.jwt() ->> 'account_id')::uuid);
```

Sin esto, un bug en el backend puede leer credenciales de otro tenant.

### 3.6 El agente / tools

Los tools `campaign_launcher` y `campaign_remover` (cuando los refactoricemos hacia el adapter pattern, ver punto 4) van a recibir `resolver: CredentialResolver` por DI. Ejemplo:

```python
def campaign_launcher(canal, copy, targeting, budget, duracion_dias, resolver):
    creds = resolver.resolve(canal)
    if not creds:
        return {"error": f"Canal {canal} no conectado", "rationale": "..."}
    adapter = ADAPTERS[canal]
    spec = CampaignSpec(...)
    result = adapter.create_campaign(creds, spec)
    return {...}
```

Tu middleware inyecta el resolver con `account_id` poblado. El tool no sabe nada del tenant.

---

## 4. Lo que NO está hecho todavía (pero tampoco tu pega)

- **Refactor del tool `campaign_launcher`** para que use los nuevos adapters en vez de llamar directamente a `meta_ads.py`. Lo hago yo (Andrew) después de tu integración, porque toca también el flow del agente.
- **Tool `campaign_remover`** con doble confirmación y rationale-aware del soft-delete TikTok. Mismo plan: yo lo agarro después.
- **Frontend de panel de razonamiento** que muestre `rationale` del `DeleteResult` (incluyendo el disclaimer de soft-delete). UI/UX del equipo de frontend.

---

## 5. Punto de sincronización

Cuando tu rama esté lista, hacemos merge así:

1. Tu PR mergea primero contra `main` (schema + DBCredentialResolver + middleware + OAuth).
2. Yo rebaseo `feature/multichannel` y agrego un PR que cambia `EnvCredentialResolver` por `DBCredentialResolver` en `main.py` (1 línea) + refactoriza `campaign_launcher` para usar adapters + agrega `campaign_remover`.

**Cero conflictos esperados** porque tocamos archivos distintos:
- Vos: `backend/middleware/`, `backend/auth/`, `backend/services/credential_resolver.py` (ampliación), schema SQL, `backend/api/connections.py`.
- Yo: `backend/integrations/` (ya está), `backend/tools/campaign_launcher.py`, `backend/tools/campaign_remover.py`, `backend/main.py` (1 línea del resolver).

---

## 6. Cómo probar tu trabajo sin esperarme

Mientras armás multitenant, podés validar todo el stack OAuth → DB → adapter sin esperar a que yo refactorice los tools. Test manual:

```python
# scripts/test_multitenant_creds.py
from backend.services.credential_resolver import DBCredentialResolver
from backend.integrations.meta_adapter import MetaAdapter
from backend.integrations.base import CampaignSpec

resolver = DBCredentialResolver(account_id="<algun account_id de la DB>", ...)
creds = resolver.resolve("meta")
assert creds is not None, "Conectá Meta primero via OAuth"

adapter = MetaAdapter()
result = adapter.create_campaign(
    creds,
    CampaignSpec(name="Test Multitenant", objective="OUTCOME_LEADS", budget_usd=50, duration_days=3),
)
print(result.campaign_id, result.rationale)
```

Si esto corre y crea una campaña en PAUSED en la cuenta correcta, tu integración está OK.

---

## 7. Variables de entorno nuevas que vas a necesitar

Agregar al `.env.example`:

```bash
# Multitenant
PLATFORM_TOKENS_ENC_KEY=          # Fernet key — generar con: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ADKIO_GOOGLE_ADS_DEVELOPER_TOKEN= # nuestro dev token aprobado por Google
```

---

## 8. Contacto

Si algo de los Protocol/dataclasses del core te resulta limitante para tu trabajo, **avisame antes de cambiarlos** — tengo tests que dependen de la forma exacta. Casi seguro hay manera de extender sin romper.
