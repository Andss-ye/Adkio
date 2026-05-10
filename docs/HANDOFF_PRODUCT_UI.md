# Handoff — Product UI (3 paneles)
> Rama: `feature/product-ui` | Autor: Freddy (integrador)
> Objetivo D que Jonathan no pudo completar — construido desde cero.

---

## Qué se construyó

La herramienta real de Adkio — la app de 3 paneles que conecta al backend en tiempo real via SSE. Ruta: `/app`.

```
http://localhost:5173/app       (dev)
https://tu-dominio.vercel.app/app   (producción)
```

---

## Archivos nuevos

| Archivo | Qué hace |
|---|---|
| `frontend/src/pages/AppPage.tsx` | Página principal — layout 3 columnas + window chrome |
| `frontend/src/hooks/useCampaignStream.ts` | Hook SSE: conecta a POST /campaign, parsea eventos |
| `frontend/src/components/app/ChatPanel.tsx` | Panel izquierdo: input + historial de mensajes |
| `frontend/src/components/app/ReasoningPanel.tsx` | Panel centro: cards del agente en streaming |
| `frontend/src/components/app/ToolCard.tsx` | Card individual de cada tool call (spinner → check) |
| `frontend/src/components/app/CampaignPreview.tsx` | Panel derecho: plan + botón aprobar + reporte |
| `frontend/src/vite-env.d.ts` | Tipos para import.meta.env |

**Archivos modificados:**
- `frontend/src/App.tsx` — routing por pathname (`/app` → AppPage, `/` → Landing)
- `frontend/vite.config.ts` — `historyApiFallback: true` para que `/app` funcione en dev

---

## Cómo probarlo

```bash
# Terminal 1 — backend
cd /ruta/al/proyecto
PYTHONPATH=. .venv/bin/python3 -m uvicorn backend.main:app --reload

# Terminal 2 — frontend
cd frontend
npm run dev

# Abrir http://localhost:5173/app
# Escribir: "Quiero llenar nuestro evento en Bogotá, 15 de junio, $200, somos exclusivos"
# Verás las 4 cards del agente aparecer en tiempo real
```

---

## Flujo de usuario

1. Usuario escribe su campaña en el chat (panel izquierdo)
2. Las 4 cards del agente aparecen una por una con spinner → checkmark (panel centro)
3. El plan completo se llena en el panel derecho
4. Botón "Aprobar y lanzar" aparece al completarse el plan
5. Post-approve: campaign_id en mono + reporte markdown

---

## Variable de entorno necesaria

Crear `frontend/.env` (ignorado por .gitignore):
```
VITE_BACKEND_URL=http://localhost:8000
```

En Vercel: agregar como variable de entorno con la URL de Railway.

---

## Para Jonathan / el equipo de frontend

Para ajustar el diseño del producto (colores, tipografía, animaciones):
- El sistema de diseño está en `frontend/src/index.css` (`.liquid-glass`) y `tailwind.config.ts`
- Los colores accent son `#00d2ff` y `#10b981` (success)
- Animaciones: reutilizar `animate-aura-fade-up` del tailwind config
- Cada `ToolCard` usa `animationDelay` basado en el índice para el stagger

Para agregar más herramientas al mapa de íconos:
```ts
// frontend/src/components/app/ToolCard.tsx
const TOOL_META: Record<string, { label: string; icon: string }> = {
  budget_validator:   { label: 'budget_validator',   icon: '$' },
  audience_analyzer:  { label: 'audience_analyzer',  icon: '◎' },
  copy_generator:     { label: 'copy_generator',     icon: '✦' },
  campaign_validator: { label: 'campaign_validator', icon: '✓' },
  // agregar más acá
};
```
