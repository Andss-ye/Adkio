# Guion corto — screencast App Review Meta (ADK-13)

Video de **3–5 minutos**. Lo graba Jonathan. Pegar el link en un comentario de [ADK-13](https://linear.app/adkio/issue/ADK-13).

Referencia de beats: [`CHECKLIST_E2E_META.md`](./CHECKLIST_E2E_META.md). Este archivo es el guion hablado; improvisa, no leas en voz de robot.

**Cuenta:** Adkio del equipo + ad account **tester**. No uses cuenta de cliente. **No actives** la campaña (corta en PAUSED).

**URLs a mencionar o tener abiertas:** `/privacidad`, `/términos` (o `/terminos`), flujo app.

---

## Antes de grabar (30 s en silencio)

- Login hecho.
- Meta conectada por el camino que funcione ese día (OAuth o API key).
- `/app` listo; Ads Manager a mano para el cierre (opcional pero fuerte).

---

## Guion (aprox. tiempos)

### 0:00–0:20 — Gancho
> “Esto es Adkio: planificamos y lanzamos campañas en Meta desde lenguaje natural, con una persona aprobando antes de gastar.”

Muestra landing o dashboard. Una frase, sin pitch largo.

### 0:20–0:50 — Permisos / conectar Meta
> “El usuario conecta su cuenta de Meta. Pedimos permisos de anuncios para crear y leer campañas en su ad account.”

Muestra Settings / Conectar Meta. Si sale “app no verificada”, dilo en una frase y sigue por el camino tester — honestidad.

### 0:50–2:30 — Plan en vivo (el wow)
> “Escribo qué quiero promocionar, presupuesto y a quién. El agente razona en vivo: presupuesto, audiencia, canal, copy.”

Prompt corto en `/app`. Deja ver el stream (`tool_start` / razonamiento). No cortes el momento.

### 2:30–3:30 — Aprobación humana
> “Nada se publica solo. Yo reviso el plan y apruebo.”

Click en aprobar.

> “La campaña se crea en Meta en pausa: cero gasto hasta que alguien la active a propósito.”

Si puedes, 5 s en Ads Manager mostrando PAUSED / $0.

### 3:30–4:00 — Cierre + legales
> “Política de privacidad y términos están en el sitio; explican qué datos usamos y que Meta solo se toca con la cuenta que el usuario conecta.”

Flash de `/privacidad` o footer. Cortar.

**No digas:** que ya está Active, que garantizan leads, ni features que aún no existen.

---

## Checklist post-grabación

1. Subir (Loom / Drive / YouTube unlisted).
2. Comentario en ADK-13 con el link.
3. Confirmar que `/privacidad` y `/terminos` en producción (o staging estable) muestran el copy nuevo tras el merge.
