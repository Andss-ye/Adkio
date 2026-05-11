import type { ToolEvent } from '@/hooks/useCampaignStream';
import { Check } from '@/components/ui/Icons';
import { monoFont } from '@/lib/styles';

const TOOL_META: Record<string, { label: string; icon: string }> = {
  budget_validator: { label: 'budget_validator', icon: '$' },
  audience_analyzer: { label: 'audience_analyzer', icon: '◎' },
  copy_generator: { label: 'copy_generator', icon: '✦' },
  campaign_validator: { label: 'campaign_validator', icon: '✓' },
};

type Props = { event: ToolEvent; index: number };

function fmtBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

/**
 * Technical pills extracted from each tool's result. These are the
 * "machine-readable" highlights — shown in monospace right under
 * the rationale to give the demo a "real agent at work" feel.
 */
function techPills(event: ToolEvent): string[] {
  const r = event.result as Record<string, unknown> | undefined;
  if (!r) return [];

  if (event.tool === 'budget_validator') {
    const diaria = r.presupuesto_diario_calculado as number | undefined;
    const aprobado = r.aprobado as boolean | undefined;
    const out: string[] = [];
    if (typeof diaria === 'number') out.push(`$${diaria.toFixed(2)}/día`);
    out.push(aprobado === false ? 'rev. necesaria' : 'aprobado');
    return out;
  }

  if (event.tool === 'audience_analyzer') {
    const out: string[] = [];
    const tamano = r.tamano_estimado as number | undefined;
    const ageMin = r.edad_min as number | undefined;
    const ageMax = r.edad_max as number | undefined;
    const paises = r.paises as string[] | undefined;
    if (typeof tamano === 'number') out.push(`${fmtBig(tamano)} personas`);
    if (typeof ageMin === 'number' && typeof ageMax === 'number') out.push(`${ageMin}–${ageMax}`);
    if (Array.isArray(paises) && paises.length) out.push(paises.slice(0, 4).join(', '));
    return out;
  }

  if (event.tool === 'copy_generator') {
    const headline = r.headline as string | undefined;
    const cta = r.cta as string | undefined;
    const out: string[] = [];
    if (headline) out.push(`"${headline.length > 40 ? headline.slice(0, 38) + '…' : headline}"`);
    if (cta) out.push(`CTA · ${cta}`);
    return out;
  }

  if (event.tool === 'campaign_validator') {
    const checklist = r.checklist_results as Record<string, boolean> | undefined;
    const passed = r.passed as boolean | undefined;
    if (!checklist) return [passed ? 'OK' : 'falló'];
    const total = Object.keys(checklist).length;
    const ok = Object.values(checklist).filter(Boolean).length;
    return [`${ok}/${total} criterios`, passed === false ? 'falló' : 'OK'];
  }

  return [];
}

export default function ToolCard({ event, index }: Props) {
  const meta = TOOL_META[event.tool] ?? { label: event.tool, icon: '·' };
  const isDone = event.status === 'done';
  const elapsed =
    event.finishedAt && event.startedAt
      ? ((event.finishedAt - event.startedAt) / 1000).toFixed(1)
      : null;
  const pills = isDone ? techPills(event) : [];

  return (
    <div
      className="liquid-glass rounded-xl p-4 opacity-0 animate-aura-fade-up"
      style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5"
          style={{
            background: isDone ? 'rgba(16,185,129,0.12)' : 'rgba(0,210,255,0.08)',
            border: isDone
              ? '1px solid rgba(16,185,129,0.30)'
              : '1px solid rgba(164,244,253,0.25)',
          }}
        >
          {isDone ? (
            <Check className="w-3.5 h-3.5 text-[#10b981]" />
          ) : (
            <span
              className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#00d2ff', borderTopColor: 'transparent' }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Tool name */}
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/45"
              style={{ fontFamily: monoFont }}
            >
              {meta.icon}
            </span>
            <span
              className="text-[11px] font-medium text-white/70"
              style={{ fontFamily: monoFont }}
            >
              {meta.label}
            </span>
            {elapsed && (
              <span
                className="ml-auto text-[10px] text-white/35"
                style={{ fontFamily: monoFont }}
              >
                {elapsed}s
              </span>
            )}
          </div>

          {/* Rationale */}
          {event.rationale && (
            <p className="mt-2 text-xs text-white/80 leading-relaxed">{event.rationale}</p>
          )}

          {/* Tech pills (monospace highlights) */}
          {pills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pills.map((p, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-[#A4F4FD]/85 border border-white/[0.06]"
                  style={{ fontFamily: monoFont }}
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Running shimmer */}
          {!isDone && (
            <div className="mt-2 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-white/25 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
