import { Star } from '@/components/ui/Icons';
import { STATUS_COLORS, type Campaign } from '@/lib/dashboard-data';
import StatusBadge from './StatusBadge';

type Props = {
  campaign: Campaign;
  isSelected: boolean;
  isSaved: boolean;
  onClick: () => void;
};

export default function CampaignCard({ campaign: m, isSelected, isSaved, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={
        'w-full text-left px-4 py-3 border-b border-white/5 cursor-pointer transition-colors block ' +
        (isSelected ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]')
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {m.unread && !isSelected && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#00d2ff' }} />
          )}
          {isSaved && <Star className="w-3 h-3 flex-shrink-0" color="#A4F4FD" />}
          <span
            className={
              'truncate text-xs ' +
              (m.unread && !isSelected ? 'text-white font-semibold' : isSelected ? 'text-white font-medium' : 'text-white/75')
            }
          >
            {m.name}
          </span>
        </div>
        <span className="text-white/40 text-[10px] flex-shrink-0 tabular-nums">{m.time}</span>
      </div>

      <div className={'mt-1 truncate text-xs ' + (m.unread && !isSelected ? 'text-white/85' : 'text-white/55')}>
        <span className="text-white/30">"</span>
        {m.prompt}
        <span className="text-white/30">"</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/55">
          {m.platform}
        </span>
        <StatusBadge status={m.status} size="xs" />
        <span
          className={
            'text-[10px] ml-auto ' +
            (m.perfTone === 'good' ? 'text-[#10b981]' : m.perfTone === 'warn' ? 'text-[#f59e0b]' : 'text-white/45')
          }
        >
          {m.perf}
        </span>
      </div>
    </button>
  );
}
