# adkio-workflow

Plugin de Claude Code del equipo Adkio. Convierte las reglas del repo en guardrails que
se aplican solos, y automatiza el cierre de cada bloque de trabajo.

Vive **dentro del repo** (`plugins/adkio-workflow/`), así se versiona con el código: si
cambian las bases del proyecto, el plugin cambia en el mismo PR.

---

## Qué hace

### Hooks — corren solos, no dependen de que nadie se acuerde

| Hook | Cuándo | Qué hace |
|---|---|---|
| **PreToolUse** (Bash) | Antes de cada `git commit`, `git tag`, `gh pr create`… | **Bloquea** el comando si el mensaje atribuye autoría a Claude (`Co-Authored-By`, `Generated with Claude Code`, `🤖`, `noreply@anthropic.com`). El autor es la persona. |
| **PostToolUse** (Edit/Write) | Después de cada edición | Relee el archivo y avisa si rompe una base: tools que leen env, tool sin `rationale`, `call_llm` sin `try`, SDK de LLM importado fuera de `llm.py`, `print()` a stdout, logger con f-string, migración no idempotente, columna de `campaigns` que falta en `_CAMPAIGN_FIELDS`, `fetch` directo en el frontend, Context/Redux, react-router. |
| **SessionStart** | Al abrir la sesión | Inyecta las bases del proyecto + rama actual + archivos sin commitear, y avisa si estás en `main`. |
| **Stop** | Al cerrar el turno | Si quedó trabajo sin commitear, sugiere `/adkio:checkpoint`. No bloquea. |

Los cuatro son **no-op fuera del repo Adkio** (se detecta por `backend/llm.py` +
`backend/tools/`), así no molestan en otros proyectos.

### Comandos

| Comando | Qué hace |
|---|---|
| `/adkio:checkpoint [descripción]` | Verifica, audita contra las bases y commitea con el summary del equipo. El flujo principal. |
| `/adkio:verify` | Solo el gauntlet: tests, build del frontend, higiene, atribución. |
| `/adkio:summary [base]` | Genera el summary (Problema/Solución/Changes/Test Coverage/Verification) sin commitear. |
| `/adkio:pr [título]` | Abre el PR con ese summary como body. |
| `/adkio:bases [alcance]` | Audita un diff contra las bases arquitectónicas. |

### Skill

`adkio-bases` se carga sola cuando el trabajo toca `backend/tools/`,
`backend/integrations/`, el resolver, `llm.py`, migraciones o llamadas del frontend.
Lleva las reglas que se rompen en silencio, con ejemplos de código.

Costo: **~492 tokens always-on**. Los hooks no cuestan contexto (corren en el harness).

---

## Instalación

### Para el equipo

Desde un clon del repo:

```bash
cd Adkio
claude plugin marketplace add ./
claude plugin install adkio-workflow@adkio
```

Reiniciá la sesión de Claude Code para que carguen los hooks y los comandos.

Una vez que el repo esté en GitHub, `.claude/settings.json` ya declara el marketplace y
habilita el plugin, así que al abrir el repo Claude Code lo ofrece solo (pide confirmar la
primera vez). El camino manual de arriba siempre funciona y no depende de la red.

### Verificar que quedó activo

```bash
claude plugin details adkio-workflow     # inventario y costo de tokens
```

Debería listar 4 hooks (SessionStart, PreToolUse, PostToolUse, Stop) y 6 skills.

---

## Cómo se actualiza

El plugin es código del repo, así que se actualiza como cualquier cambio:

1. Editás `plugins/adkio-workflow/…` (una regla nueva en `hooks/bases_guard.py`, un paso
   en `commands/checkpoint.md`, etc.).
2. Subís la versión en `.claude-plugin/plugin.json` (`version`) si el cambio es visible
   para el equipo.
3. PR a `main`, como siempre.
4. Cada dev corre:
   ```bash
   claude plugin marketplace update adkio
   claude plugin install adkio-workflow@adkio    # reinstala la versión nueva
   ```
   y reinicia la sesión.

Mientras desarrollás el plugin, el marketplace apunta al directorio local: los cambios en
los **scripts de hooks** aplican en la próxima sesión sin reinstalar, porque se ejecutan
desde `${CLAUDE_PLUGIN_ROOT}`. Los cambios en `hooks.json`, `plugin.json` o los comandos
sí necesitan reinstalar.

---

## Cómo testear un hook sin abrir una sesión

Los hooks leen su payload de stdin, así que se prueban con un JSON a mano:

```bash
# PreToolUse — debería devolver permissionDecision: deny
python3 -c 'import json;print(json.dumps({"tool_name":"Bash","tool_input":{"command":"git commit -m \"x\n\nCo-Authored-By: Claude\""}}))' \
  | python3 plugins/adkio-workflow/hooks/no_claude_attribution.py

# PostToolUse — hallazgos sobre un archivo real
python3 -c 'import json,os;print(json.dumps({"tool_name":"Edit","tool_input":{"file_path":os.path.abspath("backend/tools/copy_generator.py")}}))' \
  | python3 plugins/adkio-workflow/hooks/bases_guard.py
```

Cuidado con `echo` en zsh: interpreta `\n` y rompe el JSON. Usá `python3 -c` o `printf`.

El gauntlet se corre directo:

```bash
bash plugins/adkio-workflow/scripts/verify.sh
```

---

## Decisiones de diseño

**La higiene se aplica solo a los archivos que tocás.** El repo tiene deuda preexistente
(hoy: `campaign_launcher.py` lee `META_AD_ACCOUNT_ID` en el path de mock). Si el gate
arrancara rojo por eso, en una semana nadie lo mira. Lo viejo se reporta como `(info)` y no
rompe el checkpoint; lo que tocás sí.

**El hook de Stop no bloquea.** Un `decision: block` en Stop fuerza al modelo a seguir, y
"hay cambios sin commitear" puede seguir siendo verdad después de que responda: eso da un
loop. El hook avisa; `/adkio:checkpoint` hace el trabajo.

**Ningún hook decide qué es un checkpoint.** Eso es juicio: una feature terminada, un bug
con su test, un refactor completo. Un hook no puede inferirlo, y commitear automáticamente
a mitad de camino ensucia el historial.

**Un gate que no corrió no es un gate verde.** Si falta pytest o el intérprete es < 3.11,
`verify.sh` imprime `GATE NO CORRIÓ` en vez de dar por bueno el silencio.

**Doble defensa contra la atribución.** `includeCoAuthoredBy: false` en
`.claude/settings.json` evita que Claude Code agregue el footer solo; el hook de PreToolUse
cubre que alguien lo escriba a mano, que un template lo reintroduzca, o que la config no
esté aplicada en esa máquina.
