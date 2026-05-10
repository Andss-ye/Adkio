"""
Mide tiempos reales del flujo de campaña para la landing page.

Uso:
  # Con el servidor corriendo:
  PYTHONPATH=. .venv/bin/python3 scripts/measure_timings.py

  # Levanta servidor automáticamente:
  PYTHONPATH=. .venv/bin/python3 scripts/measure_timings.py --with-server
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent.parent))

BASE_URL = "http://localhost:8000"
PROMPT = "Quiero llenar nuestro evento en Bogotá, 15 de junio, $200, somos exclusivos"
BRAND_ID = "demo-edu-latam"


def wait_for_server(timeout=15) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            requests.get(f"{BASE_URL}/health", timeout=2)
            return True
        except Exception:
            time.sleep(1)
    return False


def parse_sse(raw: str) -> list[dict]:
    events = []
    current: dict = {}
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("event:"):
            current["event"] = line[6:].strip()
        elif line.startswith("data:"):
            try:
                current["data"] = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                pass
        elif line == "" and current:
            events.append(current)
            current = {}
    if current:
        events.append(current)
    return events


def run_measurement() -> dict:
    """Corre el flujo completo y retorna un dict con todos los datos medidos."""
    t_total_start = time.time()

    resp = requests.post(
        f"{BASE_URL}/campaign",
        json={"user_prompt": PROMPT, "brand_id": BRAND_ID},
        headers={"Accept": "text/event-stream"},
        stream=True,
        timeout=120,
    )
    resp.raise_for_status()

    raw = resp.content.decode("utf-8")
    t_total_end = time.time()
    events = parse_sse(raw)

    # Extraer datos por tool
    tool_starts: dict[str, float] = {}
    tool_ends: dict[str, float] = {}
    tool_results: dict[str, dict] = {}
    plan = {}

    t_first_event = None
    for evt in events:
        event_type = evt.get("event")
        data = evt.get("data", {})
        t_now = time.time()  # aproximación — SSE no tiene timestamp propio

        if event_type == "tool_start":
            tool = data.get("tool")
            if tool and t_first_event is None:
                t_first_event = t_total_start
            if tool:
                tool_starts[tool] = t_now

        elif event_type == "tool_result":
            tool = data.get("tool")
            if tool:
                tool_ends[tool] = t_now
                tool_results[tool] = data.get("result", {})

        elif event_type == "plan_ready":
            plan = data.get("plan", {})

    # Approve para obtener reach real
    approve_result = {}
    if plan:
        t_approve = time.time()
        try:
            r = requests.post(
                f"{BASE_URL}/campaign/approve",
                json={"plan": plan},
                timeout=30,
            )
            approve_result = r.json()
        except Exception:
            pass

    return {
        "total_elapsed_s": round(t_total_end - t_total_start, 1),
        "tool_results": tool_results,
        "plan": plan,
        "approve_result": approve_result,
        "events_count": len(events),
    }


def print_report(data: dict):
    plan = data.get("plan", {})
    tool_results = data.get("tool_results", {})
    approve = data.get("approve_result", {})

    copy = plan.get("copy", {})
    targeting = plan.get("targeting", {})
    budget = plan.get("budget", {})
    validation = plan.get("validation", {})
    checklist = validation.get("checklist_results", {})

    audience_result = tool_results.get("audience_analyzer", {})
    tamano = audience_result.get("tamano_estimado", 0)

    print()
    print("=" * 60)
    print("DATOS REALES PARA LA LANDING — Adkio")
    print("=" * 60)

    print(f"\n⏱  TIEMPOS")
    print(f"   Flujo completo (POST /campaign):  {data['total_elapsed_s']}s")
    print(f"   Eventos SSE recibidos:            {data['events_count']}")

    print(f"\n👥  AUDIENCIA")
    if tamano:
        print(f"   Tamaño estimado LATAM exec:       {tamano:,} personas")
    if targeting.get("paises"):
        print(f"   Países configurados:              {', '.join(targeting['paises'])}")
    if targeting.get("intereses"):
        print(f"   Intereses detectados:             {len(targeting['intereses'])} términos")
        print(f"   Muestra:                          {', '.join(targeting['intereses'][:3])}")

    print(f"\n💰  PRESUPUESTO")
    if budget.get("presupuesto_diario_calculado"):
        print(f"   Presupuesto diario calculado:     ${budget['presupuesto_diario_calculado']:.2f}/día")
    print(f"   CPL benchmark LATAM edu ejecutiva: $15 USD/lead")
    if approve.get("estimated_reach"):
        print(f"   Reach estimado ($200):            {approve['estimated_reach']}")

    print(f"\n✅  VALIDACIÓN")
    total_checks = len(checklist)
    passed_checks = sum(1 for v in checklist.values() if v)
    if total_checks:
        print(f"   Criterios superados:              {passed_checks}/{total_checks}")
    if validation.get("warnings"):
        print(f"   Advertencias:                     {len(validation['warnings'])}")
    if validation.get("blockers"):
        print(f"   Bloqueantes:                      {len(validation['blockers'])}")
    else:
        print(f"   Bloqueantes:                      0")

    if approve.get("campaign_id"):
        print(f"\n🚀  LANZAMIENTO")
        print(f"   Campaign ID:                      {approve['campaign_id']}")
        print(f"   Status:                           {approve.get('status', 'N/A')}")

    print(f"\n✍️  COPY GENERADO (ejemplo real)")
    if copy.get("headline"):
        print(f"   Headline: \"{copy['headline']}\"")
    if copy.get("body"):
        preview = copy["body"][:120] + ("…" if len(copy["body"]) > 120 else "")
        print(f"   Body:     \"{preview}\"")
    if copy.get("cta"):
        print(f"   CTA:      \"{copy['cta']}\"")

    print()
    print("=" * 60)
    print("RESUMEN PARA ANDREW (datos a poner en la landing)")
    print("=" * 60)
    print(f"  Tiempo total del agente:  ~{data['total_elapsed_s']}s")
    print(f"  Validaciones automáticas: {passed_checks}/{total_checks} criterios Meta")
    if tamano:
        print(f"  Base audiencia LATAM:     {tamano//1000}K personas")
    print(f"  CPL benchmark usado:      $15 USD/lead (educación ejecutiva LATAM)")
    if approve.get("estimated_reach"):
        print(f"  Reach con $200:           {approve['estimated_reach']}")
    print()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--with-server", action="store_true")
    args = parser.parse_args()

    server_proc = None
    if args.with_server:
        server_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

    try:
        if not wait_for_server():
            print("ERROR: No se pudo conectar al servidor. Usá --with-server o levantá uvicorn.")
            sys.exit(1)

        print(f"\nMidiendo flujo completo con prompt de demo…")
        print(f"Prompt: '{PROMPT}'")

        data = run_measurement()
        print_report(data)

    except KeyboardInterrupt:
        print("\nCancelado.")
    finally:
        if server_proc:
            server_proc.terminate()


if __name__ == "__main__":
    main()
