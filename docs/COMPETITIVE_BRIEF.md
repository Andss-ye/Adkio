# Adkio — Brief competitivo (para el pitch)

> Investigación de mercado al 30 may 2026. Uso interno para el pitch final.
> Objetivo: posicionar Adkio frente a los players que aparecieron *después* de que
> se nos ocurriera la idea, y convertir cada "competidor" en validación o complemento.

---

## TL;DR para el escenario

> *"Cuando empezamos, SaleAds era casi el único en este espacio — y no lo conocíamos.
> Desde entonces Meta lanzó su Ads CLI + MCP oficial y Anthropic lanzó Claude Cowork
> para marketing. Tres validaciones independientes de nuestra tesis en menos de un mes.
> Ninguno hace lo que hace Adkio: un agente **vertical, opinado y con human-in-the-loop**
> que orquesta Meta, TikTok y Google con criterio experto y transparencia total del
> razonamiento. Los demás son o un asistente horizontal, o plumbing de bajo nivel. Adkio
> se monta encima de ese plumbing — no compite con él."*

---

## 1. SaleAds.ai — el competidor directo

**Qué es:** plataforma SaaS que automatiza creación, optimización y escalado de campañas en
Meta, TikTok y Google Ads desde lenguaje natural. Genera copy + creatividades, publica con
un click, optimiza 24/7. Claim: "campaña profesional optimizada en menos de 1 minuto / 52
segundos". Diferencial que pregonan: su IA está entrenada con **resultados reales de ads**,
no con datos sintéticos. ([saleads.ai](https://saleads.ai/en) · [Capterra](https://www.capterra.com/p/10040166/SaleADS-ai/))

**Qué tomar de ellos (funciona):**
- Mensaje de velocidad ("de prompt a campaña en segundos") — medible, concreto, vende.
- Multi-canal desde una sola cuenta como propuesta central.
- Narrativa de "entrenado con data real" → da credibilidad. Nosotros lo traducimos a
  **conocimiento experto de Meta codificado en las tools** (fase de aprendizaje, CPL
  benchmarks por país, validaciones) + memoria de marca.

**Dónde ganamos:**
- **Human-in-the-loop como feature, no limitación**: todo se crea en PAUSED, el usuario
  aprueba. Para agencias que manejan plata de clientes, el control es el punto de venta.
- **Transparencia del razonamiento**: el panel muestra cada tool pensando (budget → audiencia
  → plataforma → copy → validación) con su rationale. SaleAds es una caja negra.
- **Foco vertical** y memoria de marca: Adkio aprende tono, audiencia y qué convierte.

---

## 2. Meta Ads CLI + MCP oficial — NO es competencia, es nuestro motor

**Qué es:** el 29 abr 2026 Meta abrió su ecosistema a agentes de IA con los **Meta Ads AI
Connectors**: un servidor MCP HTTP en `mcp.facebook.com/ads` y una CLI local en Python, ambos
envuelven la Marketing API detrás de Meta Business OAuth. El MCP expone **29 tools** en 5
categorías (Campaign Management, Catalog, Assets, Diagnostics, Insights). Funciona con
asistentes que soporten MCP (Claude, ChatGPT). Por seguridad, **todas las campañas creadas vía
MCP arrancan en PAUSED** — exactamente nuestro modelo HITL. ([ppc.land](https://ppc.land/metas-new-ads-cli-lets-ai-agents-manage-ad-campaigns-from-the-command-line/) · [Meta for Business](https://www.facebook.com/business/news/meta-ads-ai-connectors) · [Search Engine Journal](https://beta.searchenginejournal.com/meta-ads-cli-command-line-tool-marketing-api/568953/))

**Framing para el pitch:**
- Meta resolvió el *plumbing* (auth, paginación, manejo de errores, objetivos post-v25 con
  Advantage+). Eso es bueno para nosotros: **menos integración de bajo nivel que mantener**.
- Adkio es la **capa de criterio** encima: decide qué campaña crear, con qué audiencia, qué
  copy, qué presupuesto, sobre qué plataforma — y lo hace multi-canal (Meta + TikTok + Google),
  no solo Meta.
- Que Meta valide PAUSED-by-default confirma que nuestro HITL es la práctica correcta.
- **Roadmap concreto y creíble:** migrar nuestro `meta_adapter` para ejecutar a través del MCP
  oficial de Meta cuando salga de beta → menos mantenimiento, más robustez, y "hablamos el
  protocolo oficial de Meta".

---

## 3. Claude Cowork / Claude for Small Business — horizontal, nosotros somos verticales

**Qué es:** Anthropic lanzó Claude Cowork (ene 2026), un agente enterprise que ejecuta tareas
multi-paso de forma autónoma, con acceso a **100+ herramientas de publicidad** (análisis de
campañas, keyword research, optimización de presupuesto, generación de copy). En may 2026 sumó
**Claude for Small Business** con conectores y workflows agénticos que corren dentro de
QuickBooks, PayPal, HubSpot, etc. ([Anthropic — Cowork](https://www.anthropic.com/webinars/how-anthropics-marketing-team-uses-claude-cowork) · [Anthropic — Small Business](https://www.anthropic.com/news/claude-for-small-business))

**Dónde ganamos:**
- Cowork es **horizontal y genérico** (sirve para todo → no opina sobre nada en particular).
  Adkio es **vertical y opinado**: codifica mejores prácticas de paid ads y ejecuta con criterio.
- Cowork vive dentro de herramientas enterprise y apunta a equipos grandes. Adkio es un
  producto self-serve para **agencias y pymes de LATAM** con un flujo end-to-end pulido.
- Onboarding: Adkio te configura la marca en una conversación y recuerda tu tono; Cowork es un
  asistente al que le tenés que explicar todo cada vez.

**Oportunidad de complemento:** Adkio corre sobre la Claude API (ya migrado a Claude Sonnet 4.5).
Podemos exponer Adkio como una **Skill / conector** dentro del ecosistema Cowork en el futuro —
estar *dentro* de donde el usuario enterprise ya trabaja, en vez de competir de frente.

---

## Tabla resumen

| | SaleAds.ai | Meta Ads MCP/CLI | Claude Cowork | **Adkio** |
|---|---|---|---|---|
| Multi-canal | ✅ | ❌ (solo Meta) | parcial (tools) | ✅ Meta/TikTok/Google |
| Human-in-the-loop | parcial | ✅ (PAUSED) | ❌ | ✅ (feature central) |
| Razonamiento visible | ❌ | ❌ | parcial | ✅ panel en vivo |
| Vertical/opinado | parcial | ❌ (plumbing) | ❌ (horizontal) | ✅ |
| Memoria de marca | ✅ | ❌ | parcial | ✅ |
| Self-serve LATAM | ✅ | ❌ (devs) | ❌ (enterprise) | ✅ |

## Conclusión estratégica

La aparición de tres players en un mes **valida el timing y la tesis**. Adkio no compite con el
plumbing de Meta (lo orquesta) ni con un asistente horizontal (es vertical y opinado). El foso
defendible: **HITL + transparencia del razonamiento + criterio experto codificado + foco en
agencias/pymes LATAM**. El roadmap (MCP oficial de Meta como motor, Skill en Cowork) convierte a
los "competidores" en infraestructura y canales de distribución.
