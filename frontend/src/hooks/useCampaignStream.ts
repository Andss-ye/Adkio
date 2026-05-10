import { useState, useCallback } from 'react';

const BACKEND: string = (import.meta as { env?: { VITE_BACKEND_URL?: string } }).env?.VITE_BACKEND_URL ?? 'http://localhost:8000';

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
  targeting: { intereses: string[]; edad_min: number; edad_max: number; paises: string[]; tamano_estimado: number; exclusiones: string[]; rationale: string };
  budget: { aprobado: boolean; warnings: string[]; presupuesto_diario_calculado: number; rationale: string };
  validation: { passed: boolean; warnings: string[]; blockers: string[]; checklist_results: Record<string, boolean>; rationale: string };
  duracion_dias: number;
};

export type StreamStatus = 'idle' | 'streaming' | 'plan_ready' | 'approving' | 'launched' | 'error';

export type LaunchResult = {
  campaign_id: string;
  status: string;
  estimated_reach: string;
  preview_url?: string;
  report?: string;
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
      try { results.push({ event, data: JSON.parse(dataStr) }); } catch { /* skip */ }
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

  const reset = useCallback(() => {
    setToolEvents([]);
    setPlan(null);
    setStatus('idle');
    setErrorMsg(null);
    setLaunchResult(null);
  }, []);

  const startStream = useCallback(async (userPrompt: string, brandId = 'demo-edu-latam') => {
    reset();
    setStatus('streaming');

    try {
      const resp = await fetch(`${BACKEND}/campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ user_prompt: userPrompt, brand_id: brandId }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`HTTP ${resp.status}`);
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
            setToolEvents(prev => [
              ...prev,
              { tool, status: 'running', startedAt: Date.now() },
            ]);
          } else if (event === 'tool_result') {
            const tool = d.tool as string;
            const result = d.result as Record<string, unknown>;
            setToolEvents(prev =>
              prev.map(e =>
                e.tool === tool && e.status === 'running'
                  ? { ...e, status: 'done', result, rationale: result?.rationale as string, finishedAt: Date.now() }
                  : e,
              ),
            );
          } else if (event === 'plan_ready') {
            setPlan((d.plan as Plan) ?? null);
            setStatus('plan_ready');
          } else if (event === 'error') {
            setErrorMsg(d.message as string ?? 'Error desconocido');
            setStatus('error');
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error de conexión');
      setStatus('error');
    }
  }, [reset]);

  const approveCampaign = useCallback(async () => {
    if (!plan) return;
    setStatus('approving');
    try {
      const resp = await fetch(`${BACKEND}/campaign/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result: LaunchResult = await resp.json();
      setLaunchResult(result);
      setStatus('launched');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al lanzar');
      setStatus('error');
    }
  }, [plan]);

  return { toolEvents, plan, status, errorMsg, launchResult, startStream, approveCampaign, reset };
}
