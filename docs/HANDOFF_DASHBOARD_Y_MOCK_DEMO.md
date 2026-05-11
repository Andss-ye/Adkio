# Handoff — Dashboard interactivo + Mock demo en `/app`

> Rama: `obj-d/dashboard` · Autor: Jonathan · Fecha: 10 May 2026
> Cierra Objetivo D (Frontend + Deploy) end-to-end y agrega un destino real cuando el usuario hace "Probá Adkio gratis".

---

## TL;DR — Qué se construyó

Tres trabajos en un solo PR:

1. **`/dashboard` — Workspace interactivo (NUEVO).** El destino al que va el usuario después de hacer "Probá Adkio gratis" en la landing. Lista de campañas con filtros funcionales (Campañas / Guardadas / Activas / Borradores / Archivo) + búsqueda + detalle por campaña. Usa el mismo lenguaje visual del mock `Inboxes` de la landing pero a viewport completo.
2. **Mock-first en `/app` (cumple Objetivo D).** Si el backend no responde, el flujo entero se simula en el cliente con datos hardcodeados que respetan el schema de CONTEXT.md. No hay forma de que el demo se rompa por backend caído.
3. **Polish del flujo de aprobación.** El resultado post-launch ya no es un blob de markdown crudo: ahora muestra Campaign ID, KPIs estructurados (Leads / CPL / Inversión) y próximos pasos en cards.

---

## Mapa de routing

```
/             ←  Landing (sin cambios estructurales)
   ↓ click "Probá Adkio gratis" / "Probar Adkio"
/dashboard    ←  Workspace interactivo (NUEVO)
   ↓ click "Nueva campaña" o "Generar"
/app          ←  Generador conversacional (existía, ahora con mock-fallback)
   ↑ click "‹ Workspace" en el chrome
   ↻ vuelve a /dashboard
```

Routing por `window.location.pathname` en `App.tsx` — coherente con el patrón existente, sin agregar React Router.

---

## Archivos nuevos

| Archivo | Qué hace |
|---|---|
| `frontend/src/pages/DashboardPage.tsx` | Workspace fullscreen — sidebar (vistas + estado + gasto), lista de campañas (search + scroll styled), panel de detalle |
| `frontend/src/lib/dashboard-data.ts` | 18 campañas hardcodeadas con datos coherentes (8 Activa, 3 Borrador, 2 Pausada, 1 Revisión, 4 Archivadas; 5 Guardadas) |
| `frontend/src/lib/mock-campaign.ts` | Parser de prompts (presupuesto, ciudad, fecha, exclusividad, tipo) + generador de plan + simulador SSE con timings escalonados + simulador de approve |
| `docs/HANDOFF_DASHBOARD_Y_MOCK_DEMO.md` | Este documento |

## Archivos modificados

| Archivo | Cambio principal |
|---|---|
| `frontend/src/App.tsx` | Routing para `/dashboard` |
| `frontend/src/index.css` | Nueva clase `.dark-scroll` (scrollbar fino, accent cyan en hover) |
| `frontend/src/hooks/useCampaignStream.ts` | Health-check al backend → fallback automático al mock. Nuevo type `LaunchKpis`. Expone `mode: 'live' \| 'mock'` |
| `frontend/src/pages/AppPage.tsx` | Botón "‹ Workspace" en el chrome. Pasa `mode` a `ChatPanel`. Pasa `onReset` a `CampaignPreview` |
| `frontend/src/components/app/ChatPanel.tsx` | Chip `Demo` cuando `mode === 'mock'`. Mensajes contextuales del agente. Sugerencias clickeables en el primer turno |
| `frontend/src/components/app/CampaignPreview.tsx` | Card "CPL estimado". Nueva launched view con KPIs estructurados (sin markdown crudo). Botón "Crear otra campaña" → `reset()` |
| `frontend/src/components/app/ToolCard.tsx` | Tech pills monospace con datos extraídos del `result` de cada tool |
| `frontend/src/components/ui/AppleButton.tsx` | Acepta `href` y `onClick` para navegación declarativa |
| `frontend/src/components/ui/Icons.tsx` | Nuevos iconos: `ChevronLeft`, `Plus`, `Play`, `Pause`, `Filter`, `Globe`, `Users`, `Calendar` |
| `frontend/src/components/landing/{Hero,Navbar,FinalCTA,Pricing,AgentSection}.tsx` | CTAs ("Probá Adkio gratis" / "Probar Adkio" / "Revisar") apuntan a `/dashboard` |

> Notas sobre el diff de `git status`:
> - `objectives.md` y `package-lock.json` tienen cambios menores no relacionados (limpieza de un bloque de design system viejo, dependency tree).
> - `docs/ESTADO_INTEGRACION.md` y `docs/ESTADO_OBJ_A.md` aparecen como "deleted" — fuera de scope de este PR.

---

## Feature 1 — Dashboard interactivo (`/dashboard`)

### Layout

```
┌─ Window chrome (luces macOS · "Adkio Workspace" · "Sincronizado con Meta") ──┐
├──────────────┬────────────────────┬────────────────────────────────────────┤
│ SIDEBAR      │ LISTA              │ DETALLE                                │
│ 260px        │ 380px              │ 1fr                                    │
├──────────────┼────────────────────┼────────────────────────────────────────┤
│ + Nueva camp │ [Search]           │ Header (Refinar · Duplicar · Pausar)   │
│ Generar →    │ Vista · count      │ Título + status pill + ID monospace    │
│ Campañas 14  │ [item][item]       │ Card prompt original                   │
│ Guardadas 5  │ [item]<<scroll>>   │ Card razonamiento Adkio                │
│ Activas 8    │ ...                │ Métricas en vivo (4 KPIs)              │
│ Borradores 3 │                    │ Audiencia + Presupuesto                │
│ Archivo 4    │                    │ Advertencias (si hay)                  │
│ ESTADO       │                    │                                        │
│ • Activa 8   │                    │                                        │
│ • Pausada 2  │                    │                                        │
│ • Borrador 3 │                    │                                        │
│ • Revisión 1 │                    │                                        │
├──────────────┤                    │                                        │
│ GASTO HOY    │                    │                                        │
│ $1,284.12    │                    │                                        │
│ ▲ 3.6x ROAS  │                    │                                        │
│ (anclado)    │                    │                                        │
└──────────────┴────────────────────┴────────────────────────────────────────┘
```

### Estructura del sidebar (importante para responsive)

```
aside (flex-col · overflow-hidden)
  ├── div.flex-1.overflow-y-auto.no-scrollbar     ← scrollea si hace falta
  │   ├── botón "Nueva campaña"
  │   ├── nav (Generar · Campañas · Guardadas · Activas · Borradores · Archivo)
  │   └── filtros de Estado (con counts dinámicos)
  └── div.flex-shrink-0 · border-t                ← FIJO al fondo, fuera del scroll
      └── card "Gasto hoy"
```

**Importante:** la card "Gasto hoy" NO está dentro del contenedor scrollable. Si crece el nav y el scroll se activa, la card no se va al fondo del overflow — sigue anclada al borde inferior visible. Esto resuelve un bug previo donde la card desaparecía en viewports chicos.

### Filtros (lógica orthogonal)

| Click | Acción |
|---|---|
| Click en una **vista** (Campañas/Guardadas/etc.) | Setea la vista, **resetea el statusFilter**, mueve `selectedId` al primer item de la nueva lista |
| Click en un **estado** (Activa/Pausada/Borrador/Revisión) | Setea el filtro de estado. Si la vista actual es incompatible (ej: vista=Borradores + estado=Activa daría empty), **pivota la vista a "Campañas"** automáticamente |
| Click en el **mismo** estado dos veces | Lo desactiva |
| Click en la **estrella** del header de una campaña | Toggle saved → el contador de "Guardadas" se actualiza vía `useMemo` sobre `savedMap` |
| Búsqueda libre | Filtra por `name` o `prompt` en cualquier vista |

### Datos (`dashboard-data.ts`)

18 campañas total:
- 14 no archivadas (= contador "Campañas")
- 5 saved (subset de las 14) → "Guardadas"
- 8 con `status='Activa'` → "Activas"
- 3 con `status='Borrador'` → "Borradores"
- 4 archivadas → "Archivo"

Cada campaña tiene: `prompt`, `audience`, `budget`, `metrics` (si está activa) o `warnings` (si es borrador), `rationale` del agente, datos de plataforma. Sin variantes creativas en el detail (eliminadas tras feedback de UX para reducir ruido visual).

### Scroll de la lista de campañas

```css
/* index.css — añadido en este PR */
.dark-scroll {
  scrollbar-width: thin;                                /* Firefox */
  scrollbar-color: rgba(255,255,255,0.10) transparent;
}
.dark-scroll::-webkit-scrollbar { width: 4px; }
.dark-scroll::-webkit-scrollbar-track { background: transparent; }
.dark-scroll::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.10);
  border-radius: 9999px;
}
.dark-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0,210,255,0.30);                     /* accent cyan */
}
```

Aplicado en la lista: `<div className="flex-1 overflow-y-auto dark-scroll min-h-[400px]">`. El `min-h-[400px]` garantiza ~5 ítems siempre visibles antes de que el scroll arranque.

---

## Feature 2 — Mock-first en `/app` (Objetivo D)

### Flujo de decisión

```
startStream(prompt)
  │
  ├── isBackendAlive()                  ← fetch /health con timeout 1.5s
  │
  ├── alive=true → mode='live'
  │   └── fetch POST /campaign  → parsea SSE real
  │
  └── alive=false → mode='mock'
      └── simulateMockStream(prompt, emit)   ← emite events con setTimeout
```

`approveCampaign` aplica la misma lógica: si `mode='mock'` o falla `POST /campaign/approve`, cae a `simulateMockLaunch`.

### Parser de prompts

```ts
parsePrompt("Quiero llenar nuestro evento en Bogotá, 15 de junio, $200, somos exclusivos")
// →
{
  budget_usd: 200,
  duration_days: 14,        // default si no detecta días/semanas
  city: "Bogotá",
  iso: "CO",
  country: "Colombia",
  date_hint: "15 de junio",
  type: "evento",           // detecta evento|curso|venta|awareness|app_install|leads
  exclusive: true,          // detecta exclusiv|premium|c-level|founder|ceo|...
}
```

A partir del prompt parseado, `buildMockPlan()` arma un `Plan` completo (copy + targeting + budget + validation) con rationales context-aware. Variaciones por tipo de campaña (evento vs curso vs venta vs leads) y por exclusividad (audiencias chicas vs amplias).

### Timings de la simulación (coherentes con `AgentSection`)

| Tool | Duración |
|---|---|
| `budget_validator` | 600–900 ms |
| `audience_analyzer` | 1100–1500 ms |
| `copy_generator` | 1400–1900 ms |
| `campaign_validator` | 700–1000 ms |
| `plan_ready` | +200 ms |

Total ≈ 4–5 s. Cada tool emite `tool_start` (spinner aparece), espera, luego `tool_result` con `rationale` específico al prompt.

### Indicador visual

`ChatPanel` header muestra un chip `Demo` (cyan, pequeño) cuando `mode === 'mock'`. Además un mensaje único del agente: _"Backend no detectado · simulando flujo con datos demo. Mismo schema que la API real."_

### Sugerencias en el primer turno

Cuando el chat está vacío (`messages.length === 1 && status === 'idle'`), aparecen 4 chips clickeables con prompts de ejemplo. Click envía el prompt directo. Útil para mostrar variedad sin que el usuario tenga que tipear.

---

## Feature 3 — Launch result polish

### Antes

```tsx
<div className="text-xs whitespace-pre-wrap">
  # Campaña creada exitosamente
  **Campaign ID:** act_xxx_xxx
  ## Configuración
  ...
</div>
```

Markdown crudo. Mucho texto. Jerarquía pobre.

### Ahora

`LaunchResult` ahora incluye campos estructurados:

```ts
type LaunchKpis = {
  expected_leads: number;
  cpl_usd: number;
  total_budget_usd: number;
  daily_budget_usd: number;
  duration_days: number;
};

type LaunchResult = {
  campaign_id: string;
  status: string;
  estimated_reach: string;
  preview_url?: string;
  report?: string;          // ya no se renderiza
  kpis?: LaunchKpis;        // NUEVO — estructurado
  next_steps?: string[];    // NUEVO — estructurado
};
```

Si el backend no manda `kpis`, `CampaignPreview` los **deriva del `plan`** (presupuesto × duración / CPL benchmark $14 USD para vertical educación ejecutiva LATAM). Esto evita que el frontend rompa si el endpoint todavía no implementó los campos.

### Layout de la launched view

```
● Campaña creada                                  Meta Ads
─────────────────────────────────────────────────────────
  CAMPAIGN ID
  act_7392845106_1715354000     ← monospace
  ● PAUSED · Alcance · 32K–75K personas

  KPIS ESPERADOS
  ┌─ Leads ──┬─ CPL ──┬─ Inversión ─┐
  │   ~14    │  $14   │    $200     │
  │          │        │ 14d · $14/d │
  └──────────┴────────┴─────────────┘

  PRÓXIMOS PASOS
  · Activar la campaña en Meta Ads Manager
  · Monitorear las primeras 48h (fase de aprendizaje)
  · Refrescar copy si el CPL supera $20

  [ Ver en Meta Ads Manager → ]    (si hay preview_url)
─────────────────────────────────────────────────────────
[ + Crear otra campaña ]              ← onReset()
```

---

## Feature 4 — Otros polish

- **CPL estimado** en `CampaignPreview` (cuando plan está ready), grid 2-col junto a "Presupuesto/día". Calculado con benchmark $14 USD.
- **Tech pills monospace en `ToolCard`**: cada tool muestra al lado del rationale unos chips monospace con datos clave del result. Ej: `budget_validator` → `[$14.30/día][aprobado]`. `audience_analyzer` → `[180K personas][32–52][CO]`. Hace el momento WOW del demo más rico sin saturar la card.
- **Botón "‹ Workspace"** en el chrome de `/app` (chevron izquierdo + label) → navega a `/dashboard`.
- **`AppleButton` ahora acepta `href` y `onClick`**: habilita navegación declarativa desde la landing sin onClick handlers explícitos en cada CTA.

---

## Cómo probarlo

```bash
cd frontend
npm install
npm run dev
# abrir http://localhost:5173/
```

### Sin backend (modo demo)

1. Abrir `http://localhost:5173/`
2. Click "Probá Adkio gratis" → cae en `/dashboard`
3. Probar filtros: click "Activas" (8), "Borradores" (3), "Guardadas" (5), "Archivo" (4)
4. Click la estrella de cualquier campaña → contador de Guardadas se actualiza al instante
5. Click "Nueva campaña" o "Generar" → va a `/app`
6. En `/app` debería aparecer el chip `Demo` en el header del chat
7. Click cualquier sugerencia o tipear un prompt → ver las 4 cards aparecer en stagger en el panel central
8. Click "Aprobar y lanzar" → ver KPIs estructurados (NO markdown crudo)
9. Click "Crear otra campaña" → vuelve al estado vacío
10. Click "‹ Workspace" en el chrome → vuelve a `/dashboard`

### Con backend

```bash
# Terminal 1
PYTHONPATH=. .venv/bin/python3 -m uvicorn backend.main:app --reload

# Terminal 2
cd frontend && npm run dev
```

El health check (1.5s) detecta el backend y usa SSE real. El chip `Demo` no aparece. Todo el resto del flujo funciona igual con datos del backend.

### Build / type-check

```bash
cd frontend && npx tsc -b --noEmit   # debería salir 0
```

---

## Decisiones técnicas

### Por qué health check upfront en lugar de fallback mid-stream

Si dejamos el fetch real correr y falla a la mitad, el usuario ya vio cards a medio terminar y tendríamos que limpiar para empezar de cero. Hacer un health check de 1.5s al inicio de cada `startStream` es más predecible y se siente como una decisión consciente, no como un crash.

### Por qué el dashboard es full-screen y no embebido en la landing

El componente `Inboxes` que ya estaba en la landing es decorativo (animation `aura-rise`, viewport ~600px). El dashboard es un destino real al que el usuario llega después de hacer "Probá Adkio gratis". Misma identidad visual (window chrome, liquid-glass cards, accent cyan), pero a viewport completo y con interactividad.

### Por qué `window.location.href` y no React Router

El proyecto ya usaba routing por `window.location.pathname` (ver `App.tsx` antes de este PR). Mantenemos consistencia y evitamos agregar dependencia. Para 3 rutas no se justifica un router.

### Por qué los iconos son SVG inline en `Icons.tsx`

`lucide-react` o similares agregan ~50KB no usados. Como los iconos son simples y pocos (~13 totales), definirlos inline es más eficiente y nos da control total sobre stroke / fill.

### Por qué la `Spend card` está fuera del scroll del sidebar

El layout original (`mt-auto` dentro de un `flex-col overflow-y-auto`) hacía que la card desapareciera del viewport cuando el nav crecía y activaba el scroll. La solución fue separar el contenedor scrollable del footer fijo:

```tsx
<aside className="flex-col overflow-hidden">
  <div className="flex-1 overflow-y-auto no-scrollbar">{/* nav + filtros */}</div>
  <div className="flex-shrink-0 border-t">{/* spend card */}</div>
</aside>
```

---

## Limitaciones conocidas

- El parser de prompts es regex-based. No detecta sinónimos creativos, solo keywords (ciudades específicas, "evento"/"curso"/"venta", patrones de moneda `$` o `USD`).
- El mock no persiste nada. Si el usuario refresca, vuelve a `idle`.
- Los toggles del dashboard (saved, etc.) viven en estado de React, no en localStorage.
- En el dashboard, "Refinar" / "Duplicar" / "Pausar" / "Reanudar" son botones visuales, NO funcionales. Para conectarlos hace falta agregar endpoints (`PATCH /campaigns/{id}` etc.) — fuera de scope de este PR.
- El dashboard usa datos 100% hardcodeados (`dashboard-data.ts`). Cuando exista `GET /campaigns` en el backend, hay que reemplazar el import por un fetch.

---

## Próximos pasos sugeridos

1. **Conectar el dashboard al backend real**: hoy es 100% mock. Cuando `GET /campaigns` exista, reemplazar `dashboard-data.ts` por un fetch + loader/empty/error states.
2. **Persistir saved en Supabase**: agregar columna `saved boolean` a la tabla `campaigns` y wire los toggles de la estrella.
3. **Seed de campañas reales**: similar al seed `demo-edu-latam` de `brand_configs`, sembrar 3-4 campañas para que la primera carga del dashboard tenga datos.
4. **Card "Gasto hoy" con datos reales**: hoy los números son hardcodeados (`$1,284.12`, `▲ 3.6x ROAS`). Cuando haya métricas, derivarlos de `GET /campaigns/aggregate` o equivalente.
5. **Toggle manual Live/Demo**: hoy es automático vía health check. Para una demo controlada con Bilbao, podría ser útil un switch en el chrome de `/app` para forzar modo demo independiente del backend.
6. **Acciones funcionales en el detail panel**: conectar Refinar / Duplicar / Pausar a endpoints reales.

---

## Branch y status

```
Branch:        obj-d/dashboard
Status:        sin commitear (working tree)
Files:         3 nuevos · 16 modificados (+ 1 doc)
Net diff:      ~+850 líneas / −650 líneas
TypeScript:    ✓ tsc -b --noEmit exit 0
Lints:         ✓ sin warnings
```

Para cualquier duda sobre por qué tal decisión: leer la sección "Decisiones técnicas" antes de cambiar comportamiento.
