#!/usr/bin/env bash
# Gauntlet de verificación de Adkio. Lo usan /adkio:verify y /adkio:checkpoint.
#
# Corre solo lo que aplica: los tests de Python siempre, el build del frontend solo si
# hay cambios en frontend/. Imprime un resumen con los números reales para pegar en la
# sección "Verification" del summary.
#
# Salida: 0 si todo pasó, 1 si algo falló. Nunca commitea nada.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT" || exit 1

FAILED=0
echo "== Verificación de Adkio =="
echo "repo: $ROOT"
echo

# ── Detectar qué cambió, para no correr gates que no aplican ────────────────
CHANGED="$(git status --porcelain 2>/dev/null | awk '{print $NF}')"
DIFFED="$(git diff --name-only HEAD 2>/dev/null)"
ALL_CHANGED="$(printf '%s\n%s\n' "$CHANGED" "$DIFFED" | sort -u | sed '/^$/d')"
TOUCHED_FRONT=$(printf '%s\n' "$ALL_CHANGED" | grep -c '^frontend/' || true)
TOUCHED_BACK=$(printf '%s\n' "$ALL_CHANGED" | grep -cE '^(backend|tests)/' || true)

# ── 1. Tests de Python ──────────────────────────────────────────────────────
echo "-- pytest"
PY=""
for cand in .venv/bin/python venv/bin/python python3.11 python3; do
  if command -v "$cand" >/dev/null 2>&1 || [ -x "$cand" ]; then PY="$cand"; break; fi
done

if [ -z "$PY" ]; then
  echo "   SKIP: no encontré un intérprete de Python"
  echo "   GATE NO CORRIÓ — no cuentes esto como verde"
elif ! "$PY" -c "import pytest" >/dev/null 2>&1; then
  echo "   SKIP: pytest no está instalado en $PY"
  echo "   (pip install -r backend/requirements.txt pytest pytest-asyncio)"
  echo "   GATE NO CORRIÓ — no cuentes esto como verde"
else
  # El repo usa sintaxis de 3.10+ (str | None). Con un intérprete viejo la suite no
  # colecciona, y eso es un problema de entorno, no del código: lo reportamos como
  # gate no corrido en vez de como falla.
  OK311="$("$PY" -c 'import sys;print(1 if sys.version_info>=(3,11) else 0)')"
  if [ "$OK311" != "1" ]; then
    VER="$("$PY" -c 'import sys;print("%d.%d"%sys.version_info[:2])')"
    echo "   SKIP: Python $VER — el repo necesita 3.11+ (tests/test_endpoints.py importa"
    echo "   backend.main, que usa 'str | None')"
    echo "   GATE NO CORRIÓ — no cuentes esto como verde"
  else
    OUT="$("$PY" -m pytest -q 2>&1)"
    printf '%s\n' "$OUT" | tail -3
    if printf '%s' "$OUT" | grep -qE '[0-9]+ (failed|error)'; then FAILED=1; fi
  fi
fi
echo

# ── 2. Build del frontend (gate de tipos) ───────────────────────────────────
echo "-- frontend build (tsc -b + vite)"
if [ "$TOUCHED_FRONT" -eq 0 ]; then
  echo "   SKIP: no hay cambios en frontend/"
elif [ ! -d frontend/node_modules ]; then
  echo "   SKIP: falta frontend/node_modules (cd frontend && npm install)"
else
  if OUT="$(cd frontend && npm run build 2>&1)"; then
    printf '%s\n' "$OUT" | grep -E 'modules transformed|built in' | tail -2
  else
    printf '%s\n' "$OUT" | tail -15
    FAILED=1
  fi
fi
echo

# ── 3. Higiene: nada de prints ni debug olvidado en el backend ──────────────
echo "-- higiene de código (solo lo que tocaste)"
# Un gate que arranca rojo por deuda preexistente se ignora a la semana. Así que las
# reglas se aplican a los archivos que este cambio toca; lo viejo se reporta aparte
# como informativo, sin romper el checkpoint.
mkfilter() { printf '%s\n' "$ALL_CHANGED" | grep -E "$1" || true; }

CHANGED_PY="$(mkfilter '^backend/.*\.py$' | grep -v 'backend/db/seed.py' || true)"
CHANGED_TOOLS="$(mkfilter '^backend/(tools|integrations)/.*\.py$')"

if [ -z "$ALL_CHANGED" ]; then
  echo "   SKIP: no hay archivos modificados"
else
  HY=0
  for f in $CHANGED_PY; do
    [ -f "$f" ] || continue
    P="$(grep -nE '^\s*print\(' "$f" 2>/dev/null | grep -v 'sys.stderr' || true)"
    if [ -n "$P" ]; then
      echo "   ⚠️ $f: print() a stdout (usá logging)"; HY=1
    fi
  done
  for f in $CHANGED_TOOLS; do
    [ -f "$f" ] || continue
    E="$(grep -nE 'os\.(environ|getenv)' "$f" 2>/dev/null || true)"
    if [ -n "$E" ]; then
      echo "   ⚠️ $f: lee env — las tools/adapters reciben credenciales por parámetro"
      HY=1
    fi
    if grep -qE '\)\s*->\s*dict' "$f" && ! grep -q 'rationale' "$f"; then
      echo "   ⚠️ $f: devuelve dict sin rationale"; HY=1
    fi
  done
  [ "$HY" -eq 0 ] && echo "   OK: sin problemas de higiene en los archivos tocados"
  [ "$HY" -eq 1 ] && FAILED=1
fi

# Deuda preexistente: informativa, no rompe el gate.
OLD_ENV="$(grep -rlE 'os\.(environ|getenv)' backend/tools/ backend/integrations/ 2>/dev/null | tr '\n' ' ' || true)"
if [ -n "$OLD_ENV" ]; then
  echo "   (info) deuda preexistente, tools/adapters que leen env: $OLD_ENV"
fi
echo

# ── 4. Atribución a Claude en los commits nuevos ────────────────────────────
echo "-- atribución en commits"
BASE="$(git merge-base HEAD main 2>/dev/null || git rev-parse HEAD~5 2>/dev/null || echo HEAD)"
ATTR="$(git log "$BASE"..HEAD --pretty=%B 2>/dev/null | grep -iE 'co-authored-by:.*claude|generated with .*claude|noreply@anthropic' || true)"
if [ -n "$ATTR" ]; then
  echo "   ⚠️ hay commits con atribución a Claude — reescribí el historial antes del PR"
  FAILED=1
else
  echo "   OK: sin atribución a Claude"
fi
echo

if [ "$FAILED" -eq 0 ]; then
  echo "== Todo verde =="
else
  echo "== Hay fallas: revisalas antes de commitear =="
fi
exit "$FAILED"
