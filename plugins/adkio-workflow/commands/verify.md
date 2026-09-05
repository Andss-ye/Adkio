---
name: "Adkio: Verify"
description: "Corre el gauntlet de verificación del repo: tests, build del frontend, higiene de código y atribución"
allowed-tools: Bash(bash *), Bash(git *), Read, Grep
category: "Workflow"
---

Corré la verificación completa del repo y reportá el resultado. No commitees nada.

```
bash "${CLAUDE_PLUGIN_ROOT}/scripts/verify.sh"
```

El script chequea:

1. **pytest** — la suite completa (necesita Python 3.11+ y `backend/requirements.txt`).
2. **Build del frontend** — `tsc -b` + vite, solo si hay cambios en `frontend/`. Es el
   único gate automático del proyecto.
3. **Higiene** — `print()` en el backend, `os.environ` dentro de `tools/` o
   `integrations/` (rompe el multitenant), y tools sin `rationale`.
4. **Atribución** — commits nuevos con co-autoría de Claude.

Después de correrlo:

- Si todo pasó, reportá los números y decí que está listo para `/adkio:checkpoint`.
- Si algo falló, **no lo minimices**: mostrá la salida real y arreglá la causa. Un SKIP
  no es un pase: si dice que falta pytest o `node_modules`, decilo explícitamente para
  que la persona sepa que ese gate no corrió.
