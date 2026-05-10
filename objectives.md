# Adkio — Objectives

> **Cómo usar este archivo.** Cada Claude Code toma un objetivo, lo ejecuta de punta a punta, y marca su sección como `✅ COMPLETADO` con el hash del PR cuando termine.
>
> Mock-first siempre: si dependés de otro objetivo que no está listo, escribí mocks que respeten los schemas de CONTEXT.md y seguí. No bloquees a nadie.

---

## Status board

| Objetivo | Estado | Branch | PR |
|---|---|---|---|
| A. Campaign Agent + Tools | 🟢 En review | `obj-a/campaign-agent` | — |
| B. Onboarding + Supabase | 🟢 En review | `obj-b/onboarding` | — |
| C. Meta Integration | 🟢 En review | `obj-c/meta-integration` | — |
| D. Frontend + Deploy | 🔴 Pendiente | `obj-d/frontend` | — |

Estados: 🔴 Pendiente · 🟡 En progreso · 🟢 En review · ✅ Completado

---

## OBJETIVO A — Campaign Agent + Tools

**Branch:** `obj-a/campaign-agent`

### Resultado esperado

El corazón del sistema. Un endpoint FastAPI que recibe un prompt del usuario y stremea el razonamiento completo del agente hasta el plan final.

`POST /campaign` recibe `{user_prompt: str, brand_id: str}` y devuelve SSE con el flujo del agente.

### Qué construir

**`backend/llm.py`** — si no existe todavía, crealo vos. Es el wrapper de litellm. Una sola función `call_llm(messages, tools, stream)`. Ver schema en CONTEXT.md.

**`backend/agents/campaign_agent.py`** — agente con tool use via litellm. Orquesta en este orden:
1. `budget_validator` → valida que el presupuesto sea viable
2. `audience_analyzer` → configura la audiencia para Meta
3. `copy_generator` → genera headline, body y CTA
4. `campaign_validator` → checklist final antes de lanzar
5. (espera aprobación humana — el endpoint pausa aquí y devuelve el plan)
6. `POST /campaign/approve` → `campaign_launcher` → `report_generator`

**`backend/tools/`** — implementar las 6 tools siguiendo los schemas exactos de CONTEXT.md. Cada tool usa `call_llm` internamente para generar su output. Cada tool devuelve un campo `rationale` — texto en lenguaje natural que explica la decisión. Esto es lo que el frontend muestra en el panel de razonamiento.

**`backend/main.py`** — endpoints:
- `POST /campaign` → stream del agente hasta el plan
- `POST /campaign/approve` → lanza la campaña (llama campaign_launcher)
- `GET /campaign/{id}` → estado de la campaña
- `GET /health` → para verificar que está vivo

### Mock-first para lo que no depende de vos

- brand_config: usá el seed `demo-edu-latam` de Supabase. Si B no terminó todavía, hardcodeá este dict como mock interno y reemplazás cuando llegue el PR de B.
- campaign_launcher: si C no terminó, retorna `{"campaign_id": "act_demo_12345", "status": "active", "estimated_reach": "45K–90K personas"}`. Reemplazás cuando llegue el PR de C.

### Criterios de aceptación

- [x] `POST /campaign` con prompt de prueba devuelve stream con los 4 tool calls visibles
- [x] Cada tool call incluye su `rationale` en el stream
- [x] El stream termina con el plan completo (copy + audiencia + presupuesto + advertencias)
- [x] `POST /campaign/approve` dispara campaign_launcher y devuelve el reporte
- [x] `GET /health` responde 200
- [x] Cero valores hardcodeados fuera de los mocks explícitos

### Test rápido

```bash
curl -X POST http://localhost:8000/campaign \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"user_prompt":"Llenar evento Bogota junio, 200 dolares, exclusivo","brand_id":"demo-edu-latam"}'
```

---

## OBJETIVO B — Onboarding Agent + Supabase

**Branch:** `obj-b/onboarding`

### Resultado esperado

El sistema que aprende la marca del cliente. Una conversación de 3-5 turnos que termina con un `brand_config` persistido en Supabase, listo para que el Campaign Agent lo use.

### Qué construir

**`backend/db/supabase_client.py`** — cliente de Supabase con:
- `create_brand_config(data: dict) -> str` (retorna el id)
- `get_brand_config(id: str) -> dict`
- `update_brand_config(id: str, data: dict) -> None`

Usar `supabase-py`. Crear la tabla `brand_configs` en Supabase con el schema de CONTEXT.md.

**`backend/agents/onboarding_agent.py`** — agente conversacional con lógica de `confidence_score`:
- Campos críticos (peso 0.4 total): industria, público objetivo, presupuesto
- Campos importantes (peso 0.35 total): canales, propuesta de valor, tono
- Campos opcionales (peso 0.25 total): ejemplos de copy, restricciones
- Si score < 0.85 → hacer UNA pregunta (la más impactante que falte)
- Si score >= 0.85 → llamar `generate_brand_config(conversation_history)` → persistir en Supabase → retornar el config generado
- Campos inferidos deben marcarse en algún campo de metadata

**`backend/main.py`** — agregar endpoints:
- `POST /onboarding/message` → `{conversation_id: str, user_message: str}` → respuesta del agente o config final
- `GET /brand-config/{id}` → retorna el config

**Seed obligatorio — hacer esto PRIMERO y commitear:** Crear un script `backend/db/seed.py` que inserta el registro `demo-edu-latam` con el brand_config de AcademiaEjecutiva LATAM (no usar nombre 30X — es solo la vertical de educación ejecutiva). El Objetivo A lo necesita para testear.

```python
# Seed mínimo para demo-edu-latam
{
  "id": "demo-edu-latam",
  "negocio_nombre": "AcademiaEjecutiva LATAM",
  "negocio_industria": "educacion ejecutiva / networking empresarial",
  "propuesta_de_valor": "Inmersiones presenciales y online para fundadores y CEOs que quieren escalar aprendiendo de quienes ya lo hicieron",
  "publico_roles": ["Founder", "CEO", "Co-founder", "Director General"],
  "publico_paises": ["Colombia", "Mexico", "Peru", "Argentina"],
  "publico_edad_min": 28,
  "publico_edad_max": 52,
  "publico_intereses": ["entrepreneurship", "business networking", "leadership development", "startup company", "venture capital", "Harvard Business Review"],
  "presupuesto_min_campana_usd": 100.0,
  "presupuesto_max_campana_usd": 500.0,
  "tono_estilo": ["aspiracional", "directo", "basado en pares"],
  "tono_evitar": ["lenguaje de autoayuda", "promesas vacias", "tono academico universitario"],
  "ejemplos_copy_aprobado": ["¿Cuantas decisiones importantes tomas completamente solo?", "Los mejores lideres no crecen solos. Crecen con los correctos."],
  "pixel_configurado": False
}
```

### Criterios de aceptación

- [x] Script `seed.py` corre sin errores y el registro `demo-edu-latam` existe en Supabase
- [x] Una conversación de onboarding de 3-5 turnos genera un `brand_config` válido
- [x] El agente nunca hace más de 1 pregunta por turno
- [x] `get_brand_config("demo-edu-latam")` retorna el seed correctamente (14/14 campos OK)
- [x] El config generado tiene todos los campos del schema de CONTEXT.md

---

## OBJETIVO C — Meta Integration

**Branch:** `obj-c/meta-integration`

### Decisión inmediata (primera media hora)

¿Hay una Meta Business Manager app con `ads_management` verificada? Si no → ir directo al mock. No perder tiempo en verificación que tarda 2-5 días.

### Resultado esperado

`campaign_launcher` funcional que retorna datos reales (sandbox) o datos calculados (mock). Indistinguible en la demo.

### Qué construir

**`backend/integrations/meta_ads.py`** — tres funciones:
```python
create_campaign(name, objective, budget_cents, ad_account_id) -> str  # campaign_id
create_ad_set(campaign_id, targeting, budget_cents, start_time, end_time) -> str  # adset_id
create_ad(adset_id, copy, creative_spec) -> str  # ad_id
get_campaign_status(campaign_id) -> dict  # status, reach, spend, impressions
```

Si `META_USE_SANDBOX=true` → llama a la API real de sandbox.
Si `META_USE_SANDBOX=false` → usa el mock calculado.

**Mock calculado (no random):**
- `campaign_id` formato real: `act_{ad_account_id}_{timestamp}`
- `estimated_reach` calculado: `tamano_audiencia * (budget_usd / cpl_benchmark)` donde CPL benchmark educación ejecutiva LATAM = $15 USD
- `status`: `"ACTIVE"`
- `impressions` estimados: reach × 1.8

**`backend/tools/campaign_launcher.py`** — usa `meta_ads.py` y devuelve el schema de CONTEXT.md.

### Criterios de aceptación

- [ ] `campaign_launcher` retorna `campaign_id`, `status`, `estimated_reach` con datos plausibles
- [ ] Si `META_USE_SANDBOX=true` y hay credenciales, la campaña aparece en Meta Business Manager
- [ ] Si es mock, los números son calculados y realistas (no `123456` hardcodeado)
- [ ] El `campaign_id` tiene el formato correcto de Meta
- [ ] Variable de entorno `META_USE_SANDBOX` controla el comportamiento

---

## OBJETIVO D — Frontend + Deploy

**Branch:** `obj-d/frontend`

### Resultado esperado

La interfaz que va a ver Bilbao. Tiene que verse como un producto real, no como un proyecto de hackathon. URL pública en Vercel.

### Qué construir

**Setup:** Vite + React 18 + TypeScript + Tailwind. No Next.js. No shadcn completo — solo componentes específicos si hacen falta (Dialog, Toast).

**Sistema de diseño (obligatorio, no cambiar):**
```
Background:  #0A0E14
Surface:     #131820
Accent:      #00D4A8
Text:        #E8ECF1
Muted:       #6B7280
Border:      rgba(255, 255, 255, 0.07)
Font body:   Inter
Font mono:   JetBrains Mono (para IDs, tool names, campaign_id)
Radius:      8px base / 12px cards
```

**Tres zonas en pantalla:**

1. **Chat** (columna izquierda, ~30% ancho)
   - Input de texto libre en el bottom
   - Historial de mensajes del usuario y respuestas del agente
   - Estado visible: "Analizando..." / "Plan listo" / "Campaña activa"

2. **Panel de razonamiento del agente** (columna centro, ~40% ancho) — EL WOW
   - Cada tool call aparece como una card que se revela en streaming
   - Card tiene: nombre del tool, ícono, y el `rationale` del tool en texto natural
   - Se apilan de arriba a abajo conforme el agente trabaja
   - Animación de entrada suave (slide + fade)
   - Font monospace para detalles técnicos (intereses, porcentajes)

3. **Preview de campaña** (columna derecha, ~30% ancho)
   - Se llena cuando el agente termina
   - Muestra: headline, body copy, CTA, audiencia configurada, CPL estimado, presupuesto diario, warnings en amarillo
   - Botón grande "Aprobar y lanzar" — solo visible cuando el plan está completo
   - Después de lanzar: muestra campaign_id y reporte en markdown

**Mock-first:** si el endpoint del backend no está listo, hardcodeá un response de ejemplo con el schema correcto. Reemplazás cuando llegue el PR de A.

**Deploy:** apenas tengas algo presentable (aunque sea feo), desplegá en Vercel y compartí la URL con el equipo. Iterar sobre algo vivo es mejor que esperar perfección local.

### Criterios de aceptación

- [ ] La app se puede usar end-to-end sin tocar terminal
- [ ] El streaming del panel de razonamiento funciona (cards aparecen una por una, no todo de golpe)
- [ ] El botón "Aprobar y lanzar" aparece solo cuando el plan está completo
- [ ] Después de aprobar se muestra el campaign_id y el reporte
- [ ] URL pública en Vercel funcionando
- [ ] El diseño no se ve genérico — tiene identidad propia

---

## Dependencias entre objetivos

```
B → seed en Supabase → A puede usar brand_config real
C → campaign_launcher real → A puede lanzar de verdad
A → endpoint /campaign → D puede conectar el frontend real

Todos pueden trabajar en paralelo con mocks desde el minuto 0.
```

---

## Tareas de pitch (cualquiera con tiempo libre)

- [ ] Actualizar slides con screenshots reales del producto funcionando
- [ ] Grabar video de 60s como plan B si la demo en vivo falla
- [ ] Preparar respuestas para preguntas de la mentoría 1-a-1 con mentora de 30X
- [ ] Si hay reunión con Bilbao: definir los 5 minutos exactos que se muestran
