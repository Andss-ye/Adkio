#!/usr/bin/env python3
"""
PostToolUse — revisa el archivo recién editado contra las bases de Adkio.

Las bases están escritas en `docs/CODESTYLE.md` sección 1, pero un documento se
puede pasar por alto. Esto las vuelve determinísticas: después de cada Edit/Write,
el archivo se relee del disco y se chequean las reglas que aplican a su ruta.

No bloquea nada — devuelve `additionalContext` con los hallazgos para que el modelo
los corrija antes de seguir. Silencioso cuando no hay nada que decir.

Solo actúa dentro del repo Adkio (detectado por `backend/llm.py` +
`backend/tools/`), así el plugin no molesta en otros proyectos del equipo.
"""
import json
import os
import re
import sys


def _repo_root(start):
    """Sube desde `start` buscando la raíz del repo Adkio. None si no es Adkio."""
    path = os.path.abspath(start)
    while True:
        if (os.path.isfile(os.path.join(path, "backend", "llm.py"))
                and os.path.isdir(os.path.join(path, "backend", "tools"))):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            return None
        path = parent


def _rel(path, root):
    try:
        return os.path.relpath(path, root).replace(os.sep, "/")
    except ValueError:
        return path


def _campaign_fields(root):
    """Lee el set _CAMPAIGN_FIELDS de supabase_client.py. Vacío si no se puede."""
    path = os.path.join(root, "backend", "db", "supabase_client.py")
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            src = fh.read()
    except OSError:
        return set()
    match = re.search(r"_CAMPAIGN_FIELDS\s*=\s*\{(.*?)\}", src, re.DOTALL)
    if not match:
        return set()
    return set(re.findall(r"[\"']([a-zA-Z0-9_]+)[\"']", match.group(1)))


def _check(rel_path, text, root):
    """Devuelve la lista de hallazgos para un archivo ya editado."""
    out = []
    is_py = rel_path.endswith(".py")
    is_front = rel_path.startswith("frontend/src/")
    basename = os.path.basename(rel_path)

    reads_env = re.search(r"\bos\.(environ|getenv)\b", text)
    # Scripts de línea de comandos: su salida ES stdout, no logging.
    is_cli_script = rel_path in ("backend/db/seed.py",) or rel_path.startswith("scripts/")

    # ── Base: las tools nunca leen env ni DB, y siempre devuelven rationale ──
    if rel_path.startswith("backend/tools/") and is_py and basename != "__init__.py":
        if reads_env:
            out.append(
                "`{}` lee variables de entorno (os.environ/os.getenv). Las tools no "
                "leen env ni DB: las credenciales llegan por parámetro desde el "
                "credential_resolver (CODESTYLE 1.1).".format(rel_path)
            )
        # `rationale` solo aplica a las tools que devuelven dict al agente.
        # report_generator devuelve markdown (-> str) y queda fuera por diseño.
        returns_dict = re.search(r"\)\s*->\s*dict", text)
        if returns_dict and '"rationale"' not in text and "'rationale'" not in text:
            out.append(
                "`{}` no menciona `rationale`. Toda tool del agente devuelve ese campo "
                "— es lo que el panel de razonamiento muestra en vivo (CODESTYLE 1.2)."
                .format(rel_path)
            )
        # El try/except solo hace falta si hay una llamada al LLM que pueda fallar.
        # Las tools determinísticas (platform_recommender) no lo necesitan.
        if "call_llm" in text and "try:" not in text:
            out.append(
                "`{}` llama al LLM sin `try`. Una tool nunca rompe el stream: si el "
                "modelo o el proveedor falla, degradá a un default y explicalo en el "
                "`rationale` (CODESTYLE 1.2).".format(rel_path)
            )

    # ── Base: los adapters son stateless y reciben credenciales por parámetro ──
    if rel_path.startswith("backend/integrations/") and is_py and reads_env:
        out.append(
            "`{}` lee variables de entorno. Los adapters son stateless y reciben "
            "`credentials` por parámetro; quien resuelve de dónde salen es "
            "`services/credential_resolver.py` (CODESTYLE 1.1).".format(rel_path)
        )

    # ── Base: el LLM se configura en un solo lugar ──
    if is_py and rel_path != "backend/llm.py" and rel_path.startswith("backend/"):
        if re.search(r"^\s*(import|from)\s+(litellm|anthropic|openai|google\.generativeai)",
                     text, re.MULTILINE):
            out.append(
                "`{}` importa un SDK de LLM directamente. El único punto de "
                "configuración es `backend/llm.py`: usá `call_llm` o perdés los caps de "
                "tokens y el log de costo (CODESTYLE 1.3).".format(rel_path)
            )

    # ── Convenciones de logging ──
    if is_py and rel_path.startswith("backend/") and not is_cli_script:
        # Un print a stderr es la excepción documentada (validación de env al arrancar,
        # antes de que logging esté configurado). Solo marcamos los que van a stdout.
        stdout_prints = [
            ln for ln in re.findall(r"^\s*print\(.*$", text, re.MULTILINE)
            if "sys.stderr" not in ln
        ]
        if stdout_prints:
            out.append(
                "`{}` usa `print(` a stdout. En el backend se usa `logging`; el único "
                "`print` permitido es la validación de env vars a stderr antes de "
                "configurar logging (CODESTYLE 3.2).".format(rel_path)
            )
        if re.search(r"logger\.(debug|info|warning|error|exception)\(\s*f[\"']", text):
            out.append(
                "`{}` loguea con f-string. Usá interpolación `%s` por parámetro para "
                "que el formateo sea perezoso (CODESTYLE 3.2).".format(rel_path)
            )

    # ── Migraciones idempotentes + el descarte silencioso de campaigns ──
    if rel_path.startswith("backend/db/migrations/") and rel_path.endswith(".sql"):
        if "IF NOT EXISTS" not in text.upper() and "IF EXISTS" not in text.upper():
            out.append(
                "`{}` no usa IF NOT EXISTS / IF EXISTS. Las migraciones son siempre "
                "idempotentes (CODESTYLE 1.7).".format(rel_path)
            )
        if re.search(r"ALTER\s+TABLE\s+campaigns", text, re.IGNORECASE):
            added = re.findall(
                r"ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)",
                text, re.IGNORECASE,
            )
            known = _campaign_fields(root)
            # Solo avisamos por las columnas que de verdad faltan en el set — así el
            # aviso es accionable y no se repite en cada migración vieja.
            missing = [c for c in added if known and c.lower() not in
                       {k.lower() for k in known} and c.lower() != "deleted_at"]
            if missing:
                out.append(
                    "`{}` agrega a `campaigns` la(s) columna(s) {} que NO están en "
                    "`_CAMPAIGN_FIELDS` (backend/db/supabase_client.py). Lo que no esté "
                    "en ese set se descarta EN SILENCIO al insertar: agregalas ahí y a "
                    "`schema.sql`.".format(rel_path, ", ".join("`%s`" % c for c in missing))
                )

    # ── Frontend: patrones ya decididos ──
    if is_front and (rel_path.endswith(".tsx") or rel_path.endswith(".ts")):
        if rel_path != "frontend/src/lib/api.ts" and re.search(r"(?<![.\w])fetch\s*\(", text):
            out.append(
                "`{}` llama a `fetch` directo. Todas las llamadas al backend pasan por "
                "`lib/api.ts` (`apiFetch`/`apiUrl`), que agrega X-API-Key y el Bearer "
                "(CODESTYLE 2.1).".format(rel_path)
            )
        if re.search(r"\b(createContext|useReducer)\b", text):
            out.append(
                "`{}` introduce Context/useReducer. El estado del frontend es props + "
                "hooks locales; un store global es un patrón nuevo para todo el repo y "
                "va discutido (CODESTYLE 2.1).".format(rel_path)
            )
        if "react-router" in text:
            out.append(
                "`{}` usa react-router. La navegación es un `switch` sobre "
                "`window.location.pathname` en `App.tsx` (CODESTYLE 2.1)."
                .format(rel_path)
            )

    return out


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return

    tool_input = data.get("tool_input") or {}
    file_path = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not file_path:
        return

    root = _repo_root(os.path.dirname(os.path.abspath(file_path)) or ".")
    if not root:
        return  # no es el repo Adkio

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError:
        return

    findings = _check(_rel(file_path, root), text, root)
    if not findings:
        return

    body = ("Guardrails de Adkio — revisá esto antes de seguir:\n"
            + "\n".join("- " + f for f in findings))
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": body,
        }
    }), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
