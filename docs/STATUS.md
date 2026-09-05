# Estado del producto y roadmap

Evaluación honesta de qué funciona hoy, qué está a medias y qué falta. Es el inventario de lo que
existe: si querés saber si algo está implementado antes de construirlo, empezá acá.

**Última verificación contra el código: 9 de agosto de 2026.**

> Resumen en una línea: **prototipo avanzado con arquitectura sólida, no producto.** El flujo
> end-to-end crea campañas reales en PAUSED con credenciales propias; falta trust layer (email,
> reset de password), App Review de los tres providers, y calidad de campaña (variantes de copy,
> pixel, intereses como IDs).

---

## 1. Lo que funciona end-to-end

| Feature | Notas |
|---|---|
| Signup / login / refresh JWT | Tabla `accounts`, bcrypt, JWT HS256 |
| `/auth/me` + middleware de tenancy | `ADKIO_REQUIRE_AUTH=true` activa modo estricto |
| Agente de campaña con streaming SSE | 5 tools en la fase de plan (8 en total), tool calls reales, no canned |
| Iteración del plan por chat | `POST /campaign/refine` — 1 sola llamada al LLM |
| Persistencia y listado de campañas | Filtrado por `account_id` cuando hay JWT |
| Pausar / reanudar y borrado lógico | `PATCH` y `DELETE /campaigns/{id}` |
| Conexión manual por API key | `POST /connect/{platform}/manual`, cifrado Fernet. **El camino que sirve hoy** |
| `platform_hint` desde la UI | El usuario fuerza Meta / TikTok / Google |
| Adapter Meta con credenciales reales | Crea campañas reales en estado PAUSED |
| Marca por cuenta | Migración 005: cada cuenta tiene su `brand_config`, editable desde Settings |
| CPL dinámico por contexto | Rango calculado en backend (`cpl_min_usd` / `cpl_max_usd`), no hardcoded |
| Flag `is_mock` visible en la UI | Banner explícito cuando la campaña no tocó la API real |
| `claims_validator` determinista | Bloquea promesas de resultado, claims de salud, antes/después y atributos personales antes del checklist final. Sin LLM, con lista negra por vertical |
| Assets por conexión (backend) | Migración 007 + `GET/POST /connect/{platform}/assets`: el cliente elige ad account, página e IG, y el resolver publica con eso. **Falta la UI** |
| Estado real de conexiones | Top bar y drawer leen `/connect/status`; ya no hay "Sincronizado" falso |
| CTAs de landing respetan sesión | Logueado → `/dashboard`, si no → `/signup` |
| Confirmación de password en signup | Evita quedar lockeado sin reset |
| Tests del core | ~120 tests en `tests/`, sin red ni credenciales |

---

## 2. Implementado pero bloqueado por terceros

### OAuth de Meta / TikTok / Google Ads

Los endpoints existen y el frontend los llama, pero ningún provider está aprobado:

| Provider | Qué falta | Espera realista |
|---|---|---|
| Meta | App Review de `ads_management`, `pages_manage_ads` + Business Verification + video demo | ~2 semanas |
| TikTok | App Review / sandbox aprobado | ~3-5 días hábiles |
| Google Ads | Developer Token con Basic Access | ~2 semanas |

Sin aprobación, el click en "Conectar Meta" redirige bien al dialog de OAuth pero Meta muestra
"App no verificada" y el callback solo funciona con ad accounts agregados manualmente como testers.

**Mitigación vigente**: el flujo "Conectar con API key manual" funciona hoy sin approvals — se
pega el `access_token` + `provider_account_id` obtenidos de Graph Explorer / TikTok Sandbox /
`generate_user_credentials.py`.

**Trámites que alguien tiene que iniciar (no es código):**

- [ ] Business verification de Meta (documentos legales de la empresa)
- [ ] Video demo de 3-5 min mostrando el uso de cada permiso (obligatorio para Meta)
- [ ] App in production en Meta Developer Console
- [ ] Basic Access en el API Center de Google Ads
- [ ] Sandbox aprobado en TikTok for Business
- [ ] Revisar que `/privacidad`, `/terminos`, `/seguridad` tengan contenido legal real (hoy son
      páginas con contenido propio, no lorem ipsum, pero no pasaron revisión legal)

### Adapters de TikTok y Google Ads

El código existe y está testeado con dobles, pero nunca se ejercitó contra la API real porque el
`.env` no tiene credenciales de ninguno de los dos. Sin credenciales, el launcher cae a mock
(marcado con `is_mock`).

---

## 3. Qué pasa si alguien lo prueba hoy

### Con credenciales de Meta reales

Lo que **sí** pasa: el token se cifra con Fernet, el adapter llama al SDK `facebook-business`,
crea una campaña real en el ad account, en **PAUSED**, devuelve un `campaign_id` real y la campaña
aparece en su Ads Manager. **No gasta un peso** hasta que la activen a mano.

Lo que **no** va a estar a la altura:

| Aspecto | Estado |
|---|---|
| Se crea en Meta de verdad | ✅ con token válido + `META_PAGE_ID` |
| Estado seguro (no gasta) | ✅ PAUSED por default |
| Ad Set + Ad completos | ⚠️ sin `META_PAGE_ID` solo se crea el shell de Campaign |
| Tracking / pixel | ❌ sin configurar; optimiza por OUTCOME_LEADS sin eventos reales |
| Variantes de copy | 🟡 una sola (headline + body + CTA) |
| Targeting | 🟡 intereses como strings, no `interest_id` de Meta → tiende a broad |
| Bid strategy | 🟡 default `LOWEST_COST_WITHOUT_CAP` |
| A/B test, dynamic creative | ❌ no existe |

**Veredicto:** le ahorra 20-30 min de armado inicial, pero después tiene que abrir Ads Manager y
completar pixel, variantes y segmentación. No produce leads sin trabajo adicional.

### Sin credenciales (el caso más común: un jurado, un curioso)

Landing → signup → dashboard vacío → top bar en amarillo "Sin plataformas · Conectar" → no puede
completar OAuth (App Review pendiente) ni tiene un token para pegar → va a `/app`, escribe un
prompt y **ve al agente trabajar en streaming** (el momento fuerte, funciona bien) → aprueba → cae
a mock con `is_mock=true` y la UI lo dice explícitamente.

Experiencia decente y honesta. La crítica válida: "se nota que es prototipo porque no puedo
conectar Meta sin que ustedes me den un token de test".

### Un marketing manager con cuenta propia

Aprecia: el streaming real del razonamiento, el selector de plataforma, HITL con PAUSED, el copy
como punto de partida.

Le frustra: 1 sola variante de copy, intereses como strings, sin pixel, sin estimador de delivery
antes de aprobar, sin reporting post-launch, no puede elegir entre varios ad accounts, no puede
usar audiencias custom o lookalikes que ya tenga, no puede importar copy aprobado por su equipo.

**Veredicto:** lo prueba 2-3 veces y lo agenda para revisar en 3-6 meses.

---

## 4. Riesgos de abrir el link público hoy

### Alto

1. **Cuentas con email fake sin límite** — no hay verificación de email. El rate limit es por IP
   (10/min en `/campaign`); rotando IPs se puede vaciar la cuota del LLM.
2. **Usuario que aprueba una campaña con budget alto** y no entiende que después tiene que
   pausarla a mano en Meta. Es error del usuario, pero el daño reputacional es nuestro.
3. **OAuth sin App Review** → pantalla de "App no verificada" del provider.

### Medio

4. **No hay password reset** — un typo al registrarse deja la cuenta inaccesible para siempre.
5. **No hay verificación de email** — spam trivial.
6. **Páginas legales sin revisión legal** — si Meta audita durante el App Review, es un motivo de
   rechazo.

### Bajo

7. **`accounts.plan` es cosmético** — no hay billing ni enforcement de límites por plan.
8. **Sin observability** — si algo rompe en producción, te enterás porque alguien te lo cuenta.

### Recomendación

No abrir el link público todavía. Mientras tanto: compartir video en comunicaciones externas,
mandar el link por DM con el disclaimer "Demo privada · No usar credenciales de producción", banner
BETA permanente en la app, y si hace falta abrirlo, un gate de código de invitación.

---

## 5. Roadmap — de demo a alfa privada con 10 clientes

### Sprint A — Trust mínimo (2-3 días)

- [ ] Verificación de email con Resend (tabla `email_verifications`, `accounts.email_verified_at`,
      `POST /auth/verify-email`, pantalla "Revisá tu email" con botón de reenvío). **Nada de esto
      existe todavía en el código**
- [ ] `POST /auth/forgot-password` + `POST /auth/reset-password`
- [ ] Banner BETA permanente: "no conectes ad accounts de producción"
- [ ] Revisión legal de las páginas `/privacidad`, `/terminos`, `/seguridad`
- [ ] Sentry o Logsnag para observability
- [ ] Rate limit por `account_id`, no solo por IP

Estimado: ~10-15 h de código + ~1 día de setup operativo.

### Sprint B — Calidad de campaña (3-5 días)

- [ ] `copy_generator` devuelve 3 variantes en lugar de 1
- [ ] Mapear intereses string → `interest_id` de Meta (hay endpoint de búsqueda en la Marketing API)
- [x] Selector de ad account cuando el usuario tiene varios — backend listo (`platform_assets`); falta cablear el picker
- [ ] Importar audiencias custom / lookalikes existentes
- [ ] Configuración de pixel en el onboarding
- [ ] Estimador de delivery / CPM antes de aprobar

### Sprint C — Trámites (1-2 semanas, en paralelo con B)

Los seis puntos de la sección 2.

### Sprint D — Experiencia post-launch (1 semana)

- [ ] `GET /campaigns/{id}/performance` contra Meta Graph API: impresiones, clics, CPL real, gasto
- [ ] Pantalla de Performance: métricas reales vs estimadas
- [ ] Recomendaciones automáticas cuando el CPL real diverge del estimado

Total realista hasta alfa privada con calidad: **~3-4 semanas**.

### Más adelante (sin fecha)

Detector de fatiga de creativos (CTR cayendo >30% en 3 días), reporte semanal por WhatsApp, memoria
de campaña con RAG (pgvector en Supabase), A/B testing automático, banco de copy, export a CSV,
integración con CRM, Stripe + enforcement de planes, LinkedIn Ads, API pública para agencias.

---

## 6. Deuda técnica conocida

| Item | Impacto | Dónde |
|---|---|---|
| La tabla `campaigns` no está en `schema.sql` | Una DB nueva requiere crearla a mano | `backend/db/schema.sql` |
| Estado en memoria del proceso (`_campaigns`, `_conversations`, rate limiter) | Impide escalar a >1 réplica y se pierde en cada reinicio | `backend/main.py` |
| El SDK de Meta no es thread-safe | Con usuarios concurrentes hay que serializar con un lock o pasar a HTTP directo | `backend/integrations/meta_adapter.py` |
| `/health` reporta el modelo default de Groq, `llm.py` cae a Anthropic | Confunde al diagnosticar | `backend/main.py`, `backend/llm.py` |
| El agente no expone las tools de launch en la fase de plan | Correcto por diseño (HITL), pero implica que `campaign_remover` no es alcanzable desde el chat | `backend/agents/campaign_agent.py` |
| Sin billing ni enforcement de planes | `accounts.plan` decorativo | `backend/db/schema.sql` |
| Rate limiting in-memory | En producción con varias réplicas necesita Redis | `backend/main.py` |

---

## 7. Lo bueno, para no quedar en negativo

- El streaming del agente con tools y rationales es un wow real, no está grabado.
- La arquitectura separa bien: resolver / adapters / agent / tools, cada uno con una
  responsabilidad y un contrato explícito.
- El multitenant está implementado correctamente, con cifrado Fernet y aislamiento por `WHERE` en
  el resolver (no dependiendo de RLS, que el service role bypassa).
- El patrón de `ContextVar` permite inyectar el resolver por request sin que el agente sepa de
  tenancy.
- Hay tests del core que corren sin red ni credenciales.
- El nivel visual de la UI está por encima del promedio.
- El flujo de API key manual funciona end-to-end, verificado contra Meta real.
