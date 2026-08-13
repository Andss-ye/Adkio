# Features a desarrollar — agosto 2026

> Lista de features y el porqué de cada una, para que el equipo las divida en tareas. No trae
> semanas ni dueños asignados — eso lo arma Jonathan en la reunión de reparto.
>
> Compilado a partir de `docs/ROADMAP_2026_08.md` (sesión anterior, 4 de agosto) y verificado
> contra el estado real del código en `main` el 10 de agosto de 2026.

## Objetivo del mes

Producto adoptable por 10–15 clientes reales gastando plata de verdad en Meta, con onboarding
asistido. Métrica: dólares reales gestionados + clientes que vuelven a lanzar solos.

**Nota:** el roadmap fuente asume que ya no hace falta esperar el App Review de Meta gracias a
*Ads AI Connectors* (MCP oficial de Meta, lanzado el 29 de abril de 2026, verificado externamente
— no es invención). Es real, pero adoptarlo implica cambiar cómo `meta_adapter.py` habla con Meta.
Ver la decisión abierta al final antes de armar tareas sobre `platform_assets`.

---

## Fixes bloqueantes

Sin esto, una campaña con plata real sale mal o le carga el gasto a la cuenta equivocada. Van antes
que cualquier feature nueva.

### 1. La página del anuncio sale de nuestro `.env`, no de la cuenta del cliente
`connections.py:196` toma `META_PAGE_ID` del entorno de Adkio en vez de preguntarle al cliente cuál
es su página.

**Por qué importa:** un cliente que conecta por OAuth queda publicando desde la página de Adkio, o
si la env var está vacía, el adapter crea una campaña vacía y la reporta como éxito.

### 2. Se elige la primera ad account a ciegas
`connections.py:185` toma `adaccounts[0]` sin preguntar.

**Por qué importa:** cualquier PYME que ya tuvo agencia suele tener varias ad accounts. Con plata
real eso es gastar del bolsillo equivocado.

### 3. Una sola conexión por plataforma pisa la anterior
Hoy la tabla `platform_connections` solo permite 1 fila por `(cuenta, plataforma)`.

**Por qué importa:** bloquea el caso normal de un negocio con varias páginas, ad accounts o
cuentas de Instagram bajo el mismo Business Manager.

### 4. No hay límite de gasto en ningún lado
Ni en el código ni en la cuenta de Meta hay un tope configurado.

**Por qué importa:** un bug en el cálculo de presupuesto diario con una tarjeta conectada es plata
real perdida. El tope real va en la cuenta de Meta (spend limit), el código es defensa secundaria.

---

## Features core

### `platform_assets` — modelo de credencial → múltiples cuentas
Hoy una conexión OAuth se aplasta en un solo `provider_account_id`. Falta modelar que **una
credencial da acceso a N ad accounts, N páginas y N cuentas de Instagram**, y que el cliente elija
cuál usar antes de aprobar una campaña.

**Por qué importa:** resuelve los fixes 1, 2 y 3 de una sola vez. Es la base sobre la que se
construye todo lo demás — conviene hacerla primero y rápido.

### Activación explícita `PAUSED → ACTIVE`
Hoy toda campaña se crea pausada y nunca se activa desde el producto. Falta un botón separado y
explícito — "Activar y empezar a gastar" — detrás del mismo gate de aprobación humana.

**Por qué importa:** sin esto no existe una sola campaña real corrida por Adkio. Todo lo demás
(métricas, RAG, retención) depende de que esto exista.

### `campaign_metrics` + ingesta diaria
No existe ninguna tabla de métricas. `get_campaign()` consulta impresiones/clics/gasto a las tres
plataformas y los descarta sin guardar nada.

**Por qué importa:** sin esta tabla no hay reportes, no hay memoria de marca, no hay RAG, y no hay
ningún dato defendible frente a un cliente o un inversionista.

### Dashboard de resultados para el cliente
Hoy el cliente no tiene dónde ver qué pasó con su campaña después de aprobarla.

**Por qué importa:** alguien que gastó plata real y no puede ver el resultado se va en la primera
semana. No es un nice-to-have.

### Ingesta de Instagram → brand config automático
Con los scopes que ya se piden para ads (`instagram_basic`, `pages_show_list`) se puede leer
`/{ig-user-id}/media` (captions, hashtags, engagement, frecuencia) y generar tono, industria,
propuesta de valor y proxy de audiencia sin que el usuario llene un formulario.

**Por qué importa:** es la feature de mayor diferenciación frente a la competencia (SaleADS,
Madgicx, Revealbot, AdCreative — todos parten de formulario). Además es el seed de la memoria de
marca que después alimenta el RAG.

**Ojo de seguridad:** los captions son texto de terceros — van como dato en el prompt, nunca como
instrucción ni en el rol `system` (riesgo de prompt injection).

### `claims_validator` determinista
Falta un validador (regex + lista negra por vertical) que corra antes de `campaign_validator` y
bloquee claims que violan políticas de Meta: superlativos, promesas de resultado, antes/después,
claims de salud.

**Por qué importa:** con plata real, esta es la causa número uno de rechazo de un anuncio en el ad
review de Meta.

---

## Trámites en paralelo — no son tareas de desarrollo

Corren por calendario, no por código, pero bloquean todo lo demás si no arrancan ya:

- Confirmar si la entidad legal (SAS) está constituida — si no, son ~2 semanas de Cámara de
  Comercio + RUT antes de que Meta pueda siquiera empezar a verificar el negocio.
- Dominio verificado, Business Manager + verificación de negocio de Meta enviada.
- Developer token de Google Ads solicitado, app de TikTok Marketing API enviada (no llegan este
  mes, pero conviene que el reloj arranque ya).
- Dossier de App Review: política de privacidad, términos, screencast del flujo.

---

## Fuera de alcance este mes

Decidido, no para rediscutir en la reunión de reparto:

- Lanzamientos reales en TikTok / Google Ads
- Multi-marca tipo agencia
- Billing / Stripe
- WhatsApp
- MCP propio de Adkio
- Vector store / embeddings (con ~50 campañas es sobreingeniería — la "memoria contextual" del mes
  es una query SQL bien armada sobre `campaign_metrics`)
- Optimización automática de campañas en vivo
- Generación de creativos con IA

---

## Decisión abierta — no es una feature, resolver antes de repartir tareas

**¿`platform_assets` y el flujo de conexión se construyen sobre el SDK directo actual, o se migra
`meta_adapter.py` al MCP oficial de Meta (`mcp.facebook.com/ads`, Business OAuth, sin App Review)?**

El MCP es real (verificado externamente) y elimina la espera de aprobación, pero es un cambio de
cómo se autentica y se llama a Meta, no un detalle de implementación. Decisión técnica de Andrew —
conviene resolverla antes de que alguien empiece `platform_assets`, porque el modelo de
credenciales cambia según la respuesta.
