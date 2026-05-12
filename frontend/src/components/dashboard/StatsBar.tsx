import type { Campaign } from '@/lib/dashboard-data';

type Props = { campaigns: Campaign[] };

export default function StatsBar({ campaigns }: Props) {
  if (campaigns.length === 0) return null;

  const totalBudget = campaigns.reduce((s, c) => s + (c.budget?.total ?? 0), 0);
  const active = campaigns.filter((c) => c.status === 'Activa').length;
  const totalLeads = campaigns.reduce((s, c) => {
    const match = c.perf?.match(/~?(\d+)/);
    return s + (match ? parseInt(match[1]) : 0);
  }, 0);

  const stats = [
    { label: 'Campañas', value: `${campaigns.length}` },
    { label: 'Activas', value: `${active}`, accent: true },
    { label: 'Presupuesto', value: `$${Math.round(totalBudget).toLocaleString('en-US')}` },
    { label: 'Leads est.', value: `~${totalLeads}` },
    { label: 'CPL promedio', value: '$8–25 USD' },
    { label: 'Canal', value: 'Meta Ads' },
  ];

  return (
    <div className="flex-shrink-0 border-b border-white/10 px-4 py-2 flex items-center gap-6 bg-black/20 overflow-x-auto no-scrollbar">
      {stats.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2 min-w-0 flex-shrink-0">
          {i > 0 && <span className="w-px h-3 bg-white/10" />}
          <span className="text-[10px] text-white/35 uppercase tracking-widest whitespace-nowrap">{s.label}</span>
          <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${s.accent ? 'text-[#10b981]' : 'text-white/80'}`}>
            {s.value}
          </span>
        </div>
      ))}
      {/* GTM Hackathon badge */}
      <div className="ml-auto flex-shrink-0 flex items-center gap-1.5 text-[9px] text-white/25 border border-white/[0.07] rounded-full px-2.5 py-1 whitespace-nowrap">
        <span>🏆</span>
        <span>GTM Hackathon · Bogotá</span>
      </div>
    </div>
  );
}
