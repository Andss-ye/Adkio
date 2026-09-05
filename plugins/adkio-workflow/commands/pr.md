---
name: "Adkio: PR"
description: "Abre un PR con el summary del equipo como body, sin atribución a Claude"
argument-hint: "[título del PR]"
allowed-tools: Bash(git *), Bash(gh *), Bash(bash *), Read, Grep
category: "Workflow"
---

Abrí un pull request a `main` con el summary del equipo como body.

Título propuesto: $ARGUMENTS

## Pasos

1. **Chequeos previos.** Confirmá que:
   - No estás en `main` (si lo estás, pará y avisá: el trabajo va en su propia rama).
   - No hay cambios sin commitear. Si hay, corré `/adkio:checkpoint` primero.
   - Ningún commit de la rama tiene atribución a Claude:
     ```
     git log main..HEAD --pretty=%B | grep -iE 'co-authored-by:.*claude|generated with .*claude|noreply@anthropic'
     ```
     Si aparece algo, **no abras el PR**: hay que reescribir esos mensajes primero
     (`git rebase -i` no está disponible acá — usá `git commit --amend` para el último, o
     avisale a la persona qué commits hay que corregir).

2. **Verificá.** `bash "${CLAUDE_PLUGIN_ROOT}/scripts/verify.sh"` para tener números
   reales. Si falla, no abras el PR.

3. **Push** de la rama con upstream: `git push -u origin <rama>`.

4. **Abrí el PR** con `gh pr create`, título en conventional commit y body con el formato
   de `/adkio:summary` (Problema / Solución / Changes / Test Coverage / Verification).

   El body **no lleva** el footer de Claude Code, ni `🤖 Generated with…`, ni links a
   claude.com. Pasá el body por archivo o heredoc para que el markdown no se rompa.

5. Devolvé la URL del PR.

## Reglas

- Los números de Verification salen del paso 2, no de memoria.
- `Closes #N` solo si el issue existe.
- Si el PR toca un contrato, una tabla o una env var, confirmá que `README.md` y
  `.env.example` están actualizados en la misma rama.
- Si el cambio movió algo de "no existe" a "funciona", `docs/STATUS.md` va actualizado.
