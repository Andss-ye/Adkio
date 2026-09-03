---
name: "Adkio: Checkpoint"
description: "Verifica y commitea un bloque de trabajo terminado, con el summary del equipo y sin atribución a Claude"
argument-hint: "[descripción corta del checkpoint]"
allowed-tools: Bash(git *), Bash(bash *), Bash(pytest*), Bash(npm *), Read, Grep
category: "Workflow"
---

Cerrá un checkpoint: verificar que el repo está sano y commitear el trabajo con el
formato del equipo.

Contexto del usuario sobre este checkpoint: $ARGUMENTS

## Qué es un checkpoint

Un bloque de trabajo que **funciona y se sostiene solo**: una feature terminada, un bug
arreglado con su test, un refactor completo. No es "guardar por si acaso" — si el repo
queda a medias, no es checkpoint: seguí trabajando o dividí el cambio.

Si el trabajo pendiente son varios cambios independientes, **hacé un commit por cada
uno**, no uno grande. Un commit = un cambio coherente.

## Pasos

1. **Mirá qué hay.** `git status` y `git diff --stat`. Si no hay nada sin commitear,
   decilo y terminá.

2. **Verificá.** Corré el gauntlet:
   ```
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/verify.sh"
   ```
   Si algo falla, **no commitees**: reportá qué falló y arreglalo primero. Guardá los
   números reales (tests que pasaron, módulos transformados) para el summary.

3. **Auditá contra las bases** del proyecto en lo que cambió. Las que más se pasan por
   alto:
   - Tools y adapters no leen env ni DB (las credenciales vienen del resolver).
   - Toda tool devuelve `rationale` y degrada en vez de romper el stream.
   - Nadie instancia un SDK de LLM fuera de `backend/llm.py`.
   - Columnas nuevas de `campaigns` sumadas a `_CAMPAIGN_FIELDS`, o se descartan en
     silencio.
   - Llamadas del frontend por `lib/api.ts`.
   - Si tocaste un contrato, una tabla o una env var: `README.md` y `.env.example`
     actualizados en el mismo commit.

4. **Rama.** Si estás en `main` o `master`, creá una rama antes de commitear
   (`feat/`, `fix/`, `docs/`, `chore/` + slug corto). Nunca commitees directo a `main`.

5. **Escribí el mensaje.** Conventional commit con scope y descripción en español, en
   imperativo y minúscula. El cuerpo lleva el summary de abajo.

   **Prohibido**: `Co-Authored-By: Claude`, `Generated with Claude Code`, `🤖`, cualquier
   footer de herramienta o link a claude.com. El autor es la persona que pidió el
   trabajo. Hay un hook que bloquea el commit si aparece.

6. **Commiteá** solo los archivos que pertenecen al cambio (`git add` explícito, no
   `git add -A` a ciegas). Después mostrá `git log -1 --stat`.

## Formato del summary (cuerpo del commit y del PR)

Usá exactamente esta estructura, en español, y **omití las secciones que no apliquen**
en vez de rellenarlas con humo:

```
<type>(<scope>): <descripción en imperativo>

## Summary

**Problema:** qué estaba mal y por qué pasaba. Si es un bug, el caso concreto que
falla: entrada → salida incorrecta. Dos o tres oraciones.

**Solución:** qué hace el cambio y por qué así. Si hay una decisión no obvia, el
motivo.

## Changes

- ✅ <cambio concreto y verificable>
- ✅ <otro>

## Test Coverage

- <área>: N escenarios (qué cubren)

## Verification

```bash
pytest                 # N/N passed
npm run build          # ✓ N modules transformed
```

Closes #<issue>
```

Reglas del summary:

- **Los números son reales**, salidos del paso 2. Si no corriste algo, no lo pongas.
- `Closes #N` solo si existe el issue; si no, omitilo (no dejes el placeholder).
- Sin "Test Coverage" si no agregaste tests — y si no agregaste tests para código nuevo,
  decí por qué en el summary.
