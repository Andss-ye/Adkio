# Handoff — Métricas reales para la landing
> Medición: 10 May 2026 | Modelo: gemini/gemini-2.5-flash | Rama: feature/product-ui

---

## Datos reales medidos (para Andrew)

Corrí `scripts/measure_timings.py` con el prompt de demo real contra el backend con Gemini 2.5 Flash.

### Tiempos

| Métrica | Valor real | Landing actual | ¿Cambiar? |
|---|---|---|---|
| Flujo completo del agente | **~38.8s** | "3.0 segundos" | **SÍ — es incorrecto** |
| Eventos SSE recibidos | 9 eventos | — | — |

**Nota sobre los tiempos:** La landing dice "3 segundos" — eso era con Groq (medimos 5.1s). Con Gemini 2.5 Flash son ~38-45s. Opciones:
- Cambiar copy a: *"En menos de un minuto"* (preciso y suena bien)
- O: *"< 60 segundos"* (verdadero y claro)
- Nunca decir "3 segundos" si usamos Gemini

### Audiencia LATAM ejecutiva

| Métrica | Valor real |
|---|---|
| Base audiencia LATAM exec | **1,620,000 personas** |
| Países configurados | Colombia, México, Perú, Argentina |
| Intereses detectados | 8 términos por campaña |
| Muestra de intereses | Executive education, Business networking, Leadership development |

### Presupuesto y reach

| Métrica | Valor real |
|---|---|
| Presupuesto diario con $200/14 días | **$14.29/día** |
| CPL benchmark educación ejecutiva LATAM | **$15 USD/lead** |
| Reach estimado con $200 | **1.6M–3.2M personas** |

### Validación

| Métrica | Valor real |
|---|---|
| Criterios Meta superados | **8/8** |
| Bloqueantes | 0 |
| Warnings típicos | 0-1 (fase de aprendizaje si duración < 7 días) |

### Ejemplo de copy generado (real, no inventado)

```
Headline: "Bogotá: Tu círculo de élite te espera."
Body:     "Los líderes más ambiciosos no crecen solos. El 15 de junio en Bogotá,
           te espera un encuentro exclusivo para potenciar tu visión..."
CTA:      "Asegura tu cupo"
```

---

## Qué cambiar en la landing (para Andrew)

### AgentSection.tsx — la sección del agente

Cambiar el tiempo total de "3.0 segundos" a:
```
"< 1 minuto"
```

Los tiempos por tool (los "0.4s", "1.1s", etc.) son visuales de la UI — dejarlos o eliminarlos. No corresponden a tiempos reales de cada tool individual.

### StatusQuo.tsx — el problema

Estos datos **no dependen del backend** — son estimaciones del mercado, están bien:
- `~127 min` para configurar una campaña manualmente → plausible, dejar
- `$2,000 USD` costo de agencia → rango de mercado, dejar
- `~$340 USD` por reset de algoritmo → estimación, dejar

### Inboxes.tsx — el dashboard mock

Los contadores (14 campañas, ROAS 4.8x, etc.) son el mockup visual de la landing — no vienen del backend real. **Dejarlos como están**, son para mostrar cómo luce el producto.

### FeatureTriage.tsx

`"< 1 minuto"` como claim de velocidad es correcto con Gemini.

---

## Cómo reproducir las métricas

```bash
# Con el servidor corriendo:
PYTHONPATH=. .venv/bin/python3 -m uvicorn backend.main:app --port 8000

# En otra terminal:
PYTHONPATH=. .venv/bin/python3 scripts/measure_timings.py
```

El script corre el flujo completo con el prompt de demo e imprime todos los datos.

---

## Script de métricas

Archivo: `scripts/measure_timings.py`

Mide y reporta:
- Tiempo total del flujo
- Audiencia estimada
- Reach con el presupuesto del prompt
- Validaciones pasadas
- Copy generado real (headline, body, CTA)
- Campaign ID de Meta
