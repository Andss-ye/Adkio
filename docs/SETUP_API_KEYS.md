# Setup de API keys — Meta, TikTok, Google Ads

> Guía paso a paso para sacar credenciales de las 3 plataformas que Adkio
> integra. Cada sección tiene **dos caminos**: test/sandbox (rápido, sin gastar
> plata) y producción (requiere review oficial).
>
> Al final hay un `.env` completo y un smoke test para verificar que las 3
> cargan correctamente.

---

## Tabla de tiempos esperados

| Plataforma | Test (operativo) | Producción aprobada |
|---|---|---|
| Meta Ads | ~1 hora | ~2 semanas (App Review + business verification) |
| TikTok Ads | ~30 min (sandbox auto-aprobado) | ~3-5 días hábiles |
| Google Ads | 1-2 días (dev token "test" es inmediato) | ~2 semanas (Basic/Standard access) |

**Recomendación:** arrancá los 3 trámites de producción en paralelo el mismo
día. Meta y Google son los cuellos de botella — TikTok te entrega producción
antes de que los otros aprueben.

---

## 🟦 Meta Ads (Instagram + Facebook)

### Test / Development

**1. Crear la app de Adkio en Meta**

- Andá a `developers.facebook.com` → "My Apps" → "Create App".
- Tipo: **Business**. Nombre: "Adkio Dev" (o el que quieras).
- En el panel de la app: "Add Product" → **Marketing API**.

**2. Obtener `META_APP_ID` y `META_APP_SECRET`**

- Settings → Basic → ahí están los dos valores.

**3. Crear un Ad Account de test (NO gasta plata real)**

Dos opciones:

- **Opción A (recomendada):** dentro de tu app → "Marketing API" → "Tools" →
  **"Create Test Ad Account"**. Ya viene marcado como test, no requiere método de pago.
- **Opción B:** `business.facebook.com` → Business Settings → Accounts →
  **Ad Accounts** → **Add → Create a New Ad Account**.

Copiá el ID (formato `act_XXXXXXXXXX`) → variable `META_AD_ACCOUNT_ID`.

**4. Generar `META_ACCESS_TOKEN`**

- `developers.facebook.com/tools/explorer` (Graph API Explorer).
- Seleccioná tu app arriba a la derecha.
- "Get User Access Token" → marcá scopes:
  - `ads_management`
  - `ads_read`
  - `pages_manage_ads`
  - `pages_read_engagement`
- "Generate Access Token" → copialo. **Dura 1 hora** (short-lived).

Para hacerlo long-lived (60 días):

```bash
curl -G \
  -d "grant_type=fb_exchange_token" \
  -d "client_id=$META_APP_ID" \
  -d "client_secret=$META_APP_SECRET" \
  -d "fb_exchange_token=$SHORT_LIVED_TOKEN" \
  "https://graph.facebook.com/v21.0/oauth/access_token"
```

**5. `META_PAGE_ID`**

- Andá a una Facebook page tuya → About → Page ID al final.
- Si no tenés, creá una en `facebook.com/pages/create` (gratis, sirve para test).

> Sin `META_PAGE_ID`, el adapter solo crea el shell de Campaign — no crea
> AdSet ni Ad. Para la cadena completa siempre configurá esto.

**6. `META_USE_SANDBOX=true`** en tu `.env`.

### Producción

Lo único que cambia: el token y los permisos.

- **App Review** para `ads_management` + `pages_manage_ads`. Toma **~2 semanas** y exige:
  - Business verification (subir documentos legales de la empresa)
  - Privacy policy URL pública
  - Video demo de cómo usás cada permiso
- **System User token** en vez de user token: en Business Settings → System Users →
  Add → asignás permisos al ad account → "Generate New Token".
  Los System User tokens **no expiran**.
- Ad Account real con método de pago.

---

## 🟪 TikTok Ads

### Test / Sandbox

**1. Crear cuenta en TikTok for Business**

- `business.tiktok.com` → registrar cuenta de empresa.

**2. Entrar al Developer Portal**

- `business-api.tiktok.com` → "My Apps" → "Create an App".
- Llená nombre, descripción, redirect URL (`http://localhost:8000/connect/tiktok/callback`
  para test).

**3. Obtener `TIKTOK_APP_ID` y `TIKTOK_APP_SECRET`**

- En el panel de la app, sección "App Info". App ID y Secret están ahí.

**4. Solicitar acceso al Sandbox**

- En el panel de la app: "Sandbox Account" → "Create Sandbox".
- TikTok te genera un advertiser de test automáticamente.
  **No gasta plata, no requiere review.**
- Copiá el **Advertiser ID** → variable `TIKTOK_ADVERTISER_ID`.

**5. Generar `TIKTOK_ACCESS_TOKEN`**

- En el sandbox hay un botón "Generate Access Token" — te da un token de
  larga duración para el sandbox sin pasar por OAuth.

**6. `TIKTOK_USE_SANDBOX=true`** en `.env`.

El adapter va automáticamente a `sandbox-ads.tiktok.com` (ver
`backend/integrations/credentials.py:TikTokCreds.base_url`).

### Producción

- **App Review** de TikTok: ~3-5 días hábiles, mucho más rápido que Meta.
  Exigen privacy policy + screenshots + descripción de uso.
- Cambiás `TIKTOK_USE_SANDBOX=false` → adapter va a `business-api.tiktok.com`.
- El access token de prod **dura 24h**; refresh token dura ~365 días → necesitás
  un cron de renovación (todavía no implementado — ver `docs/STATUS.md`).

---

## 🟧 Google Ads

Este es el más burocrático. Plan para ~1-2 días si arrancás de cero.

### Test / Development

**1. Cuenta Google Ads Manager (MCC)**

- `ads.google.com/intl/en/home/tools/manager-accounts/` → crear una manager account
  (gratis, no requiere campañas activas).

**2. Solicitar Developer Token**

- Dentro de tu MCC: arriba a la derecha → Tools → **API Center** → "Apply for access".
- Te dan un token **"Test Access" al toque** (~minutos).
- Este solo funciona contra cuentas de test.
- Copiá → variable `GOOGLE_ADS_DEVELOPER_TOKEN`.

**3. Crear una Test Account**

- Dentro del MCC: + Create → New Account → **marcá "Test Account"**.
- Esta cuenta NO requiere pago y simula la API real.
- Copiá el Customer ID (10 dígitos, formato `123-456-7890`) → `GOOGLE_ADS_CUSTOMER_ID`.
- El Customer ID del MCC → `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.

**4. Crear OAuth credentials en GCP**

- `console.cloud.google.com` → crear (o usar) un proyecto.
- APIs & Services → **Enable** "Google Ads API".
- APIs & Services → Credentials → Create Credentials → **OAuth client ID** →
  "Desktop app" (para test es lo más simple).
- Copiá → `GOOGLE_ADS_CLIENT_ID` y `GOOGLE_ADS_CLIENT_SECRET`.

**5. Generar `GOOGLE_ADS_REFRESH_TOKEN`**

El SDK trae un script. En una venv con `google-ads` instalado:

```bash
python -m google.ads.googleads.examples.authentication.generate_user_credentials \
  --client_id $GOOGLE_ADS_CLIENT_ID \
  --client_secret $GOOGLE_ADS_CLIENT_SECRET
```

- Te abre el browser, autorizás con tu cuenta de Google que tiene acceso al MCC,
  te devuelve el refresh_token. **Este no expira.**
- Copiá → `GOOGLE_ADS_REFRESH_TOKEN`.

### Producción

- **Application for Standard / Basic Access** del developer token: en API Center
  → "Apply for Basic/Standard access".
- Toma **~2 semanas** y exigen:
  - URL del producto productivo (puede ser tu landing)
  - Descripción del caso de uso
  - Screenshots/video de tu app usando la API
  - Compliance con sus policies (mínimo nivel de funcionalidad — read+write, etc.)
- Crear customer accounts reales (no marcadas como test) bajo el MCC, o el cliente
  trae sus propias cuentas.
- Tu OAuth client conviene moverlo a "Web application" con redirect URI productivo.

---

## `.env` completo

```bash
# ── Meta (test) ───────────────────────────────────────────────────────────
META_APP_ID=123456789012345
META_APP_SECRET=abc...
META_ACCESS_TOKEN=EAAB...           # long-lived 60 días
META_AD_ACCOUNT_ID=act_999...
META_PAGE_ID=10215...
META_USE_SANDBOX=true

# ── TikTok (sandbox) ──────────────────────────────────────────────────────
TIKTOK_APP_ID=70123...
TIKTOK_APP_SECRET=abc...
TIKTOK_ACCESS_TOKEN=sandbox_token_aqui
TIKTOK_ADVERTISER_ID=sandbox_adv_id
TIKTOK_USE_SANDBOX=true

# ── Google Ads (test) ─────────────────────────────────────────────────────
GOOGLE_ADS_DEVELOPER_TOKEN=test_token_aqui
GOOGLE_ADS_CLIENT_ID=123-abc.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=GOCSPX-...
GOOGLE_ADS_REFRESH_TOKEN=1//04...
GOOGLE_ADS_CUSTOMER_ID=1234567890        # sin guiones
GOOGLE_ADS_LOGIN_CUSTOMER_ID=9876543210  # MCC, sin guiones
```

---

## Verificar que las 3 cargan

```bash
.venv/bin/python -c "
from backend.services.credential_resolver import EnvCredentialResolver
r = EnvCredentialResolver()
for p in ('meta', 'tiktok', 'google_ads'):
    creds = r.resolve(p)
    print(p, 'OK' if creds else 'FALTAN VARS', creds.validate() if creds else '')
"
```

Si las 3 dicen **OK** y la lista de `validate()` es vacía, el resolver las cargó bien.

## Smoke test contra la API real

```bash
.venv/bin/python -c "
from backend.tools.campaign_launcher import campaign_launcher
r = campaign_launcher(
    canal='instagram',
    copy={'headline': 'Test smoke', 'body': 'Probando', 'cta': 'LEARN_MORE'},
    targeting={'paises': ['CO'], 'edad_min': 25, 'edad_max': 45, 'tamano_estimado': 500_000},
    budget=10.0,
    duracion_dias=1,
    platform='meta',
)
print(r)
"
```

Si devuelve un `campaign_id` que **no** empieza con `mock` o `act_demo_`, el
adapter habló con la API real. Repetí con `platform='tiktok'` y `platform='google_ads'`.

Cualquier campaña creada queda en estado **PAUSED** (Meta/Google) o **DISABLE**
(TikTok) — HITL — así que tenés tiempo de revisarla en el Ads Manager de cada
plataforma antes de que gaste un centavo.

---

## Troubleshooting común

| Error | Plataforma | Causa | Fix |
|---|---|---|---|
| `Error validating access token` | Meta | Token expirado | Regenerar en Graph API Explorer y refrescar a long-lived |
| `ad account sin método de pago` (code 100) | Meta | Ad Account de test no acepta `create_ad` | El adapter cae a `creative_id` automáticamente — campaña sigue visible |
| `Application not approved` | TikTok | Token de prod sin App Review | Usar sandbox + `TIKTOK_USE_SANDBOX=true` |
| `Developer token not approved for this customer` | Google Ads | Customer no es de test | Marcar la cuenta como Test Account en MCC |
| `invalid_grant` al regenerar refresh_token | Google Ads | Tu cuenta no tiene acceso al MCC | Verificar que la cuenta Google usada en OAuth tenga rol en el MCC |
