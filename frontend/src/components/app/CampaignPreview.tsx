import type { Plan, StreamStatus, LaunchResult } from '@/hooks/useCampaignStream';
import { Check, Sparkles } from '@/components/ui/Icons';
import { monoFont } from '@/lib/styles';

type Props = {
  plan: Plan | null;
  status: StreamStatus;
  launchResult: LaunchResult | null;
  onApprove: () => void;
};

export default function CampaignPreview({ plan, status, launchResult, onApprove }: Props) {
  /* ─── Launched state ─── */
  if (status === 'launched' && launchResult) {
    return (
      <div className="flex flex-col h-full p-5 gap-4 overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981]" />
          <span className="text-xs font-semibold text-[#10b981]">Campaña creada</span>
        </div>
        <div className="liquid-glass rounded-xl p-4 flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-white/40">Campaign ID</span>
          <span className="text-xs text-white break-all" style={{ fontFamily: monoFont }}>
            {launchResult.campaign_id}
          </span>
          <span className="text-[10px] text-white/50 mt-1">
            Status: <span className="text-[#f59e0b]">{launchResult.status}</span>
            {' · '}Alcance estimado: {launchResult.estimated_reach}
          </span>
          {launchResult.preview_url && (
            <a href={launchResult.preview_url} target="_blank" rel="noopener noreferrer"
              className="mt-2 text-[11px] text-[#00d2ff] underline underline-offset-2">
              Ver en Meta Ads Manager →
            </a>
          )}
        </div>
        {launchResult.report && (
          <div className="liquid-glass rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Reporte</p>
            <div className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">
              {launchResult.report}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─── Empty state ─── */
  if (!plan) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 p-6 text-center">
        <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white/20" />
        </div>
        <p className="text-xs text-white/30 leading-relaxed">
          El preview de la campaña aparecerá aquí cuando el agente termine de analizar.
        </p>
      </div>
    );
  }

  /* ─── Plan ready ─── */
  const { copy, targeting, budget, validation } = plan;
  const warnings = [...(budget.warnings ?? []), ...(validation.warnings ?? [])];

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="h-10 flex items-center gap-2 px-4 border-b border-white/10 flex-shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
        <span className="text-xs text-white/50">Plan listo</span>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto no-scrollbar">
        {/* Copy */}
        <div className="liquid-glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Copy generado</p>
          <h3 className="text-base font-semibold text-white leading-tight">
            {copy.headline}
          </h3>
          <p className="mt-2 text-xs text-white/65 leading-relaxed">{copy.body}</p>
          <span className="mt-3 inline-block text-[11px] px-3 py-1 rounded-full border border-white/15 text-white/60">
            {copy.cta}
          </span>
        </div>

        {/* Audience */}
        <div className="liquid-glass rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Audiencia</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {targeting.paises.map(p => (
              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/55">{p}</span>
            ))}
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/55">
              {targeting.edad_min}–{targeting.edad_max} años
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {targeting.intereses.slice(0, 4).map(i => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">{i}</span>
            ))}
          </div>
          {targeting.tamano_estimado > 0 && (
            <p className="mt-2 text-[10px] text-white/35">
              ~{(targeting.tamano_estimado / 1000).toFixed(0)}K personas estimadas
            </p>
          )}
        </div>

        {/* Budget */}
        <div className="grid grid-cols-2 gap-2">
          <div className="liquid-glass rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Presupuesto/día</p>
            <p className="mt-1 text-sm font-semibold text-white">
              ${budget.presupuesto_diario_calculado?.toFixed(2)}
            </p>
            <p className="text-[10px] text-white/40 mt-0.5">
              {plan.duracion_dias} días de duración
            </p>
          </div>
          <div className="liquid-glass rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Validación</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Check className="w-3 h-3 text-[#10b981]" />
              <span className="text-xs text-[#10b981]">
                {Object.values(validation.checklist_results ?? {}).filter(Boolean).length}/
                {Object.keys(validation.checklist_results ?? {}).length} criterios
              </span>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/5 p-3">
            <p className="text-[10px] uppercase tracking-widest text-[#f59e0b]/70 mb-1">Advertencias</p>
            {warnings.map((w, i) => (
              <p key={i} className="text-[11px] text-[#f59e0b]/80 leading-relaxed">· {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      {(status === 'plan_ready') && (
        <div className="p-4 border-t border-white/10 flex-shrink-0">
          <button
            onClick={onApprove}
            className="w-full py-3 rounded-xl text-sm font-semibold text-black transition-opacity hover:opacity-90 active:opacity-75"
            style={{ background: '#00d2ff' }}
          >
            Aprobar y lanzar campaña
          </button>
          <p className="mt-2 text-[10px] text-white/30 text-center">
            La campaña se creará en Meta en estado PAUSED para revisión
          </p>
        </div>
      )}

      {status === 'approving' && (
        <div className="p-4 border-t border-white/10 flex-shrink-0">
          <div className="w-full py-3 rounded-xl text-sm font-semibold text-center text-white/40 border border-white/10">
            Lanzando…
          </div>
        </div>
      )}
    </div>
  );
}
