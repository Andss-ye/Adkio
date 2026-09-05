#!/usr/bin/env python3
"""
SessionStart — inyecta las bases de Adkio y el estado real del repo al arrancar.

Por qué existe: `CLAUDE.md` ya se carga solo, pero hay detalles que se pasan por
alto justo cuando importan (que las tools no leen env, que las columnas fuera de
_CAMPAIGN_FIELDS se descartan en silencio, que los commits no llevan atribución).
Esto los pone arriba en cada sesión, junto con la rama y si hay trabajo sin
commitear.

Solo actúa dentro del repo Adkio. Silencioso en cualquier otro proyecto.
"""
import json
import os
import subprocess
import sys

BASES = """\
Bases de Adkio que no se negocian (detalle en docs/CODESTYLE.md sección 1):
- Human-in-the-loop es estructural: el stream de POST /campaign termina en plan_ready;
  lanzar vive en POST /campaign/approve. Toda campaña se crea en PAUSED.
- Las tools y los adapters NUNCA leen env ni DB. Las credenciales llegan por parámetro
  desde services/credential_resolver.py, el único módulo que sabe de dónde salen.
- Toda tool devuelve `rationale` y nunca rompe el stream: si algo falla, degradá a un
  default y explicalo ahí.
- El LLM se configura solo en backend/llm.py (env var LLM_MODEL). Nadie más instancia
  un cliente de proveedor.
- Un problema recurrente tiene UNA forma: tool = función plana que devuelve dict;
  interfaz = Protocol; datos entre capas = dataclass frozen; estado del frontend =
  props + hooks; navegación = switch en App.tsx. Patrón nuevo = decisión para todo el
  repo, va en su propio PR.
- Las llamadas del frontend al backend pasan siempre por lib/api.ts.
- Las columnas de `campaigns` que no estén en _CAMPAIGN_FIELDS
  (backend/db/supabase_client.py) se descartan EN SILENCIO al insertar.
- Antes de construir algo, mirá docs/STATUS.md: puede que ya exista o esté bloqueado
  por App Review de un proveedor.

Commits y PRs: conventional commits con scope, descripción en español, y SIN atribución
a Claude (ni Co-Authored-By, ni footer de la herramienta). El autor es la persona.
Hay un hook que bloquea el commit si aparece. Usá /adkio:checkpoint para cerrar un
bloque de trabajo verificado.\
"""


def _repo_root(start="."):
    path = os.path.abspath(start)
    while True:
        if (os.path.isfile(os.path.join(path, "backend", "llm.py"))
                and os.path.isdir(os.path.join(path, "backend", "tools"))):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            return None
        path = parent


def _git(root, args):
    try:
        res = subprocess.run(["git"] + args, cwd=root, capture_output=True,
                             text=True, timeout=10)
        return res.stdout.strip() if res.returncode == 0 else ""
    except Exception:
        return ""


def main():
    cwd = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    root = _repo_root(cwd)
    if not root:
        return

    branch = _git(root, ["rev-parse", "--abbrev-ref", "HEAD"]) or "?"
    status = _git(root, ["status", "--porcelain"])
    dirty = len([ln for ln in status.splitlines() if ln.strip()])
    last = _git(root, ["log", "-1", "--pretty=%s"])

    estado = "rama `{}` · {} archivo(s) sin commitear · último commit: {}".format(
        branch, dirty, last or "—")
    if branch in ("main", "master"):
        estado += "\n⚠️ Estás en {}: las features van en su propia rama (feat/ fix/ docs/ chore/).".format(branch)

    body = "{}\n\nEstado del repo: {}".format(BASES, estado)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": body,
        }
    }), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
