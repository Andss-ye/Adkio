---
name: "Adkio: Summary"
description: "Genera el summary del equipo (Problema/Solución/Changes/Test Coverage/Verification) para el trabajo actual, sin commitear"
argument-hint: "[rama base, por defecto main]"
allowed-tools: Bash(git *), Bash(bash *), Read, Grep
category: "Workflow"
---

Generá el summary del trabajo actual con el formato del equipo, sin commitear ni pushear
nada. Sirve para pegarlo en un PR, en una descripción de issue o en el canal del equipo.

Rama base para el diff: $ARGUMENTS (si está vacío, usá `main`).

## Pasos

1. Sacá el alcance real: `git diff --stat <base>...HEAD` más `git status --porcelain`
   para lo que todavía no está commiteado. Leé el diff de lo que importe — el summary
   describe lo que **hace** el cambio, no lista archivos.

2. Corré la verificación para tener números reales:
   ```
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/verify.sh"
   ```

3. Escribí el summary con esta estructura, en español, omitiendo lo que no aplique:

```
## Summary

**Problema:** qué estaba mal y por qué pasaba. Si es un bug, el caso concreto:
entrada → salida incorrecta.

**Solución:** qué hace el cambio y por qué así.

## Changes

- ✅ <cambio concreto>

## Test Coverage

- <área>: N escenarios (qué cubren)

## Verification

```bash
pytest                 # N/N passed
npm run build          # ✓ N modules transformed
```

Closes #<issue>
```

## Reglas

- **Números reales solamente.** Si no corriste un gate, no lo pongas en Verification.
- Sin atribución a Claude ni footers de herramienta.
- `Closes #N` solo si el issue existe; si no, omitilo.
- Si el cambio toca las bases del proyecto (ver `docs/CODESTYLE.md` §1) o introduce un
  patrón que no está en la tabla de §2.1, decilo explícito en la Solución: eso pasa a
  ser el patrón para todo el repo.
- Si el cambio mueve algo de "no existe" a "funciona", agregá una línea recordando
  actualizar `docs/STATUS.md`.
