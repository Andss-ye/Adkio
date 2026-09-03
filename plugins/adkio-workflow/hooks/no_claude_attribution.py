#!/usr/bin/env python3
"""
PreToolUse — bloquea cualquier commit, tag o PR que atribuya autoría a Claude.

Regla del equipo Adkio: los commits y PRs del repo no llevan co-autoría ni firma
de la herramienta. El autor es la persona que hizo el trabajo.

Este hook es la red de seguridad determinística. El arreglo de raíz es
`includeCoAuthoredBy: false` en `.claude/settings.json`, que evita que Claude Code
agregue el footer solo. El hook cubre el caso de que alguien lo escriba a mano, que
un template lo reintroduzca, o que la config no esté aplicada en la máquina del dev.

Contrato: recibe el payload del hook por stdin, y si detecta atribución responde
con permissionDecision=deny. Nunca falla la operación por un error propio.
"""
import json
import re
import sys

# Comandos que publican texto con autoría. Solo revisamos estos.
_TARGET_COMMANDS = re.compile(
    r"\b(git\s+commit|git\s+tag|git\s+revert|git\s+merge|"
    r"gh\s+pr\s+(create|edit)|gh\s+release\s+create|"
    r"gt\s+(create|modify|submit))\b",
    re.IGNORECASE,
)

# Patrones de atribución prohibidos.
_ATTRIBUTION_PATTERNS = [
    (r"co-authored-by:\s*claude", "Co-Authored-By: Claude"),
    (r"co-authored-by:.*anthropic", "Co-Authored-By con dominio de Anthropic"),
    (r"noreply@anthropic\.com", "noreply@anthropic.com"),
    (r"generated\s+with\s+\[?claude", "Generated with Claude Code"),
    (r"🤖\s*generated", "🤖 Generated with…"),
    (r"co-created\s+with\s+claude", "Co-created with Claude"),
    (r"\bclaude\.com/claude-code\b", "link a claude.com/claude-code"),
    (r"authored[-\s]by:\s*claude", "Authored-By: Claude"),
]


def _deny(reason):
    payload = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }
    print(json.dumps(payload), flush=True)
    sys.exit(0)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return  # payload ilegible: no bloqueamos nada

    if data.get("tool_name") != "Bash":
        return

    command = (data.get("tool_input") or {}).get("command") or ""
    if not command or not _TARGET_COMMANDS.search(command):
        return

    lowered = command.lower()
    hits = [label for pattern, label in _ATTRIBUTION_PATTERNS
            if re.search(pattern, lowered, re.IGNORECASE)]

    if hits:
        _deny(
            "Bloqueado por adkio-workflow: el mensaje incluye atribución a Claude "
            "({}). Regla del equipo: los commits y PRs de Adkio no llevan co-autoría "
            "ni firma de la herramienta. Reescribí el mensaje sin esa línea y volvé a "
            "intentar.".format(", ".join(hits))
        )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Un bug del hook nunca debe romper el flujo de trabajo del dev.
        pass
