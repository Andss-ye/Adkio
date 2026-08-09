# Code style — Adkio

Cómo está programado este proyecto y cómo mantenerlo así mientras crece.

El documento tiene tres partes:

1. **[Las bases](#1-las-bases--no-negociables)** — los invariantes que hacen que Adkio escale. Si
   rompés uno, algo se rompe en silencio: no hay test que te avise.
2. **[Dónde tenés libertad](#2-dónde-tenés-libertad)** — lo que es decisión de cada dev. No pidas
   permiso acá.
3. **[Cómo se escribe hoy](#3-cómo-se-escribe-hoy)** — los patrones concretos del repo, para que
   código nuevo se lea como el que ya está.

Y al final, [recetas](#4-recetas-para-extender-el-sistema) para agregar una tool, una plataforma, un
endpoint o una pantalla sin pelearte con la arquitectura.

Si algo acá contradice al código de un archivo, gana el archivo — y avisá para actualizar este doc.

---

## 1. Las bases — no negociables

### 1.1 Tools y adapters nunca leen env ni DB

Las credenciales llegan **por parámetro**. El único módulo que sabe de dónde salen es
`backend/services/credential_resolver.py`, y se inyecta por request con un `ContextVar`.

```python
# ✅ el adapter recibe lo que necesita
def create_campaign(self, credentials: MetaCreds, spec: CampaignSpec) -> CreateResult: ...

# ✅ la tool pide el resolver vigente, no las credenciales concretas
resolver = get_default_resolver()
creds = resolver.resolve(platform)

# ❌ mata el multitenant sin que falle ningún test
token = os.environ["META_ACCESS_TOKEN"]
```

**Por qué es una base:** es lo único que permite que el mismo código sirva al demo single-tenant
(credenciales del `.env`) y a producción multitenant (credenciales cifradas por cuenta). Un
`os.environ` dentro de una tool hace que todos los usuarios lancen campañas con la cuenta de ads de
otro, y los tests siguen verdes.

### 1.2 Toda tool devuelve `rationale`, y ninguna rompe el stream

```python
    except Exception:
        return {
            "headline": producto[:38] if producto else "Descubrí lo que preparamos",
            "body": "Una propuesta pensada para vos. Conocé los detalles y dá el primer paso hoy.",
            "cta": "Más información",
            "rationale": "Copy directo alineado al tono de marca y al canal elegido.",
        }
```

Tres reglas que van juntas:

- **`rationale`** (1-3 oraciones en español) es lo que el panel de razonamiento muestra en vivo. Es
  el producto, no telemetría. Sin `rationale`, la UI queda vacía.
- **Degradá, no explotes.** Si el LLM devuelve basura o el proveedor falla, caé a un default
  razonable y contá la degradación en el `rationale`. El agente tiene que llegar a `plan_ready`
  siempre: un stream cortado a mitad es una pantalla en blanco.
- **Parseo defensivo del JSON del LLM**: regex para el bloque ` ```json ` + `json.loads` dentro de
  `try/except`, y `data.get(campo, default)` en cada campo. Nunca asumas que el modelo respetó el
  formato.

### 1.3 El LLM se configura en un solo lugar

`backend/llm.py` y nada más. Cambiar de modelo es cambiar `LLM_MODEL`. No llames a `litellm`,
`anthropic` ni a ningún SDK de proveedor por fuera de `call_llm` — perdés los caps de tokens y el
log de costo.

### 1.4 El human-in-the-loop es estructural

El generador SSE de `POST /campaign` **termina** en `plan_ready`. El lanzamiento vive en
`POST /campaign/approve`. `campaign_launcher` y `campaign_remover` no se exponen al LLM durante la
planificación.

No "optimices" esto uniendo los dos pasos ni dándole al agente la tool de lanzar: la aprobación
humana y el estado **PAUSED** son el guardrail de gasto del producto.

### 1.5 Validar en el borde, con mensajes que sirvan

Todo input externo entra por un modelo Pydantic v2 con validadores. El mensaje de error le dice al
usuario qué escribir, no solo que se equivocó:

```python
raise ValueError(
    "Contame qué querés promocionar, con qué presupuesto y a quién. "
    "Ej: \"Vender curso de marketing a pymes en México, $300 por 14 días\"."
)
```

Limpieza de caracteres de control, longitudes máximas, regex en IDs (`^[a-zA-Z0-9_\-]{1,64}$`) y
tope de tamaño de payload. Los errores inesperados los toma el handler global: **nunca** filtres
stack traces ni mensajes del proveedor al cliente.

### 1.6 Contratos explícitos entre capas

- **Datos que cruzan una frontera**: `@dataclass(frozen=True)` (`CampaignSpec`, `CreateResult`,
  `MetaCreds`). Inmutables, con `field(default_factory=dict)` para los mutables.
- **Interfaces**: `Protocol` con `@runtime_checkable` (`PlatformAdapter`, `CredentialResolver`), no
  clases base abstractas. Se cumplen por estructura, sin heredar.
- **I/O de tools**: `dict`, porque el LLM las serializa a JSON. No las conviertas a Pydantic.

### 1.7 Migraciones idempotentes y en orden

Un archivo por cambio en `backend/db/migrations/00N_descripcion.sql`, siempre con
`IF NOT EXISTS` / `IF EXISTS`, con cabecera que explique qué problema resuelve. `schema.sql` es el
estado consolidado: si agregás una migración, reflejala ahí.

Ojo con `_CAMPAIGN_FIELDS` en `db/supabase_client.py`: las claves que no estén en ese set se
**descartan en silencio** al insertar. Agregar una columna a `campaigns` implica tocar la migración,
`schema.sql` y ese set.

### 1.8 Secretos

Tokens, passwords y contenido de `platform_connections` **nunca** van a logs, respuestas de error ni
tests. Las credenciales de producción viven en Railway Variables. Al `.env` no se le hace commit.

---

## 2. Dónde tenés libertad

La libertad es **hacia adentro de las piezas**, no sobre la forma de las piezas ni de las costuras
entre ellas (eso está en [2.1](#21-el-límite-libertad-de-implementación-no-de-arquitectura)).
Dentro de ese límite, estas decisiones son tuyas y no hace falta consenso ni consultar:

- **Cómo resolvés el interior de una tool**: cuántos helpers, si armás el prompt por partes, si
  agregás una tabla de benchmarks o un cálculo determinístico en vez de otra llamada al LLM. Lo que
  importa es la firma, el `rationale` y que no explote.
- **La redacción de los prompts.** Iterá libremente. Son el producto y mejoran probando.
- **Cómo componés el frontend**: cuántos componentes, dónde cortás, si extraés un hook, si preferís
  un `switch` o un mapa de configuración. Mientras las llamadas pasen por `lib/api.ts` y los colores
  salgan de los tokens existentes, la forma es tuya.
- **Micro-decisiones de estilo**: nombres locales, si sacás una variable intermedia, orden de los
  helpers dentro del archivo, comentarios que te parezcan útiles.
- **Qué fixtures agregás, cuánto parametrizás, qué casos borde cubrís.** (La *organización* del
  archivo de test no: seguí la de sus vecinos — ver las deudas de consistencia en 2.1.)
- **Refactors internos** que no cambien una firma pública ni un contrato entre capas.
- **Proponer un cambio a las bases.** Ninguna es sagrada por antigüedad; lo que no se hace es
  romperlas en silencio. Cambiala explícitamente, en su propio PR, con el motivo.

### 2.1 El límite: libertad de implementación, no de arquitectura

Todo lo de arriba es **cómo resolvés lo de adentro**. La *forma* de las piezas y de las costuras
entre ellas ya está decidida, y no es preferencia estética: es lo que permite que cualquiera abra un
archivo que no escribió y sepa dónde está todo.

Cada problema recurrente de este repo tiene **una sola forma** de resolverse:

| Problema | La forma que usamos | No |
|---|---|---|
| Una tool del agente | función plana módulo-level que devuelve `dict` | clase, factory, registry propio, método de un servicio |
| Una interfaz entre capas | `Protocol` con `@runtime_checkable` | ABC, herencia, mixins |
| Datos que cruzan una frontera | `@dataclass(frozen=True)` | dict suelto, Pydantic, namedtuple |
| Elegir implementación por plataforma | dict de despacho en `adapter_registry` | `if/elif` por plataforma repartido, subclases del adapter |
| Conseguir credenciales | `resolver.resolve(platform)` | leer env o DB en el punto de uso, singleton propio, DI container |
| Validar input externo | modelo Pydantic con validadores en el borde | chequeos a mano dentro del handler |
| Configurar el LLM | `LLM_MODEL` + `call_llm` | instanciar un cliente del proveedor donde haga falta |
| Estado del frontend | props + hooks locales | Redux, Zustand, Context global |
| Navegación | `switch` en `App.tsx` | react-router u otro router |

Si el patrón que necesitás no está en esa tabla, elegí el que te parezca — acabás de decidirlo para
todos. Escribilo acá en el mismo PR.

**La regla anti-entropía:** el costo no es el patrón nuevo, son **dos patrones para el mismo
trabajo**. Si traés uno mejor, el PR migra todos los casos existentes o no entra. Dos formas de
hacer lo mismo obligan a cada dev a decidir de nuevo en cada archivo, y ahí es donde la libertad se
vuelve contraproducente.

Hoy hay tres deudas de consistencia, y son deuda, no precedente:

- **Los dos agentes tienen forma distinta**: `campaign_agent` son funciones async planas
  (`run_campaign_agent`, `approve_and_launch`, `refine_plan`) y `onboarding_agent` es una clase
  `OnboardingAgent` con una instancia módulo-level. Para un agente nuevo seguí el de funciones
  planas: es el que usa el flujo principal y el que se testea sin instanciar nada.
- **Dos organizaciones de tests**: clases `Test<Sujeto>` en `test_tools.py` / `test_endpoints.py`,
  funciones planas en el resto.
- **Dos formas de tipar opcionales**: `Optional[X]` en 58 lugares, `X | None` en 2.

Respetá la del archivo que tocás y no las tomes como permiso para abrir una tercera.

**Avisá antes de:** agregar una dependencia, tocar un contrato entre capas, sumar una librería al
frontend (el stack es deliberadamente chico: React + Tailwind y nada más), o introducir un patrón
que no esté en la tabla.

---

## 3. Cómo se escribe hoy

### 3.1 Idioma

| Qué | Idioma |
|---|---|
| Variables, funciones, clases, archivos | inglés (`create_campaign`, `resolve`, `CredentialResolver`) |
| Campos de dominio que ya existen en DB o en las tools | español (`negocio_nombre`, `presupuesto_max_campana_usd`, `monto_usd`, `rationale`) |
| Docstrings y comentarios | español rioplatense (inglés está bien si el archivo ya lo usa) |
| Mensajes de error visibles al usuario | español |
| Logs | inglés, minúsculas, formato `key=value` |
| Commits, PRs, docs | español |

No mezcles idiomas dentro de un identificador: `get_presupuesto` ❌ → `get_budget` o
`presupuesto_maximo`, según el lado de la frontera en que esté.

### 3.2 Python

Python **3.11+**, ~100 columnas, 4 espacios, comillas dobles. Imports en tres bloques (stdlib ·
terceros · `backend.*`), **siempre absolutos**: `from backend.tools.copy_generator import
copy_generator`. `from __future__ import annotations` en módulos nuevos con tipos compuestos.
`Optional[X]` en vez de `X | None` (58 usos contra 2 — seguí la mayoría).

No hay formateador en CI. Si corrés uno, `ruff format` con `line-length = 100`, y no reformatees
archivos que no tocaste.

**Docstrings de módulo**: todo módulo abre explicando qué hace y **por qué existe**. Los módulos de
contrato (`integrations/base.py`, `services/credential_resolver.py`) documentan el contrato completo
ahí — es lo que se lee antes de implementar:

```python
"""
Credential resolver — abstrae *de dónde* salen las credenciales de plataforma.

Single-tenant: `EnvCredentialResolver` lee del `.env` del proceso.
Multitenant:   `DBCredentialResolver(account_id)` lee `platform_connections` y
               desencripta los tokens con Fernet.

Devuelve `None` si la plataforma no está configurada (en vez de excepción, para que
el caller decida el fallback). Lanza `ValueError` solo si el nombre es inválido.
"""
```

**Separadores de sección** en archivos largos, con `─` (U+2500) cerrando a ~76 columnas:

```python
# ── Rate limiter (in-memory, no Redis needed for demo) ─────────────────────
```

**Comentarios**: explicá la decisión, el gotcha del proveedor, la razón del fallback. El código ya
dice *qué* hace.

**Logging** con `logging`, nunca `print` (excepción: la validación de env vars antes de configurar
logging, que va a `stderr`). Interpolación con `%s` **por parámetro**, no f-strings, para que el
formateo sea perezoso:

```python
logger.info("llm call model=%s prompt=%d total=%d elapsed=%.2fs", ...)
logger.warning("No se pudo resolver la marca de la cuenta: %s", exc)
```

**Excepciones**: `except Exception` solo con una razón escrita al lado (`# noqa: BLE001` si aplica) y
siempre logueando o degradando de forma visible. Nada de `except: pass` silencioso salvo en
telemetría no crítica (el bloque de `usage` en `llm.py`). No uses excepciones para flujo esperado:
el resolver devuelve `None`, no lanza.

### 3.3 FastAPI

Un `BaseModel` por request, definido inmediatamente arriba del endpoint que lo usa. Validación con
`@field_validator` / `@model_validator(mode="after")`. Rate limit explícito en cada endpoint
(`@limiter.limit("10/minute")`). Los endpoints que gastan tokens del LLM llevan
`_auth: None = Depends(require_api_key)`. `HTTPException` para lo esperado.

### 3.4 SQL

`snake_case`, campos de dominio en español, `TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
`UUID DEFAULT gen_random_uuid()`. Cabecera en caja completa como en las migraciones existentes.

### 3.5 TypeScript / React

2 espacios, punto y coma sí, ~100 columnas. Comillas simples en `components/`, dobles en `lib/` —
respetá el archivo. Sin ESLint en CI; el gate es que `npm run build` (`tsc -b`) pase limpio.

Un componente por archivo, `export default function`, props con un alias local `type Props`, sin
`React.FC`, defaults en la desestructuración:

```tsx
type Props = { status: CampaignStatus; size?: 'sm' | 'xs' };

export default function StatusBadge({ status, size = 'sm' }: Props) { ... }
```

Imports internos con el alias `@/`. Hooks en `src/hooks/`, prefijo `use`, uno por archivo.
Componentes agrupados por superficie: `landing/`, `dashboard/`, `app/`, `shell/`, `settings/`, y
`ui/` para primitivas sin lógica de dominio.

**Estilos**: Tailwind para layout, espaciado y tipografía; **estilos inline para colores derivados en
runtime** (`background: \`${color}14\``) porque el JIT de Tailwind no ve clases dinámicas. Los tokens
vivos están en `index.css`, `tailwind.config.ts` (`brand: '#3D81E3'`) y `lib/dashboard-data.ts`
(`STATUS_COLORS`) — reusalos antes de inventar un hex. Fuentes: Inter (sans), Cormorant Garamond
(serif, solo landing), mono del sistema con fallback a JetBrains Mono para IDs y `campaign_id`.
Contenido ancho scrollea en su propio contenedor; la página nunca scrollea en horizontal.

**Llamadas al backend**: todo por `lib/api.ts` (`apiFetch` / `apiUrl`), que agrega `X-API-Key` y el
`Bearer` de `localStorage`. Los errores se normalizan con `errorMessageFromDetail`, que cubre el
`detail` como array de Pydantic — al usuario nunca le mostrás `[object Object]`.

### 3.6 Tests

`pytest` con `asyncio_mode = auto`: las corrutinas no llevan decorador. `tests/` espeja la
estructura de `backend/`.

**Sin red, sin credenciales, sin DB real.** Los adapters con dobles; el resolver con un `dict` de
entorno inyectado, no parcheando `os.environ` global:

```python
creds = EnvCredentialResolver(environ={"META_APP_ID": "1", ...}).resolve("meta")
```

Fixtures compartidas en `tests/conftest.py` (`brand_config`, helpers de respuesta del LLM), no
duplicadas por archivo. Nombres de test en español, un assert conceptual por test. Las dos
organizaciones que coexisten son deuda (ver 2.1): `test_tools.py` y `test_endpoints.py` agrupan en
clases `Test<Sujeto>`, los tests de adapters y del resolver son funciones planas. Seguí la del
archivo o la de su carpeta; no abras una tercera.

`tests/integrations/test_contract.py` es el test más importante del repo: parametriza los tres
adapters y verifica que cumplan el `Protocol`. Si agregás una plataforma, tiene que pasar **sin que
lo toques**.

### 3.7 Git

Ramas `feat/`, `fix/`, `docs/`, `chore/` con slug corto, base desde el `main` más reciente, PR a
`main`. Conventional commits con scope, descripción en español, imperativo y minúscula:

```
feat(dashboard): rediseño con hero, featured cards y tabla responsive
fix(env): replace GROQ_API_KEY with ANTHROPIC_API_KEY in startup validation
docs(adr): add ADR-001 for Railway production deploy
```

Un commit = un cambio coherente; no mezcles refactor con feature. El PR dice qué hace, qué archivos
toca y qué dependencias agrega. Si cambiaste un contrato, una tabla o una env var, incluí la
actualización de `README.md` y `.env.example` en el mismo PR.

---

## 4. Recetas para extender el sistema

### Agregar una tool al agente

1. `backend/tools/<nombre>.py` con una función `<nombre>(...) -> dict` que devuelva `rationale`.
2. Registrala en `_TOOL_DEFINITIONS` (`agents/campaign_agent.py`) y en el despacho del loop.
3. Decidí qué parámetros ve el LLM y cuáles inyecta el agente: el schema expuesto es **más chico**
   que la firma de Python (`brand_config`, `audiencia` y `presupuesto_usd` los pone el agente).
4. Si va antes de `plan_ready`, sumala al orden del system prompt. Si es de ejecución, va en
   `approve_and_launch`, **no** en las definiciones que ve el LLM.
5. Tests en `tests/test_tools.py` con el LLM mockeado, incluyendo el camino de degradación.

### Agregar una plataforma de ads

1. `backend/integrations/<plataforma>_adapter.py` que cumpla `PlatformAdapter` (no heredes nada).
2. Dataclass de credenciales en `integrations/credentials.py`.
3. Entrada en `_ADAPTERS` (`adapter_registry.py`) y rama en `EnvCredentialResolver` +
   `DBCredentialResolver`.
4. `platform` al `CHECK` de `platform_connections` (migración nueva) y a los validadores de
   `platform_hint`.
5. Si la plataforma no permite hard-delete, devolvé `DeleteResult(soft_delete=True, ...)` y que el
   `rationale` lo diga: la UI tiene que ser honesta.
6. `test_contract.py` debe pasar sin modificarlo. Sumá los tests específicos del adapter aparte.

### Agregar un endpoint

Modelo Pydantic arriba del handler, `@limiter.limit(...)`, `Depends(require_api_key)` si toca el
LLM, y decidí si es público (agregalo a `PUBLIC_PREFIXES` / `PUBLIC_SUFFIXES` en
`middleware/tenant.py`) o si lee `request.state.account_id`. Documentalo en la tabla de API del
`README.md`.

### Agregar una columna o tabla

Migración numerada e idempotente → reflejala en `schema.sql` → si es de `campaigns`, agregala a
`_CAMPAIGN_FIELDS` o se descarta en silencio → actualizá la sección de modelo de datos del `README.md`.

### Agregar una pantalla

Nueva `pages/<Pagina>.tsx` + rama en el `switch` de `App.tsx` (no metas react-router). Componentes
propios de esa superficie en su carpeta; lo reutilizable a `components/ui/`.
