---
name: adkio-bases
description: Reglas críticas del repo Adkio que se rompen en silencio si se ignoran. Cargá esta skill ANTES de escribir o modificar código en backend/tools/, backend/integrations/, backend/agents/, backend/services/credential_resolver.py, backend/llm.py, backend/db/ (migraciones y supabase_client), o llamadas del frontend al backend. También al agregar una tool, una plataforma de ads, un endpoint, una columna o una pantalla. Triggers: "tool", "adapter", "credential", "resolver", "migración", "campaigns", "rationale", "campaign_launcher", "plan_ready", "PAUSED", "multitenant", "apiFetch".
license: MIT
metadata:
  author: Equipo Adkio
  version: "1.0"
---

# Bases del repo Adkio

Estas son las reglas cuya violación **no la detecta ningún test**. El resto del estilo
está en `docs/CODESTYLE.md`; esto es lo que se rompe en silencio.

## 1. Tools y adapters nunca leen env ni DB

Las credenciales llegan **por parámetro**. El único módulo que sabe de dónde salen es
`backend/services/credential_resolver.py`, y se inyecta por request con un `ContextVar`.

```python
# ✅ el adapter recibe lo que necesita
def create_campaign(self, credentials: MetaCreds, spec: CampaignSpec) -> CreateResult: ...

# ✅ la tool pide el resolver vigente, no las credenciales concretas
resolver = get_default_resolver()
creds = resolver.resolve(platform)

# ❌ todos los usuarios lanzan con la cuenta de ads de otro, y los tests siguen verdes
token = os.environ["META_ACCESS_TOKEN"]
```

Es lo único que permite que el mismo código sirva al demo single-tenant (`.env`) y a
producción multitenant (tokens cifrados por cuenta).

## 2. Toda tool devuelve `rationale` y nunca rompe el stream

- `rationale` (1-3 oraciones en español) es lo que el panel de razonamiento muestra en
  vivo. Es el producto, no telemetría.
- Si el LLM devuelve basura o el proveedor falla: **degradá a un default y contalo en el
  `rationale`**. El agente tiene que llegar a `plan_ready` siempre — un stream cortado a
  mitad es una pantalla en blanco.
- Parseo defensivo: regex para el bloque ` ```json `, `json.loads` en `try/except`, y
  `data.get(campo, default)` en cada campo.

```python
    except Exception:
        return {
            "headline": producto[:38] if producto else "Descubrí lo que preparamos",
            "body": "Una propuesta pensada para vos. Conocé los detalles.",
            "cta": "Más información",
            "rationale": "Copy directo alineado al tono de marca y al canal elegido.",
        }
```

## 3. El LLM se configura en un solo lugar

`backend/llm.py`. Cambiar de modelo es cambiar `LLM_MODEL`. No importes `litellm` ni el
SDK de un proveedor en ningún otro módulo: perdés los caps de tokens y el log de costo.

## 4. El human-in-the-loop es estructural

El generador SSE de `POST /campaign` **termina** en `plan_ready`. Lanzar vive en
`POST /campaign/approve`. `campaign_launcher` y `campaign_remover` no se exponen al LLM
durante la planificación. Toda campaña se crea en **PAUSED**: es el guardrail de gasto.

No unas los dos pasos ni le des al agente la tool de lanzar.

## 5. La trampa de `campaigns`

La tabla `campaigns` **no está en `schema.sql`** (se creó a mano). Y peor:
`create_campaign_result` descarta **en silencio** cualquier clave que no esté en
`_CAMPAIGN_FIELDS` (`backend/db/supabase_client.py`).

Agregar una columna = migración numerada e idempotente + `schema.sql` + `_CAMPAIGN_FIELDS`
+ la sección de modelo de datos del `README.md`. Si te falta el tercer paso, el dato se
pierde sin error.

## 6. Un problema, una sola forma

| Problema | La forma que usamos |
|---|---|
| Una tool del agente | función plana módulo-level que devuelve `dict` |
| Una interfaz entre capas | `Protocol` con `@runtime_checkable` |
| Datos que cruzan una frontera | `@dataclass(frozen=True)` |
| Despacho por plataforma | dict en `adapter_registry` |
| Conseguir credenciales | `resolver.resolve(platform)` |
| Validar input externo | modelo Pydantic en el borde |
| Configurar el LLM | `LLM_MODEL` + `call_llm` |
| Estado del frontend | props + hooks locales |
| Navegación | `switch` en `App.tsx` |
| Llamadas al backend | `lib/api.ts` (`apiFetch`) |

Un patrón nuevo se decide para todo el repo, en su propio PR, y se escribe en
`docs/CODESTYLE.md`. Dos patrones para el mismo trabajo es la deuda que hay que evitar.

## 7. Antes de construir, mirá si ya existe

`docs/STATUS.md` es el inventario real: qué funciona, qué está bloqueado por App Review de
Meta / TikTok / Google, y la deuda técnica conocida. Varias features "faltantes" ya están
hechas, y varias "hechas" están bloqueadas por un tercero.

## 8. Commits y PRs

Conventional commits con scope y descripción en español. **Sin atribución a Claude**: ni
`Co-Authored-By`, ni footer de herramienta, ni `🤖`. El autor es la persona. Hay un hook
que bloquea el commit si aparece.

Usá `/adkio:checkpoint` para cerrar un bloque verificado, `/adkio:bases` para auditar un
diff contra esta lista.

## Recetas de extensión

Están en `docs/CODESTYLE.md` §4: cómo agregar una tool, una plataforma de ads, un
endpoint, una columna o una pantalla sin pelearse con la arquitectura. Leelas antes de
improvisar la estructura.
