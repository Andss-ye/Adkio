# Adkio — Investigación de viabilidad de deploy

> Documento de arquitectura / DevOps. Consolida la evaluación de proveedores y combos de infraestructura para disponibilizar Adkio.
>
> **Fecha:** 20 Jul 2026 · **Rev:** v1.1  
> **Techo de presupuesto:** ≤ **$150 USD/mes** (**infra + Claude SDK**)  
> **Supuesto LLM:** **Claude Sonnet vía Claude SDK** (Anthropic Messages API / `anthropic` Python SDK) con **tool use** del Campaign Agent  
> **Stack actual del repo:** FastAPI + SSE · Vite/React SPA · Supabase · deploy de referencia Vercel + Railway

---

## 1. Objetivo

Evaluar opciones de cloud/PaaS y proponer **combos viables** cuyo **gasto mensual ya incluye**:

1. Hosting (front + back + DB)
2. **Uso de Claude (SDK + tools del agente)** bajo supuestos de usuarios y transacciones

Métricas por combo:

- Fit de arquitectura
- Características
- **Costo total/mes** (infra + Claude)
- Dificultad
- Cobertura: **MAU**, **tx/min**, **tx/mes**

---

## 2. Restricciones de arquitectura

| Capa | Tecnología | Implicación de deploy |
|---|---|---|
| Frontend | Vite + React SPA | CDN / static hosting |
| Backend | FastAPI + Python 3.11 | Proceso persistente o contenedor |
| Streaming | SSE en `POST /campaign` (20–90s) | **No** serverless con timeout corto |
| DB | Supabase (Postgres) | Mantener |
| Agente / LLM | **Claude SDK** + tool use | Costo dominante bajo el techo de $150 |
| Auth / OAuth | Callbacks en backend | URL HTTPS estable |
| Rate limit app | `/campaign` = **10/min por IP** | Techo de producto |

```
Frontend (SPA) ──POST /campaign (SSE)──▶ Backend FastAPI
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
               Supabase           Claude SDK (Sonnet)          Meta/TikTok/Google
              (Postgres)          + tool use agente              (APIs ads)
```

**Conclusión:** el cuello de botella económico es **Claude con tools**, no el cómputo del PaaS.

---

## 3. Supuesto LLM: Claude SDK + tool use

### 3.1 Qué incluye el gasto de IA

El Campaign Agent no es “1 completion”. En un plan típico:

| Fase | Qué pasa | Llamadas Claude |
|---|---|---|
| **Orquestación** | Loop con tool definitions (`budget_validator` → `audience_analyzer` → `platform_recommender` → `copy_generator` → `campaign_validator`) | **5–6** turns con historial creciente |
| **Tools con IA** | Varias tools generan `rationale` / copy vía Claude | **~4** (budget, audience, copy, validator) |
| **Post-plan (tx media)** | `refine_plan`, `report_generator` al lanzar | **0–2** extra |

Precio de referencia **Claude Sonnet** (API estándar, Jul 2026):

| Concepto | Precio |
|---|---|
| Input | **$3 / MTok** |
| Output | **$15 / MTok** |
| Overhead tool-use system prompt | ~500 tokens/request (facturado como input) |
| Tool schemas + `tool_use` / `tool_result` | Facturados como tokens normales |

> El Claude SDK no cambia el pricing vs litellm→Anthropic: cobra Anthropic por tokens. El SDK sí fija el supuesto de integración (Messages API nativa, tool use first-class).

### 3.2 Costo unitario modelado (por tipo de tx)

Estimación conservadora **sin** prompt caching agresivo:

| Tipo de tx | Tokens input (aprox.) | Tokens output (aprox.) | **Costo Claude** |
|---|---|---|---|
| **Tx pesada** — plan de campaña completo (orquestación + tools IA) | 70k–100k | 2.5k–4k | **$0.25 – $0.36** |
| **Punto de planificación (usado en tablas)** | — | — | **$0.30 / plan** |
| **Tx media** — refine / launch + report | 8k–20k | 0.5k–1.5k | **$0.08 – $0.15** → **$0.10** |
| **Tx ligera** — dashboard, listados | 0 | 0 | **$0** |
| **Onboarding** (por sesión útil) | 2k–6k | 0.3k–0.8k | **~$0.03** |

Desglose típico de **1 tx pesada @ $0.30**:

| Componente | Input | Output | $ |
|---|---|---|---|
| Orquestador 5–6 turns (tools + contexto creciente) | ~75k | ~1.2k | ~$0.24 |
| Tools con Claude (×4) | ~10k | ~2k | ~$0.06 |
| **Total** | ~85k | ~3.2k | **~$0.30** |

### 3.3 Supuestos de usuarios y transacciones

| Supuesto | Valor |
|---|---|
| Planes (tx pesadas) por cliente activo / mes | **10** |
| Launches / refines (tx medias) por cliente / mes | **3** |
| Onboarding amortizado / cliente / mes | **1** |
| Duración SSE tx pesada | 30–60 s |
| Réplicas backend base | 1 (salvo autoscale) |
| Techo total | **$150/mes** |

**Costo Claude por usuario activo / mes:**

```
10 × $0.30  (planes)
+ 3 × $0.10 (medias)
+ 1 × $0.03 (onboarding)
= $3.33 ≈ $3.35 / usuario / mes
```

**Fórmulas usadas en los combos:**

```
$Claude_mes ≈ (tx_pesadas_mes × $0.30) + (tx_medias_mes × $0.10)

# o por usuarios:
$Claude_mes ≈ MAU × $3.35

$Total = $Infra + $Claude
MAU_max_bajo_$150 ≈ ($150 − $Infra) / $3.35
Tx_pesadas_max ≈ ($150 − $Infra) / $0.30   (si ignoramos medias; tablas usan blend)
```

---

## 4. Viabilidad por proveedor / servicio

Escala: 🟢 bueno · 🟡 aceptable · 🔴 malo para Adkio ahora.

| Proveedor | Rol ideal | Fit arquitectura | Características | Costo típico | Dificultad | Veredicto |
|---|---|---|---|---|---|---|
| **Vercel** | Frontend SPA | 🟢 | CDN, preview deploys | Free → Pro $20 | 🟢 Baja | **Sí** (solo front) |
| **Railway** | Backend FastAPI | 🟢 | Docker, SSE OK | Hobby $5 + usage → ~$15–50 | 🟢 Baja | **Sí** — referencia |
| **Supabase** | Postgres (+ Auth) | 🟢 | Ya integrado | Free → Pro $25+ | 🟢 Baja | **Sí** |
| **Render** | Backend | 🟢 | Docker, SSE; Free spin-down | $7 → $25 | 🟢 Baja | **Sí** |
| **Cloudflare Pages** | Frontend | 🟢 | CDN fuerte | $0–5 | 🟢 Baja | **Sí** |
| **Cloudflare Workers** | Backend | 🔴 | No FastAPI/SSE largo | Bajo | 🔴 Alta | **No** |
| **Fly.io** | Backend Docker | 🟢 | SSE OK | ~$5–30 | 🟡 Media | **Sí** |
| **GCP Cloud Run** | Backend | 🟢 | Autoscale; cold start si min=0 | ~$10–80 | 🟡 Media | **Sí** |
| **AWS App Runner** | Backend | 🟢 | SSE OK | ~$25–70 | 🟡 Media | Aceptable |
| **AWS Amplify / S3+CF** | Frontend | 🟢 | Estático | ~$1–15 | 🟡 Media | Sí si AWS |
| **AWS ECS/Fargate + RDS** | Full stack | 🟡 | Overkill | $80–150+ | 🔴 Alta | **No ahora** |
| **Azure App/Container** | Backend | 🟡 | Similar Cloud Run | ~$30–90 | 🟡–🔴 | Débil |
| **Heroku** | Backend | 🟢 | Simple | ~$5–25 | 🟢 Baja | Viable |
| **DigitalOcean Apps** | Front + back | 🟢 | Predecible | ~$12–40 | 🟢–🟡 | Alternativa |
| **Vercel Functions** | Backend | 🔴 | SSE frágil | Incluido | 🟡 | **No** |
| **Anthropic (Claude SDK)** | IA del agente | 🟢 | Tool use nativo | **Ver §3** | 🟢 Baja | **Obligatorio en este supuesto** |

---

## 5. Combos — gasto total (infra + Claude) y cobertura

Todas las tablas usan:

- **$Claude** = f(usuarios o tx) con §3  
- **$Total** = $Infra + $Claude  
- Escenarios dimensionados para quedar **≤ $150**  
- **Tx/min** = capacidad de infra (SSE); el techo mensual lo marca Claude

### Escenarios de carga estándar

| Escenario de carga | MAU | Tx pesadas/mes | Tx medias/mes | $Claude/mes |
|---|---|---|---|---|
| **A — Demo** | 10 | 50 | 15 | **~$16** |
| **B — Early Starter** | 25 | 250 | 75 | **~$84** |
| **C — Tope Claude bajo $150** | ver combo | ≈ ($150−$Infra)/$0.30 | ≈ 30% de pesadas | resto del presupuesto |

---

### Combo 1 — Vercel + Railway + Supabase *(recomendado)*

| Escenario | $Infra | MAU | Tx pesadas/min | Tx pesadas/mes | $Claude | **$Total** | ≤$150? |
|---|---|---|---|---|---|---|---|
| Demo (carga A) | **$10** (Vercel Free + Railway Hobby + Supabase Free) | 10 | 3–8 | 50 | **$16** | **~$26** | 🟢 |
| Early prod (carga B) | **$60** (Vercel Pro $20 + Railway ~$15 + Supabase Pro $25) | 25 | 8–15 | 250 | **$84** | **~$144** | 🟢 **casi techo** |
| Max MAU bajo $150 | **$60** | **~27** | 8–15 | **~270** | **~$90** | **~$150** | 🟢 techo |
| Infra más grande | **$110** | **~12** | 15–30 | **~120** | **~$40** | **~$150** | 🟡 peor: más infra = menos Claude |

**Lectura:** con Claude SDK + tools, el sweet spot es **infra magra (~$50–70)** para maximizar MAU. Early prod ≈ **25–27 clientes** @ 10 planes/mes.

---

### Combo 2 — Cloudflare Pages + Railway/Fly + Supabase

| Escenario | $Infra | MAU | Tx pesadas/min | Tx pesadas/mes | $Claude | **$Total** | ≤$150? |
|---|---|---|---|---|---|---|---|
| Demo (A) | **$12** | 10 | 5–12 | 50 | **$16** | **~$28** | 🟢 |
| Early prod (B) | **$55** (Pages $0 + Railway/Fly ~$30 + Supabase Pro $25) | 25 | 10–25 | 250 | **$84** | **~$139** | 🟢 |
| Max MAU bajo $150 | **$55** | **~28** | 10–25 | **~280** | **~$95** | **~$150** | 🟢 |

Misma liga que Combo 1; un poco más de margen Claude al ahorrar el front.

---

### Combo 3 — Cloudflare Pages + GCP Cloud Run + Supabase

| Escenario | $Infra | MAU | Tx pesadas/min | Tx pesadas/mes | $Claude | **$Total** | ≤$150? |
|---|---|---|---|---|---|---|---|
| Demo scale-to-0 (A) | **$15** | 10 | 2–10* | 50 | **$16** | **~$31** | 🟡 *cold start |
| Early prod min=1 (B) | **$65** | 25 | 15–40 | 250 | **$84** | **~$149** | 🟢 al límite |
| Max MAU bajo $150 | **$65** | **~25** | 15–40 | **~250** | **~$85** | **~$150** | 🟢 |
| Autoscale alto | **$120** | **~9** | 40–80 | **~90** | **~$30** | **~$150** | 🔴 overkill: Claude se ahoga |

Más tx/min en picos, **misma o peor cobertura mensual** porque Claude no escala con las réplicas.

---

### Combo 4 — Render + Supabase

| Escenario | $Infra | MAU | Tx pesadas/min | Tx pesadas/mes | $Claude | **$Total** | ≤$150? |
|---|---|---|---|---|---|---|---|
| Starter + Free/Pro light (A) | **$20** | 10 | 3–8 | 50 | **$16** | **~$36** | 🟢 |
| Standard + Supabase Pro (B) | **$50** | 25 | 10–20 | 250 | **$84** | **~$134** | 🟢 |
| Max MAU bajo $150 | **$50** | **~30** | 10–20 | **~300** | **~$100** | **~$150** | 🟢 |
| Pro 2 vCPU + Supabase Pro | **$110** | **~12** | 20–40 | **~120** | **~$40** | **~$150** | 🟡 |

---

### Combo 5 — AWS ligero (Amplify/S3+CF + App Runner + Supabase)

| Escenario | $Infra | MAU | Tx pesadas/min | Tx pesadas/mes | $Claude | **$Total** | ≤$150? |
|---|---|---|---|---|---|---|---|
| App Runner chico (B) | **$80** | 20 | 15–35 | 200 | **$67** | **~$147** | 🟡 |
| Max MAU bajo $150 | **$80** | **~21** | 15–35 | **~210** | **~$70** | **~$150** | 🟡 |
| Cerca techo infra | **$130** | **~6** | 30–50 | **~60** | **~$20** | **~$150** | 🔴 |

Peor $/cliente que Railway/Render: la infra fija come presupuesto de Claude.

---

## 6. Resumen comparativo (gasto total = infra + Claude SDK)

Dimensionado al **máximo MAU bajo $150** con el blend §3 ($3.35/usuario/mes):

| Combo | $Infra típico | MAU max | Tx pesadas/min | Tx pesadas/mes | $Claude | **$Total** | Rank |
|---|---|---|---|---|---|---|---|
| **Vercel + Railway + Supabase Pro** | **~$60** | **~27** | 8–15 | **~270** | **~$90** | **~$150** | **#1** |
| CF Pages + Railway/Fly + Supabase Pro | ~$55 | **~28** | 10–25 | **~280** | **~$95** | **~$150** | #2 |
| Render Standard + Supabase Pro | ~$50 | **~30** | 10–20 | **~300** | **~$100** | **~$150** | #2b (precio fijo) |
| CF Pages + Cloud Run + Supabase Pro | ~$65 | **~25** | 15–40 | **~250** | **~$85** | **~$150** | #3 (picos) |
| AWS App Runner ligero | ~$80 | **~21** | 15–35 | **~210** | **~$70** | **~$150** | #5 |
| Infra “grande” ($110+) | ≥$110 | **≤12** | alto | **≤120** | bajo | **~$150** | Evitar |

### Early Starter fijo (25 MAU · 250 planes · 75 medias)

| Combo | $Infra | $Claude | **$Total** | Holgura vs $150 |
|---|---|---|---|---|
| Render Standard + Supabase Pro | $50 | $84 | **$134** | +$16 |
| CF Pages + Railway + Supabase Pro | $55 | $84 | **$139** | +$11 |
| Vercel + Railway + Supabase Pro | $60 | $84 | **$144** | +$6 |
| Cloud Run min=1 + Supabase Pro | $65 | $84 | **$149** | +$1 |
| AWS App Runner | $80 | $84 | **$164** | **fuera** (−$14) → bajar a ~20 MAU |

---

## 7. Matriz por capa

| Capa | Mejor opción | Alternativa | Evitar |
|---|---|---|---|
| Frontend | Vercel o Cloudflare Pages | Amplify / Firebase | Shared hosting |
| Backend (SSE) | Railway / Render / Fly / Cloud Run | App Runner | Workers, Lambda, Vercel Functions |
| DB | **Supabase** | Cloud SQL / RDS luego | SQLite prod |
| **Agente / tools IA** | **Claude SDK (Sonnet) + tool use** | litellm→Anthropic (mismo $) | Opus como default |
| Auth | Supabase Auth | Clerk/Auth0 | Auth custom prematuro |

---

## 8. Sensibilidad del costo Claude (mismo combo #1 @ $60 infra)

| Variable | Cambio | Efecto en MAU max (~$90 Claude) |
|---|---|---|
| Baseline ($0.30/plan, 10 planes/user) | — | **~27 MAU** |
| Planes/user = 5 | −50% uso | **~50 MAU** |
| Planes/user = 20 | +100% uso | **~14 MAU** |
| Costo/plan = $0.20 (prompts cortos / cache) | −33% | **~40 MAU** |
| Costo/plan = $0.45 (contexto gordo / retries) | +50% | **~18 MAU** |
| Prompt caching ~50% del input orquestador | ~−$0.08/plan | **~35 MAU** |
| Usar Haiku en tools de rationale | baja $ tools | **~32–38 MAU** |

**Implicación DevOps:** dentro de $150, optimizar **tokens del agente** rinde más que subir de Railway Hobby a Pro Ultra.

---

## 9. Criterio de decisión

1. **Default (Claude SDK + tools):**  
   **Vercel + Railway + Supabase Pro**  
   → ~$60 infra + ~$84 Claude @ 25 MAU ≈ **$144/mes** · **8–15 tx pesadas/min** · **~250 planes/mes**.

2. **Maximizar MAU bajo $150:**  
   Minimizar infra (CF Pages + Render/Railway + Supabase Pro) → hasta **~28–30 MAU**.

3. **Picos de concurrencia (demos):**  
   Cloud Run min-instances=1; no subir instancias “por si acaso” si eso reduce presupuesto Claude.

4. **AWS solo si es requisito** — a igualdad de MAU sale más caro.

5. **Alertas:** budget Anthropic + usage Railway; el KPI de viabilidad es **$/plan Claude**, no CPU%.

---

## 10. Riesgos y límites duros

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Tool loop re-envía contexto completo | $/plan sube a $0.40+ | Truncar tool_results; prompt caching; max turns estricto |
| Retries / max_iterations=10 | Doble gasto en fallos | Circuit breaker + logs de usage del SDK |
| Supabase Free pause / 500 MB | Prod inestable | Pro $25 en early prod |
| Infra oversized | Menos dinero para Claude → menos clientes | Cap de spend PaaS; preferir $50–70 infra |
| Cold start Cloud Run / Render Free | SSE/demo rota | Always-on / min-instances=1 |
| Rate limit `10/min` por IP | Techo artificial | Pasar a límite por `account_id` con auth |

---

## 11. Recomendación final

| Prioridad | Combo | $Total @ 25 MAU | Cobertura |
|---|---|---|---|
| **1** | **Vercel + Railway + Supabase Pro + Claude SDK** | **~$144** | 25 MAU · 8–15 tx/min · ~250 planes/mes |
| **2** | **CF Pages + Railway/Fly + Supabase Pro + Claude SDK** | **~$139** | ~25–28 MAU · más margen |
| **3** | **Render Standard + Supabase Pro + Claude SDK** | **~$134** | ~25–30 MAU · precio fijo |
| **4** | CF Pages + Cloud Run + Supabase Pro + Claude SDK | **~$149** | mismos MAU; mejor pico tx/min |
| **Evitar** | Workers/Lambda como API; ECS/Azure full; App Runner si el techo es $150 estricto | — | Come presupuesto de tools |

Con **Claude SDK + tool use del agente**, bajo **$150/mes** y **10 planes/usuario**, Adkio es viable para **~25–30 clientes activos**. Escalar más usuarios exige **más presupuesto Anthropic**, menos planes/usuario, o bajar tokens (cache / Haiku en rationales) — no más vCPU.

---

## 12. Referencias de pricing (Jul 2026)

| Servicio | Dato usado |
|---|---|
| **Claude Sonnet (SDK/API)** | **$3 / MTok in · $15 / MTok out** · tool schemas/results = tokens |
| Railway | Hobby $5 (+$5 usage) · Pro $20 · ~$10/GB-mes · ~$20/vCPU-mes |
| Vercel | Hobby Free · Pro $20/user |
| Supabase | Free 500 MB/pause · Pro $25 |
| Render | Starter $7 · Standard $25 · Pro $85 |
| Cloud Run | Free tier + pay-per-use; min instances cobran idle |
| Fly.io | Usage-based ~$3–6 shared-cpu-1x |

Validar en dashboards oficiales antes de comprometer presupuesto.

---

## Log

```
20 Jul 2026 — v1.0
 • Investigación multi-cloud / PaaS
 • Combos con MAU, tx/min, tx/mes
 • LLM = Claude Sonnet (vía litellm)

20 Jul 2026 — v1.1
 • Supuesto cambiado a Claude SDK + tool use del agente
 • Modelo de costo unitario: orquestación + tools IA ($0.30/plan)
 • Blend usuario: $3.35/MAU/mes (10 planes + 3 medias + onboarding)
 • Combos recalculados con $Total = $Infra + $Claude ≤ $150
```
