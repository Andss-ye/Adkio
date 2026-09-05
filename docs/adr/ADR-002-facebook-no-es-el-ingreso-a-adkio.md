# ADR-002 — Facebook es un camino de conexión, no el ingreso a Adkio

| Campo | Valor |
|---|---|
| **Estado** | Aceptado |
| **Fecha** | 2026-09-05 |
| **Decisores** | Andrew |
| **Relacionados** | [ADK-7](https://linear.app/adkio/issue/ADK-7), [ADK-14](https://linear.app/adkio/issue/ADK-14), [ADK-20](https://linear.app/adkio/issue/ADK-20), `backend/api/connections.py`, `backend/db/migrations/007_platform_assets.sql`, ADR anterior sobre transporte de Meta (SDK vs MCP) |

---

## Contexto

ADK-7 se planteó como "que el ingreso a Adkio sea por OAuth de Facebook, y de ahí sacar
la forma de publicar en Meta Ads". Hoy el ingreso es propio: tabla `accounts`, bcrypt,
JWT HS256, y el aislamiento de tenant vive en el `WHERE` del `credential_resolver`.
Facebook aparece solo en `GET /connect/meta`, un botón de Settings para conectar una
cuenta que ya existe.

La pregunta es si conviene fusionar las dos cosas: que entrar a Adkio *sea* entrar con
Facebook.

Datos verificados contra la documentación de Meta el 2026-09-05:

- Para pedir `ads_management` sobre negocios que no son propios hace falta **Facebook
  Login for Business** (app de tipo Business + *business login configuration*), no el
  Facebook Login de consumidor.
- **Business Verification es obligatoria** para Advanced Access de `ads_management`.
  Depende de que la entidad legal exista ([ADK-11](https://linear.app/adkio/issue/ADK-11)).
- El 2026-05-04 Meta renombró "Ads Management Standard Access" a **Marketing API Access
  Tier** y bajó el umbral de 1.500 a **500 llamadas en 15 días** con menos de 15% de
  error. El cuello de botella del huevo y la gallina se achicó.
- En Dev Mode los permisos solo se conceden a usuarios con rol en la app
  (Admin / Developer / Tester). Cualquier otro ve "App no verificada".

## Decisión

**El login de Adkio sigue siendo propio. Facebook es un camino de conexión.**

1. `accounts` + JWT se queda como única puerta de entrada.
2. Conectar Meta se hace con **Facebook Login for Business**, desde Settings, con una
   sesión de Adkio ya iniciada.
3. Lo que sale de ese OAuth —N ad accounts, N páginas, N cuentas de Instagram— se
   persiste en `platform_assets`, una fila por asset, y el cliente elige cuál usa.
4. El `credential_resolver` lee esa elección. Es el único módulo que lo hace.

Un "Entrar con Facebook" como atajo de conveniencia queda permitido más adelante,
siempre que mapee a un `account` existente y nunca como única forma de entrar.

## Consecuencias

**A favor**

- Un token revocado o vencido rompe la publicación, no el acceso al producto. Con
  Facebook como único login, perder el token dejaría al cliente afuera de Adkio con sus
  campañas adentro.
- El onboarding no queda bloqueado por App Review: se puede dar de alta gente hoy y
  conectar Meta cuando Meta apruebe.
- El que administra el Business Manager y el que mira el dashboard pueden ser personas
  distintas, que es el caso normal en un negocio.
- La multitenancy existente no se toca.

**En contra**

- Un paso más en el onboarding: registrarse y después conectar.
- Hay que mantener auth propia (reset de password, verificación de email) en vez de
  delegarla.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Facebook como único IdP | Acopla el acceso al producto con el estado de un token de terceros y bloquea todo el onboarding hasta App Review |
| Esperar a App Review antes de construir el picker | El flujo completo se puede probar hoy con usuarios que tengan rol de Tester, y esas llamadas suman para el umbral de 500 |
| Seguir aplastando la credencial en `provider_account_id` | Es el bug de fondo: publica desde la página de Adkio y sobre la primera ad account que devuelva Graph |

## Notas de implementación

- La versión de Graph vive en `GRAPH_API_VERSION` (`backend/api/connections.py`),
  configurable con `META_GRAPH_API_VERSION`. Cada versión vence ~2 años después de su
  release: **v20.0 vence el 24-sep-2026**, por eso el default es `v25.0`, que sirve
  tanto para Graph como para la Marketing API.
- Los scopes de descubrimiento (`pages_show_list`, `instagram_basic`,
  `business_management`) son los que permiten listar las páginas y cuentas IG del
  cliente. Sin ellos el picker solo puede ofrecer ad accounts.
