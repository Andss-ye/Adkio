import { useState, useCallback, useRef, useEffect } from 'react';
import { isBackendAlive, simulateMockStream, simulateMockLaunch } from '@/lib/mock-campaign';
import { apiFetch, BACKEND, parseErrorResponse } from '@/lib/api';

export type ToolStatus = 'running' | 'done' | 'error';

export type ToolEvent = {
  tool: string;
  status: ToolStatus;
  rationale?: string;
  result?: Record<string, unknown>;
  startedAt: number;
  finishedAt?: number;
};

export type Plan = {
  copy: { headline: string; body: string; cta: string; rationale: string };
  targeting: {
    intereses: string[];
    edad_min: number;
    edad_max: number;
    paises: string[];
    tamano_estimado: number;
    exclusiones: string[];
    rationale: string;
  };
  budget: {
    aprobado: boolean;
    warnings: string[];
    presupuesto_diario_calculado: number;
    rationale: string;
  };
  validation: {
    passed: boolean;
    warnings: string[];
    blockers: string[];
    checklist_results: Record<string, boolean>;
    rationale: string;
  };
  /** Recomendación de plataforma del agente (Meta/TikTok/Google) — el backend la
   *  arma en _build_plan. Permite mostrar la plataforma REAL elegida, no un hardcode. */
  platform_recommendation?: {
    platform: 'meta' | 'tiktok' | 'google_ads';
    confidence?: number;
    rationale?: string;
  };
  duracion_dias: number;
};

export type StreamStatus =
  | 'idle'
  | 'streaming'
  | 'plan_ready'
  | 'approving'
  | 'launched'
  | 'error';

export type StreamMode = 'live' | 'mock';

export type PlatformHint = 'auto' | 'meta' | 'tiktok' | 'google_ads';

export type BackendHealth = 'checking' | 'online' | 'offline';

export type LaunchKpis = {
  expected_leads: number;
  cpl_usd: number;
  /** Rango dinámico estimado por backend (no constante global) */
  cpl_min_usd?: number;
  cpl_max_usd?: number;
  total_budget_usd: number;
  daily_budget_usd: number;
  duration_days: number;
};

export type LaunchResult = {
  campaign_id: string;
  status: string;
  estimated_reach: string;
  preview_url?: string;
  report?: string;
  kpis?: LaunchKpis;
  next_steps?: string[];
  /** True si la campaña no tocó la API real (sin credenciales conectadas) */
  is_mock?: boolean;
  /** Plataforma donde se creó la campaña */
  platform?: 'meta' | 'tiktok' | 'google_ads';
};

function parseSseChunk(chunk: string): { event: string; data: unknown }[] {
  const results: { event: string; data: unknown }[] = [];
  const blocks = chunk.split('\n\n');
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    let event = '';
    let dataStr = '';
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataStr = line.slice(5).trim();
    }
    if (event && dataStr) {
      try {
        results.push({ event, data: JSON.parse(dataStr) });
      } catch {
        /* skip */
      }
    }
  }
  return results;
}

export function useCampaignStream() {
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [mode, setMode] = useState<StreamMode>('live');
  const [backendHealth, setBackendHealth] = useState<BackendHealth>('checking');
  const lastPromptRef = useRef<string>('');

  /* Health check al mount + cada 30s para que el usuario vea claramente si
     el backend está vivo. Si está offline, automáticamente caemos a mock. */
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const alive = await isBackendAlive(BACKEND);
      if (cancelled) return;
      setBackendHealth(alive ? 'online' : 'offline');
      if (!alive) setMode('mock');
    }
    check();
    const interval = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const reset = useCallback(() => {
    setToolEvents([]);
    setPlan(null);
    setStatus('idle');
    setErrorMsg(null);
    setLaunchResult(null);
  }, []);

  /* ─── Mock streaming runner ────────────────────────────── */
  const runMockStream = useCallback(async (userPrompt: string) => {
    setMode('mock');
    await simulateMockStream(userPrompt, (e) => {
      if (e.kind === 'tool_start') {
        setToolEvents((prev) => [
          ...prev,
          { tool: e.tool, status: 'running', startedAt: Date.now() },
        ]);
      } else if (e.kind === 'tool_result') {
        const { tool, result } = e;
        setToolEvents((prev) =>
          prev.map((ev) =>
            ev.tool === tool && ev.status === 'running'
              ? {
                  ...ev,
                  status: 'done',
                  result,
                  rationale: (result as { rationale?: string })?.rationale,
                  finishedAt: Date.now(),
                }
              : ev,
          ),
        );
      } else if (e.kind === 'plan_ready') {
        setPlan(e.plan);
        setStatus('plan_ready');
      }
    });
  }, []);

  /* ─── Real streaming runner ────────────────────────────── */
  const runLiveStream = useCallback(async (userPrompt: string, brandId: string, platformHint?: PlatformHint) => {
    const resp = await apiFetch('/campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        user_prompt: userPrompt,
        brand_id: brandId,
        platform_hint: platformHint && platformHint !== 'auto' ? platformHint : null,
      }),
    });

    if (!resp.ok) {
      const message = await parseErrorResponse(resp);
      // Errores de validación del cliente (ej: prompt vago tipo "panti") NO deben
      // caer al mock — mostramos el mensaje útil y cortamos sin gastar tokens.
      if (resp.status === 400 || resp.status === 422) {
        setErrorMsg(message);
        setStatus('error');
        return;
      }
      throw new Error(message);
    }
    if (!resp.body) {
      throw new Error('Respuesta sin cuerpo del backend');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const boundary = buffer.lastIndexOf('\n\n');
      if (boundary === -1) continue;
      const chunk = buffer.slice(0, boundary + 2);
      buffer = buffer.slice(boundary + 2);

      for (const { event, data } of parseSseChunk(chunk)) {
        const d = data as Record<string, unknown>;

        if (event === 'tool_start') {
          const tool = d.tool as string;
          setToolEvents((prev) => [
            ...prev,
            { tool, status: 'running', startedAt: Date.now() },
          ]);
        } else if (event === 'tool_result') {
          const tool = d.tool as string;
          const result = d.result as Record<string, unknown>;
          setToolEvents((prev) =>
            prev.map((e) =>
              e.tool === tool && e.status === 'running'
                ? {
                    ...e,
                    status: 'done',
                    result,
                    rationale: result?.rationale as string,
                    finishedAt: Date.now(),
                  }
                : e,
            ),
          );
        } else if (event === 'plan_ready') {
          setPlan((d.plan as Plan) ?? null);
          setStatus('plan_ready');
        } else if (event === 'error') {
          setErrorMsg((d.message as string) ?? 'Error desconocido');
          setStatus('error');
        }
      }
    }
  }, []);

  /* ─── Public: startStream ──────────────────────────────── */
  const startStream = useCallback(
    async (userPrompt: string, brandId = 'demo-edu-latam', platformHint: PlatformHint = 'auto') => {
      reset();
      lastPromptRef.current = userPrompt;
      setStatus('streaming');

      /* Decide mode upfront via health check */
      const alive = await isBackendAlive(BACKEND);
      if (!alive) {
        setMode('mock');
        try {
          await runMockStream(userPrompt);
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Error en simulación');
          setStatus('error');
        }
        return;
      }

      setMode('live');
      try {
        await runLiveStream(userPrompt, brandId, platformHint);
      } catch (err) {
        /* If the live call drops mid-way, only fall back if we haven't
           emitted any events yet — otherwise surface the error. */
        const hasEvents = toolEvents.length > 0;
        if (hasEvents) {
          setErrorMsg(err instanceof Error ? err.message : 'Error de conexión');
          setStatus('error');
          return;
        }
        setMode('mock');
        try {
          await runMockStream(userPrompt);
        } catch (mockErr) {
          setErrorMsg(mockErr instanceof Error ? mockErr.message : 'Error en simulación');
          setStatus('error');
        }
      }
    },
    [reset, runMockStream, runLiveStream, toolEvents.length],
  );

  /* ─── Public: approveCampaign ──────────────────────────── */
  const approveCampaign = useCallback(async () => {
    if (!plan) return;
    setStatus('approving');

    if (mode === 'mock') {
      try {
        const result = await simulateMockLaunch(plan, lastPromptRef.current);
        setLaunchResult(result);
        setStatus('launched');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Error al lanzar (mock)');
        setStatus('error');
      }
      return;
    }

    try {
      // Inyectamos el prompt original al plan para que el backend lo persista
      // (lo usa el detalle de campaña en el dashboard).
      const planWithPrompt = { ...plan, user_prompt: lastPromptRef.current };
      const resp = await apiFetch('/campaign/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planWithPrompt }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result: LaunchResult = await resp.json();
      setLaunchResult(result);
      setStatus('launched');
    } catch (err) {
      /* Fallback to mock launch if real approve fails */
      try {
        const result = await simulateMockLaunch(plan, lastPromptRef.current);
        setMode('mock');
        setLaunchResult(result);
        setStatus('launched');
      } catch {
        setErrorMsg(err instanceof Error ? err.message : 'Error al lanzar');
        setStatus('error');
      }
    }
  }, [plan, mode]);

  return {
    toolEvents,
    plan,
    status,
    errorMsg,
    launchResult,
    mode,
    backendHealth,
    startStream,
    approveCampaign,
    reset,
  };
}
