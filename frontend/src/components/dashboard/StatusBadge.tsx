import { STATUS_COLORS, type CampaignStatus } from '@/lib/dashboard-data';

type Props = { status: CampaignStatus; size?: 'sm' | 'xs' };

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const color = STATUS_COLORS[status];
  const sz = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-1.5 py-0.5';
  return (
    <span
      className={`${sz} rounded inline-flex items-center gap-1 tabular-nums`}
      style={{ color, background: `${color}14`, border: `1px solid ${color}33` }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}
