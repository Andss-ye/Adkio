# Assessment del estado del producto

> Evaluación honesta de qué hace Adkio hoy si un usuario real lo prueba.
> Escrito 16 may 2026 después de feat/auth-flow-integration.
>
> **Para el equipo / Claude del equipo:** este es el contexto producto-real.
> Lo de abajo es lo que diría un product manager mirando el código y
> probando el flow. Sin endulzar.

---

## 1. Si alguien pega una Meta access_token válida y aprueba una campaña

### Lo que SÍ pasa (confirmado en código)

1. El token se cifra con Fernet AES-128 y se guarda en `platform_connections`.
2. Al aprobar, el `meta_adapter` (de Andrew) llama al SDK `facebook-business` y
   **crea una campaña real** en el ad account del token, **en estado PAUSED**.
3. Devuelve un `campaign_id` real (formato `act_XXX_YYY` de Meta, no mock).
4. La campaña aparece en el Ads Manager del usuario.
5. **No gasta un peso** hasta que el usuario la active manualmente desde Meta.

### Lo que NO va a ser tan bueno

1. **Solo crea el shell de Campaign** si falta `META_PAGE_ID` en el `extra_jsonb`
   de la conexión. Sin Page ID → no se crean Ad Set ni Ad → el usuario abre
   Ads Manager y ve una campaña vacía.
2. **Una sola variante de copy** — `copy_generator` devuelve 1 headline + 1 body
   + 1 CTA. Marketing de verdad hace 3-5 variantes y rota.
3. **Targeting genérico** — `audience_analyzer` mapea intereses como strings
   ("entrepreneurship", "business networking"). El adapter probablemente cae a
   targeting broad. **No se verificó a fondo el código de Andrew en
   `meta_adapter.create_campaign` para confirmar la conversión de strings a
   `interest_id` de Meta.**
4. **Sin píxel ni eventos de conversión configurados** — la campaña corre
   optimizando por OUTCOME_LEADS pero no hay tracking real seteado.
5. **Sin bid strategy optimizada** — default `LOWEST_COST_WITHOUT_CAP`, sirve
   para empezar pero no para escalar.
6. **No hay A/B test, ni rotación de creativos, ni dynamic creative** — todo es
   1 audiencia × 1 copy × 1 budget.

### Veredicto técnico de la campaña creada

| Aspecto | Estado |
|---|---|
| Se crea en Meta de verdad | ✅ Sí (con token válido + page_id) |
| Estado seguro (no gasta) | ✅ PAUSED por default |
| Tracking habilitado | ❌ Sin pixel configurado |
| Calidad del copy | 🟡 Aceptable, 1 sola variante |
| Calidad del targeting | 🟡 Genérico, intereses como strings |
| Lista para escalar | ❌ Falta optimización manual |

**Conclusión**: si un marketer pega su token y aprueba, se crea **una campaña
real básica que sirve como punto de partida**. Le ahorra ~20-30 min vs
montarla a mano desde cero, pero después tiene que abrir Ads Manager y
completar pixel, variantes de creativo, segmentación afinada, y revisar bid
strategy. **NO es lista para producir leads sin trabajo adicional**.

---

## 2. Experiencia de un jurado sin credenciales (el caso más probable)

Simulando el flow paso a paso:

1. Landing → **bien**, polished, copy claro, CTAs visibles
2. Click "Empezar gratis" → `/signup` → **funciona**, crea cuenta
3. Redirect a `/dashboard` → **vacío** (sin campañas todavía)
4. Top bar muestra **"Sin plataformas · Conectar"** en amarillo
5. Click ahí o en sidebar "Conexiones" → drawer abre con las 3 plataformas
6. **Si intentan "Conectar Meta" con OAuth → falla porque no tenemos App
   Review aprobada**. Meta dirá "App no verificada".
7. Pueden hacer click en "↓ Conectar con API key manual" pero no tienen un
   token para pegar.
8. Van a `/app` → escriben un prompt → **ven al agente trabajar en streaming**
   (esto es el momento WOW real, funciona bien con Gemini 2.5).
9. Plan listo → click "Aprobar y lanzar".
10. **Sin credenciales conectadas → cae a mock con `is_mock=true`**.
11. UI muestra "Pending Meta Verification".
12. Vuelven al dashboard → ven la campaña con **"⚠️ Campaña simulada (sin
    credenciales conectadas)"** en el rationale.

**Veredicto jurado:** experiencia decente. Ven la UI polished, el streaming
del agente, y entienden que la campaña es simulada porque no conectaron Meta.
**La crítica más válida: "se nota que es prototipo porque no puedo conectar
Meta sin que ustedes me den un token de test".**

---

## 3. Si un marketing manager con credenciales reales lo prueba

Suponiendo alguien con ad account de Meta + access token + page_id propios:

### Lo que va a apreciar

- El streaming del agente es real, no canned. Ve cómo razona.
- El platform selector (Meta/TikTok/Google) tiene sentido.
- HITL con PAUSED es lo correcto desde el día 1.
- El copy es decente para validar idea.
- Le ahorra setear el shell de la campaña.

### Lo que le va a frustrar

- 1 sola variante de copy → "esto lo tendría que poner yo a A/B testear,
  ¿en qué me ayudó?"
- Targeting con intereses como strings, no IDs → "esto Meta no lo reconoce bien"
- Sin pixel → "¿cómo mido conversiones?"
- Sin estimador de delivery / CPM antes de aprobar → "no sé si va a llegar
  a alguien"
- Sin reporting post-launch → "¿y ahora cómo veo si funcionó?"
- No puede cambiar el ad account si tiene varios
- No puede usar audiencias custom o lookalikes que ya tenga construidas
- No puede importar copy aprobado por su equipo
- El brand_config `demo-edu-latam` es fijo — si su marca es de SaaS B2B en US,
  todo el flow tira recomendaciones de educación ejecutiva LATAM

**Veredicto marketer:** lo prueba 2-3 veces, dice "interesante demo de AI,
pero todavía no me sirve". Probablemente lo agregue a su backlog para
checkearlo de nuevo en 3-6 meses.

---

## 4. Riesgos si se hace público AHORA

### Riesgo alto

1. **Cualquiera crea cuenta con email fake** y consume API de Gemini. Rate
   limit es por IP (10/min en `/campaign`). Si alguien rota IPs, vacía la cuota.
2. **Si conectan un token real y aprueban una campaña con budget alto** sin
   entender que después tienen que pausarla manualmente en Meta para no
   gastar — puede salirles caro. **Es user error pero el daño reputacional es
   nuestro.**
3. **OAuth de Meta sin app review aprobada**: si un usuario intenta el flow
   real, Meta le tira pantalla de "App no verificada" — mal vibe.

### Riesgo medio

4. **No hay password reset** → si alguien tipea mal el password al registrarse,
   queda lockeado y nadie del equipo puede ayudarlo a recuperar.
5. **No hay email verification** → cuentas spam fáciles.
6. **Privacy Policy en `/privacidad`** — verificar que tenga contenido real,
   no lorem ipsum. Si Meta audita después y no hay PP real, niegan el app review.

### Riesgo bajo

7. **No hay billing real** — el campo `plan` en accounts es cosmético. Si
   alguien crea muchas cuentas "free trial", no hay enforcement. OK por ahora
   porque no monetizamos.
8. **Sin observability** — si algo rompe en prod, te enterás cuando alguien
   te lo dice. No hay Sentry ni similar.

---

## 5. Recomendación de cuándo abrir el link público

**NO abrirlo todavía.** Para hacerlo razonable, mínimo:

| Bloqueador | Tiempo realista | ¿Necesario? |
|---|---|---|
| Email verification (con Resend) | 4-6h código + 1d setup | **Sí** — sin esto cualquiera crea cuentas |
| Privacy Policy real | 1h legal + agregar a `/privacidad` | **Sí** — legal mínimo |
| Banner claro "Beta · No usar con plata real" | 30 min | **Sí** — disclaimer protege |
| Forgot password | 2-3h | Casi sí — evita usuarios bloqueados |
| Rate limit por cuenta (no solo IP) | 2h | Sí en producción |
| Sentry / observability básico | 1h | Sí — necesitás saber si rompe |
| Meta App Review aprobado | ~2 semanas | **Si querés OAuth real**, sí. Si solo manual API key, no |
| Multi-ad-account selector en Meta connect | 4h | Solo si esperás clientes con varias cuentas |

**Total mínimo para "compartir link sin riesgo razonable"**: ~10-15 horas de
código + ~1 día de setup operativo + 2-3 semanas de espera de Meta para OAuth.

---

## 6. Cómo posicionarlo HOY (mientras tanto)

Lo más responsable:

1. **Compartir un video del producto** en el LinkedIn post, **no el link**
2. Si querés que jurados/inversores entren, **mandales el link por DM con un
   mensaje claro**: "Demo privada · No usar credenciales reales · Esperando
   App Review de Meta"
3. **Banner amarillo permanente en la app**: "BETA — No conectes ad accounts
   de producción todavía. Las campañas se crean en PAUSED pero recomendamos
   usar cuenta de test"
4. **Si insistís en link público**: poner un signup gate con código de
   invitación (`INVITE_CODE` env var). Das el código a quien quieras que pruebe

---

## 7. Lo bueno honesto (para no quedar en negativo)

A pesar de todo lo de arriba, lo que está bien para 36-48h de hackathon:

- El streaming del agente con 5 tools y rationales **es un wow real**, no canned
- La arquitectura está bien separada (resolver, adapters, agent, tools)
- El multitenant está implementado correctamente con cifrado Fernet
- El CPL dinámico ahora muestra rangos realistas por contexto
- La UI tiene un nivel visual por encima del promedio de hackathons
- Hay tests del core (Andrew tiene 98 tests en su rama)
- Pattern de ContextVar para inyectar resolver per-request sin tocar agent
- Manual API key flow funciona end-to-end (testeado con `META_ACCESS_TOKEN` real)

**No es producto, es prototipo avanzado con arquitectura sólida**. Eso vendido
bien a un inversor o mentor es valioso. Vendido como "úsalo en producción"
todavía no.

---

## 8. Roadmap propuesto para pasar de "demo" a "alfa privada con 10 clientes"

Si querés cerrar la brecha hasta poder dar el link a 10 usuarios beta con
credenciales reales y que les sirva:

### Sprint A (2-3 días) — Auth y trust mínimo

- [ ] Email verification con Resend (gratis hasta 100/día sin dominio verificado)
- [ ] Forgot password + reset
- [ ] Banner "BETA — no usar con budgets altos"
- [ ] Privacy Policy real
- [ ] Sentry o Logsnag para observability

### Sprint B (3-5 días) — Calidad de campaña

- [ ] `copy_generator` devuelve 3 variantes en lugar de 1
- [ ] Mapping de intereses string → `interest_id` de Meta (Meta Marketing API
      tiene endpoint de búsqueda)
- [ ] Selector de ad account si el usuario tiene varios
- [ ] Importar audiencias custom existentes en Meta
- [ ] Configuración de pixel en el onboarding

### Sprint C (1-2 semanas) — Trámites

- [ ] App Review de Meta (Business Verification + video + permisos)
- [ ] Solicitar Developer Token Basic Access en Google Ads
- [ ] Solicitar sandbox aprobado en TikTok Business

### Sprint D (1 semana) — Post-launch experience

- [ ] Endpoint `GET /campaigns/{id}/performance` que llama a Meta Graph API
      y devuelve impresiones, clics, CPL real, gasto
- [ ] Pantalla "Performance" en el dashboard con métricas reales vs estimadas
- [ ] Sugerencias automáticas: "Tu CPL real es 2x más alto que el estimado,
      ¿generamos variantes de copy?"

Total estimado: **~3-4 semanas** para llegar a alfa privada con calidad.

---

## TL;DR para LinkedIn / external comms

> Adkio es un prototipo avanzado de AI agent para Meta Ads, construido en
> 36h en el GTM Hackathon Bogotá. La arquitectura multitenant + multichannel
> está implementada, pero la app está en BETA cerrada porque (1) la App Review
> de Meta lleva ~2 semanas, (2) faltan features para producción real
> (variantes de copy, A/B testing, pixel tracking). Si querés probarla con
> tu cuenta de test, escribime por DM.
