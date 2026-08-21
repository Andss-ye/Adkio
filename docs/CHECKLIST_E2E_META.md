# Checklist E2E — cliente real Meta

Para el equipo. Dry-run antes del lunes y **guion de referencia** para el screencast de App Review ([ADK-13](https://linear.app/adkio/issue/ADK-13)): no es palabra por palabra; deja espacio para improvisar, pero el arco tiene que sonar humano.

**Cuenta de prueba:** Adkio del equipo + ad account **tester nuestra**. Nunca la de un cliente en producción.

**Fuera de alcance este mes:** TikTok y Google Ads — no aplica.

---

## Setup mínimo

1. Entra con la cuenta del equipo.
2. Conecta Meta por el camino que esté disponible ese día (OAuth o API key en Settings). Si OAuth muestra “App no verificada”, usa el otro.
3. Confirma que la ad account es la **tester** (no una con tarjeta de cliente).
4. En Meta Ads Manager, pon un **spend limit** bajo en esa cuenta antes de aprobar nada.

---

## Capa A — Hoy (`main`)

### Flujo feliz

Abre `/app`, pide una campaña en lenguaje natural (presupuesto chico, audiencia clara). Mira el razonamiento en vivo hasta el plan. Aprueba.

**Expected:** en Ads Manager aparece una campaña **PAUSED**, con id real, y **$0 gastado**. En Adkio no figura como mock.

Si no hay Meta conectada: el agente igual llega al plan; al aprobar, la UI marca **mock**. Eso está bien — no lo presentes como real.

### Fallas conocidas (casos borde)

| Caso | Qué pasa hoy | Expected / qué hacer |
|---|---|---|
| **1 ad account** | Se asocia esa cuenta y se crea en PAUSED | Id real, no mock, $0 |
| **N ad accounts** | Puede quedar la cuenta equivocada (la primera / la que se pegó) | Riesgo de bolsillo incorrecto. Workaround: conectar a mano el `act_…` tester correcto hasta que exista el picker |
| **Sin page** | En Meta solo queda el cascarón de campaña (sin anuncio completo) | No digas que “ya está lista para leads”. Conecta con page de la tester |
| **Mock vs real** | Sin conexión → mock honesto; con tester → real PAUSED | La UI tiene que decir la verdad |
| **Spend limit** | Adkio no impone tope de gasto en Meta | El tope vive en Meta. El warning de presupuesto de marca en el plan es aviso, no candado. PAUSED = no gasta |

### Esperas reales

- **OAuth / App Review:** ~2 semanas. Mientras tanto el dry-run puede ir por mock o por conexión tester manual.
- **Tokens:** los cortos mueren en ~1 h; los de larga duración ~60 días. Si “se desconectó solo”, renovar.
- **PAUSED:** cero gasto hasta la feature de activar ([ADK-21](https://linear.app/adkio/issue/ADK-21)). No actives a mano en Ads Manager en este checklist.
- **Métricas D+1:** en espera de [ADK-9](https://linear.app/adkio/issue/ADK-9), [ADK-16](https://linear.app/adkio/issue/ADK-16) y dashboard [ADK-15](https://linear.app/adkio/issue/ADK-15). Hoy no hay resultados post-lanzamiento en producto.

---

## ¿Cliente listo para gastar?

Cuando alguien diga “ya podemos gastar plata de verdad”, tienen que cumplirse **todos**:

| Criterio | Hoy |
|---|---|
| Ad account correcta (no la primera a ciegas) | Falla — falta picker / wire |
| Page propia del negocio (no la de Adkio) | Falla a menudo |
| Campaña real (`is_mock` falso) | Cumplible con tester |
| Spend limit puesto en Meta | Cumplible a mano |
| PAUSED verificado en Ads Manager | Cumplible |
| Activar solo con gesto explícito en Adkio | Todavía no ([ADK-21](https://linear.app/adkio/issue/ADK-21)) |
| Resultados en Adkio = Ads Manager | Todavía no |

Si falta uno de los de arriba, **no** está listo para gastar.

---

## Capa B — 2ª iteración (cuando aterricen los fixes)

Vuelve a correr este checklist cuando existan:

| Qué debería pasar | Linear |
|---|---|
| Elegir ad account / page / IG antes de aprobar | [ADK-7](https://linear.app/adkio/issue/ADK-7), [ADK-14](https://linear.app/adkio/issue/ADK-14), [ADK-19](https://linear.app/adkio/issue/ADK-19), [ADK-23](https://linear.app/adkio/issue/ADK-23) |
| Page y ad account del cliente en el launch (no las nuestras) | [ADK-20](https://linear.app/adkio/issue/ADK-20) |
| Aviso + guía de spend limit en producto | [ADK-8](https://linear.app/adkio/issue/ADK-8), [ADK-22](https://linear.app/adkio/issue/ADK-22) |
| Botón HITL “Activar y empezar a gastar” (PAUSED → ACTIVE) | [ADK-21](https://linear.app/adkio/issue/ADK-21) |
| Métricas diarias + dashboard = lo mismo que Ads Manager | [ADK-9](https://linear.app/adkio/issue/ADK-9), [ADK-15](https://linear.app/adkio/issue/ADK-15), [ADK-16](https://linear.app/adkio/issue/ADK-16) |

Expected de esa pasada: N cuentas ya no es trampa; sin page se bloquea o se pide; mock vs real sigue claro; activar es consciente; al día siguiente las métricas en Adkio cuadran con Meta.

---

## Guion de referencia — screencast (ADK-13)

Ritmo de video corto. Improvisa el texto; no pierdas estos beats:

1. **Gancho (5–10 s):** “Armar una campaña en Meta no debería ser media tarde.” Muestra el vacío: sin spreadsheet, sin siete pantallas.
2. **Conectar:** un click / pegar tester. Si sale el muro de app no verificada, nómbralo en una frase y sigue por el camino que funcione — honestidad > magia.
3. **El wow:** prompt en lenguaje natural → el agente piensa en vivo (presupuesto, audiencia, copy). Deja respirar el stream; es el producto.
4. **Alivio:** “Nada se publica solo.” Aprueba → PAUSED. Cierra con: **cero gasto hasta que tú lo digas**. Corta ahí. No actives.

---

## No hacer en el dry-run

- Activar la campaña en Ads Manager “para ver qué pasa”.
- Usar ad account o page de un cliente real.
- Mostrar un mock y decir que “ya está en Meta”.
- Saltar el spend limit en la cuenta tester.
