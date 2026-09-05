---
name: "Adkio: Bases"
description: "Audita el trabajo actual contra las bases arquitectónicas no negociables del proyecto"
argument-hint: "[rama base o ruta a auditar]"
allowed-tools: Bash(git *), Read, Grep, Glob
category: "Quality"
---

Audita lo que cambió contra las bases del proyecto. Es una revisión de arquitectura, no
de estilo: buscá cosas que se rompen en silencio, no comas.

Alcance: $ARGUMENTS (si está vacío, el diff contra `main` más lo que no esté commiteado).

## Las bases (docs/CODESTYLE.md §1)

Revisá cada una contra el diff y reportá solo lo que **efectivamente** está mal:

1. **Tools y adapters no leen env ni DB.** Un `os.environ` en `backend/tools/` o
   `backend/integrations/` hace que todos los usuarios lancen campañas con la cuenta de
   ads de otro, y ningún test falla. Las credenciales llegan por parámetro desde
   `services/credential_resolver.py`.
2. **Toda tool devuelve `rationale` y nunca rompe el stream.** Si el LLM devuelve basura,
   ¿degrada a un default y lo explica, o propaga la excepción? Un stream cortado es una
   pantalla en blanco.
3. **El LLM se configura solo en `backend/llm.py`.** Nadie más importa `litellm` ni un
   SDK de proveedor: se pierden los caps de tokens y el log de costo.
4. **HITL estructural.** El stream de `POST /campaign` termina en `plan_ready`; lanzar
   vive en `/campaign/approve`. Las tools de lanzamiento no se exponen al LLM en la fase
   de plan. Toda campaña se crea en PAUSED.
5. **Validación en el borde** con Pydantic y mensajes accionables en español. Sin fugas
   de stack traces al cliente.
6. **Contratos explícitos**: `dataclass(frozen=True)` para datos entre capas, `Protocol`
   para interfaces, `dict` para el I/O de las tools.
7. **Migraciones idempotentes** y numeradas, reflejadas en `schema.sql`. Columnas nuevas
   de `campaigns` sumadas a `_CAMPAIGN_FIELDS` (si no, se descartan en silencio).
8. **Secretos** fuera de logs, errores y tests.

## Patrones ya decididos (§2.1)

¿El diff introduce un patrón distinto para un problema que ya tiene forma? Tool = función
plana; interfaz = `Protocol`; datos entre capas = dataclass frozen; despacho por
plataforma = dict en `adapter_registry`; estado del frontend = props + hooks; navegación =
`switch` en `App.tsx`; llamadas al backend por `lib/api.ts`.

Si aparece uno nuevo, no es automáticamente un error — pero tiene que ser deliberado, ir
en su propio PR y quedar escrito en `docs/CODESTYLE.md`. Dos patrones para el mismo
trabajo es la deuda que hay que evitar.

## Salida

Por cada hallazgo: qué base rompe, el archivo y línea, y qué se rompe concretamente si
queda así. Si no encontrás nada, decilo sin inventar hallazgos menores para justificar la
revisión.
