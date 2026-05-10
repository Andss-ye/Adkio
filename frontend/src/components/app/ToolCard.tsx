import type { ToolEvent } from '@/hooks/useCampaignStream';
import { Check } from '@/components/ui/Icons';
import { monoFont } from '@/lib/styles';

const TOOL_META: Record<string, { label: string; icon: string }> = {
  budget_validator:   { label: 'budget_validator',   icon: '$' },
  audience_analyzer:  { label: 'audience_analyzer',  icon: '◎' },
  copy_generator:     { label: 'copy_generator',     icon: '✦' },
  campaign_validator: { label: 'campaign_validator', icon: '✓' },
};

type Props = { event: ToolEvent; index: number };

export default function ToolCard({ event, index }: Props) {
  const meta = TOOL_META[event.tool] ?? { label: event.tool, icon: '·' };
  const isDone = event.status === 'done';
  const elapsed = event.finishedAt && event.startedAt
    ? ((event.finishedAt - event.startedAt) / 1000).toFixed(1)
    : null;

  return (
    <div
      className="liquid-glass rounded-xl p-4 opacity-0 animate-aura-fade-up"
      style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5"
          style={{ background: isDone ? 'rgba(16,185,129,0.12)' : 'rgba(0,210,255,0.08)' }}>
          {isDone ? (
            <Check className="w-3.5 h-3.5 text-[#10b981]" />
          ) : (
            <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#00d2ff', borderTopColor: 'transparent' }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Tool name */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/40"
              style={{ fontFamily: monoFont }}>
              {meta.icon}
            </span>
            <span className="text-[11px] font-medium text-white/60"
              style={{ fontFamily: monoFont }}>
              {meta.label}
            </span>
            {elapsed && (
              <span className="ml-auto text-[10px] text-white/30" style={{ fontFamily: monoFont }}>
                {elapsed}s
              </span>
            )}
          </div>

          {/* Rationale */}
          {event.rationale && (
            <p className="mt-2 text-xs text-white/75 leading-relaxed">
              {event.rationale}
            </p>
          )}

          {/* Running shimmer */}
          {!isDone && (
            <div className="mt-2 flex gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1 h-1 rounded-full bg-white/20 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
