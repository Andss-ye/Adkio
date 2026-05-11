import type { ToolEvent, StreamStatus } from '@/hooks/useCampaignStream';
import { Sparkles } from '@/components/ui/Icons';
import ToolCard from './ToolCard';

type Props = {
  toolEvents: ToolEvent[];
  status: StreamStatus;
};

export default function ReasoningPanel({ toolEvents, status }: Props) {
  const isEmpty = toolEvents.length === 0;

  return (
    <div className="flex flex-col h-full border-r border-white/10">
      {/* Header */}
      <div className="h-10 flex items-center gap-2 px-4 border-b border-white/10">
        <Sparkles className="w-3.5 h-3.5 text-white/40" />
        <span className="text-xs text-white/50 font-medium tracking-wide">
          Razonamiento del agente
        </span>
        {status === 'streaming' && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/40 animate-pulse">
            Procesando…
          </span>
        )}
        {status === 'plan_ready' && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-[#10b981]/30 text-[#10b981]">
            Completado
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3">
        {isEmpty && status === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white/20" />
            </div>
            <p className="text-xs text-white/30 leading-relaxed">
              El agente mostrará su razonamiento aquí en tiempo real, paso a paso.
            </p>
          </div>
        )}

        {isEmpty && status === 'streaming' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {toolEvents.map((evt, i) => (
          <ToolCard key={evt.tool} event={evt} index={i} />
        ))}
      </div>
    </div>
  );
}
