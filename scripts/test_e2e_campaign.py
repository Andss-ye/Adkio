"""
Test e2e del flujo completo de campaña con LLM real (no mocks).

Llama al servidor local, parsea el SSE stream, y valida que:
  - Los 4 tool calls están presentes con rationale real
  - plan_ready contiene copy, targeting, budget y validation
  - POST /campaign/approve devuelve campaign_id

Uso:
  # Con servidor corriendo en otra terminal:
  PYTHONPATH=. .venv/bin/python3 scripts/test_e2e_campaign.py

  # Levanta el servidor automáticamente:
  PYTHONPATH=. .venv/bin/python3 scripts/test_e2e_campaign.py --with-server
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
DEMO_PROMPT = "Quiero llenar nuestro evento en Bogotá, 15 de junio, $200, somos exclusivos"
DEMO_BRAND_ID = "demo-edu-latam"
EXPECTED_TOOLS = {"budget_validator", "audience_analyzer", "copy_generator", "campaign_validator"}
FALLBACK_RATIONALES = {
    "Presupuesto de $",       # budget_validator fallback
    "Audiencia de fundadores", # audience_analyzer fallback
    "Copy directo",            # copy_generator fallback
}


def wait_for_server(timeout: int = 15) -> bool:
    print("  Esperando servidor...", end="", flush=True)
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            requests.get(f"{BASE_URL}/health", timeout=2)
            print(" listo.")
            return True
        except Exception:
            print(".", end="", flush=True)
            time.sleep(1)
    print(" TIMEOUT.")
    return False


def parse_sse(raw: str) -> list[dict]:
    events = []
    current = {}
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("event:"):
            current["event"] = line[6:].strip()
        elif line.startswith("data:"):
            try:
                current["data"] = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                current["data"] = line[5:].strip()
        elif line == "" and current:
            events.append(current)
            current = {}
    if current:
        events.append(current)
    return events


def test_campaign_stream() -> tuple[bool, dict, list]:
    print("\n── POST /campaign ──────────────────────────────")
    t0 = time.time()

    try:
        resp = requests.post(
            f"{BASE_URL}/campaign",
            json={"user_prompt": DEMO_PROMPT, "brand_id": DEMO_BRAND_ID},
            headers={"Accept": "text/event-stream"},
            stream=True,
            timeout=90,
        )
    except requests.exceptions.ConnectionError:
        print("  FAIL — servidor no disponible")
        return False, {}, []

    if resp.status_code != 200:
        print(f"  FAIL — status {resp.status_code}: {resp.text[:200]}")
        return False, {}, []

    raw = resp.content.decode("utf-8")
    elapsed = round(time.time() - t0, 1)
    events = parse_sse(raw)

    print(f"  Stream completado en {elapsed}s — {len(events)} eventos")

    tool_starts = [e for e in events if e.get("event") == "tool_start"]
    tool_results = [e for e in events if e.get("event") == "tool_result"]
    plan_events = [e for e in events if e.get("event") == "plan_ready"]
    error_events = [e for e in events if e.get("event") == "error"]

    if error_events:
        print(f"  ERROR del agente: {error_events[0].get('data')}")
        return False, {}, events

    checks = []

    # Validar tool calls
    tools_seen = {e["data"].get("tool") for e in tool_starts if "data" in e}
    missing = EXPECTED_TOOLS - tools_seen
    checks.append(("4 tool_start events", len(tool_starts) >= 4))
    checks.append(("4 tool_result events", len(tool_results) >= 4))
    checks.append((f"tools presentes: {EXPECTED_TOOLS}", not missing))

    # Validar rationales reales (no fallbacks)
    rationales_ok = 0
    rationales_fallback = 0
    for e in tool_results:
        result = e.get("data", {}).get("result", {})
        rationale = result.get("rationale", "")
        is_fallback = any(fb in rationale for fb in FALLBACK_RATIONALES)
        if rationale and not is_fallback:
            rationales_ok += 1
        elif is_fallback:
            rationales_fallback += 1

    checks.append((f"rationales reales (no fallback)", rationales_ok >= 3))
    if rationales_fallback:
        print(f"  WARN  {rationales_fallback} tool(s) usaron fallback — revisar LLM output")

    # Validar plan_ready
    plan = {}
    if plan_events:
        plan = plan_events[0].get("data", {}).get("plan", {})
        checks.append(("plan_ready presente", True))
        checks.append(("plan tiene copy", bool(plan.get("copy", {}).get("headline"))))
        checks.append(("plan tiene targeting", bool(plan.get("targeting", {}).get("intereses"))))
        checks.append(("plan tiene budget", "presupuesto_diario_calculado" in plan.get("budget", {})))
        checks.append(("plan tiene validation", "passed" in plan.get("validation", {})))
        # Gemini ~45s (thinking), Groq ~5s — ambos OK para demo
        checks.append((f"latencia < 90s", elapsed < 90))
    else:
        checks.append(("plan_ready presente", False))

    all_ok = all(v for _, v in checks)
    for name, ok in checks:
        print(f"  {'OK ' if ok else 'FAIL'} {name}")

    return all_ok, plan, events


def test_approve(plan: dict) -> bool:
    print("\n── POST /campaign/approve ──────────────────────")
    if not plan:
        print("  SKIP — sin plan (step anterior falló)")
        return False

    try:
        resp = requests.post(
            f"{BASE_URL}/campaign/approve",
            json={"plan": plan},
            timeout=30,
        )
    except Exception as e:
        print(f"  FAIL — {e}")
        return False

    if resp.status_code != 200:
        print(f"  FAIL — status {resp.status_code}")
        return False

    data = resp.json()
    campaign_id = data.get("campaign_id", "")
    ok = bool(campaign_id)
    print(f"  {'OK ' if ok else 'FAIL'} campaign_id: {campaign_id}")
    print(f"  {'OK ' if data.get('status') else 'FAIL'} status: {data.get('status')}")
    print(f"  {'OK ' if data.get('estimated_reach') else 'FAIL'} reach: {data.get('estimated_reach')}")
    has_report = bool(data.get("report"))
    print(f"  {'OK ' if has_report else 'FAIL'} reporte generado: {len(data.get('report',''))} chars")
    return ok


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--with-server", action="store_true", help="Levanta uvicorn automáticamente")
    args = parser.parse_args()

    print("=" * 55)
    print("Adkio — Test E2E con LLM real")
    print(f"Prompt: '{DEMO_PROMPT}'")
    print(f"Brand:  {DEMO_BRAND_ID}")
    print("=" * 55)

    server_proc = None
    if args.with_server:
        print("\nArrancando servidor...")
        server_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "backend.main:app", "--port", "8000"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    try:
        if not wait_for_server():
            print("\nNo se pudo conectar al servidor. Corré uvicorn primero o usá --with-server")
            sys.exit(1)

        stream_ok, plan, _ = test_campaign_stream()
        approve_ok = test_approve(plan)

        print("\n" + "=" * 55)
        print("RESULTADO FINAL:")
        print(f"  Stream + tools: {'OK' if stream_ok else 'FAIL'}")
        print(f"  Approve + launch: {'OK' if approve_ok else 'FAIL'}")

        if stream_ok and approve_ok:
            print("\nFlujo e2e completo. Listo para conectar frontend.")
        else:
            print("\nHay problemas. Revisar output arriba antes de conectar frontend.")
            sys.exit(1)

    finally:
        if server_proc:
            server_proc.terminate()


if __name__ == "__main__":
    main()
