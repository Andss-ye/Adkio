#!/usr/bin/env python3
"""
Stop — avisa si quedó trabajo sin commitear al terminar el turno.

Deliberadamente NO bloquea. Un hook de Stop que devuelve `decision: block` fuerza al
modelo a seguir trabajando, y "hay cambios sin commitear" es una condición que puede
seguir siendo verdadera después de que el modelo responda: eso da un loop. Acá solo
emitimos `systemMessage`, que se le muestra a la persona y no reinyecta al modelo.

Decidir qué es un checkpoint es un juicio humano (o del modelo con contexto), no algo
que un hook pueda inferir. El hook recuerda; `/adkio:checkpoint` hace el trabajo.
"""
import json
import os
import subprocess


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


def main():
    root = _repo_root(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    if not root:
        return

    try:
        res = subprocess.run(["git", "status", "--porcelain"], cwd=root,
                             capture_output=True, text=True, timeout=10)
    except Exception:
        return
    if res.returncode != 0:
        return

    lines = [ln for ln in res.stdout.splitlines() if ln.strip()]
    if not lines:
        return

    # Ignoramos archivos sin trackear que son ruido de herramientas.
    relevant = [ln for ln in lines if not ln.startswith("?? node_modules")]
    if not relevant:
        return

    print(json.dumps({
        "systemMessage": (
            "adkio-workflow: {} archivo(s) sin commitear. Si esto cierra una feature o "
            "un bloque que funciona, corré /adkio:checkpoint para verificar y commitear."
            .format(len(relevant))
        )
    }), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
