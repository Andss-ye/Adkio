import type { Campaign } from '@/lib/dashboard-data';

type Props = { campaigns: Campaign[] };

export default function StatsBar({ campaigns }: Props) {
  if (campaigns.length === 0) return null;

  const totalBudget = campaigns.reduce((s, c) => s + (c.budget?.total ?? 0), 0);
  const active = campaigns.filter((c) => c.status === 'Activa').length;

  // Leads est. — parsea c.perf que viene como "~13 leads" del backend
  const totalLeads = campaigns.reduce((s, c) => {
    const match = c.perf?.match(/~?(\d+)/);
    return s + (match ? parseInt(match[1]) : 0);
  }, 0);

  // Canales únicos usados — antes era "Meta Ads" hardcoded
  const uniquePlatforms = Array.from(new Set(campaigns.map((c) => c.platform).filter(Boolean)));
  const platformLabel =
    uniquePlatforms.length === 0
      ? 'Sin lanzar'
      : uniquePlatforms.length === 1
        ? uniquePlatforms[0]
        : `${uniquePlatforms.length} plataformas`;

  // CPL promedio — derivamos del histórico de campañas que tengan rango
  // Por ahora mostramos "—" si no podemos calcular (mejor que mentir con $8-25)
  const cplLabel = computeCplLabel(campaigns);

  const stats = [
    { label: 'Campañas', value: `${campaigns.length}` },
    { label: 'Activas', value: `${active}`, accent: true },
    { label: 'Presupuesto', value: `$${Math.round(totalBudget).toLocaleString('en-US')}` },
    { label: 'Leads est.', value: `~${totalLeads}` },
    { label: 'CPL promedio', value: cplLabel },
    { label: 'Canal', value: platformLabel },
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
      <div className="ml-auto flex-shrink-0 flex items-center gap-1.5 text-[9px] text-white/25 border border-white/[0.07] rounded-full px-2.5 py-1 whitespace-nowrap">
        <span>🏆</span>
        <span>GTM Hackathon · Bogotá</span>
      </div>
    </div>
  );
}

/**
 * CPL promedio honesto. Parsea "$8–25 USD" o "$15 USD" de cada metric.
 * Si no hay datos suficientes, devuelve "—" en lugar de mentir.
 */
function computeCplLabel(campaigns: Campaign[]): string {
  const ranges = campaigns
    .map((c) => c.metrics?.find((m) => m.label.toLowerCase().includes('cpl'))?.value)
    .filter(Boolean) as string[];
  if (ranges.length === 0) return '—';

  const numbers: number[] = [];
  for (const r of ranges) {
    const range = r.match(/\$(\d+)[–-]\$?(\d+)/);
    if (range) {
      numbers.push(parseInt(range[1]), parseInt(range[2]));
      continue;
    }
    const single = r.match(/\$(\d+)/);
    if (single) numbers.push(parseInt(single[1]));
  }
  if (numbers.length === 0) return '—';

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  if (min === max) return `~$${min}`;
  return `$${min}–$${max}`;
}
