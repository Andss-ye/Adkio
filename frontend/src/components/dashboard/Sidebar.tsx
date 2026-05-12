import { Sparkles, Inbox, Star, Send, FileText, Archive, ChevronRight, Plus } from '@/components/ui/Icons';
import LogoMark from '@/components/ui/LogoMark';
import { STATUS_COLORS, type Campaign, type CampaignStatus } from '@/lib/dashboard-data';

type ViewKey = 'campañas' | 'guardadas' | 'activas' | 'borradores' | 'archivo';

const STATUS_LABELS: { name: CampaignStatus; color: string }[] = [
  { name: 'Activa', color: STATUS_COLORS.Activa },
  { name: 'Pausada', color: STATUS_COLORS.Pausada },
  { name: 'Borrador', color: STATUS_COLORS.Borrador },
  { name: 'Revisión', color: STATUS_COLORS.Revisión },
];

type Props = {
  view: ViewKey;
  statusFilter: CampaignStatus | null;
  counts: { total: number; saved: number; active: number; drafts: number; archived: number; review: number };
  liveCampaigns: Campaign[];
  allCampaigns: Campaign[];
  onViewClick: (k: ViewKey) => void;
  onStatusClick: (s: CampaignStatus) => void;
  onClearStatus: () => void;
  onNew: () => void;
};

const NAV: { key: ViewKey; Icon: typeof Inbox; label: string; count: keyof Props['counts'] }[] = [
  { key: 'campañas', Icon: Inbox, label: 'Campañas', count: 'total' },
  { key: 'guardadas', Icon: Star, label: 'Guardadas', count: 'saved' },
  { key: 'activas', Icon: Send, label: 'Activas', count: 'active' },
  { key: 'borradores', Icon: FileText, label: 'Borradores', count: 'drafts' },
  { key: 'archivo', Icon: Archive, label: 'Archivo', count: 'archived' },
];

export default function Sidebar({ view, statusFilter, counts, liveCampaigns, allCampaigns, onViewClick, onStatusClick, onClearStatus, onNew }: Props) {
  const source = liveCampaigns.length > 0 ? liveCampaigns : allCampaigns;
  const totalBudget = liveCampaigns.reduce((s, c) => s + (c.budget?.total ?? 0), 0);

  return (
    <aside className="border-r border-white/10 bg-black/30 backdrop-blur-md flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-4">
        <button
          onClick={onNew}
          className="group rounded-lg bg-white text-black text-xs font-semibold px-3 py-2.5 inline-flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.98] transition-all flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva campaña</span>
          <ChevronRight className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover:translate-x-[1px]" />
        </button>

        <nav className="flex flex-col gap-0.5">
          <button
            onClick={onNew}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-white/60 hover:bg-white/5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" color="#A4F4FD" />
            <span className="flex-1 text-left">Generar</span>
            <ChevronRight className="w-3 h-3 text-white/30" />
          </button>

          {NAV.map(({ key, Icon, label, count }) => {
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => onViewClick(key)}
                className={
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ' +
                  (active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/85')
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">{label}</span>
                <span className={'text-[10px] tabular-nums ' + (active ? 'text-white/70' : 'text-white/40')}>
                  {counts[count]}
                </span>
              </button>
            );
          })}
        </nav>

        <div>
          <div className="flex items-center justify-between px-2.5 mb-2">
            <span className="text-[10px] uppercase tracking-widest text-white/30">Estado</span>
            {statusFilter && (
              <button onClick={onClearStatus} className="text-[9px] text-white/40 hover:text-white/70 underline underline-offset-2">
                Limpiar
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {STATUS_LABELS.map((l) => {
              const active = statusFilter === l.name;
              const statusCount = source.filter((c) => !c.archived && c.status === l.name).length;
              return (
                <button
                  key={l.name}
                  onClick={() => onStatusClick(l.name)}
                  className={
                    'flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-md transition-colors ' +
                    (active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/85')
                  }
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
                  <span className="flex-1 text-left">{l.name}</span>
                  <span className={'text-[10px] tabular-nums ' + (active ? 'text-white/70' : 'text-white/35')}>
                    {statusCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Spend card */}
      <div className="flex-shrink-0 p-4 border-t border-white/10">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
          {liveCampaigns.length > 0 ? (
            <>
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Inversión planificada</div>
              <div className="text-2xl font-semibold text-white tracking-tight">
                ${Math.round(totalBudget).toLocaleString('en-US')}
              </div>
              <div className="text-[11px] text-white/50 mt-1">
                {liveCampaigns.length} {liveCampaigns.length === 1 ? 'campaña creada' : 'campañas creadas'}
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Gasto hoy</div>
              <div className="text-2xl font-semibold text-white tracking-tight">
                $1,284.<span className="text-white/40 text-base">12</span>
              </div>
              <div className="text-[11px] text-[#10b981] mt-1 font-medium">▲ 3.6x ROAS</div>
            </>
          )}
          <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <div className="text-white/40">Activas</div>
              <div className="text-white/85 font-medium">{counts.active}</div>
            </div>
            <div>
              <div className="text-white/40">En revisión</div>
              <div className="text-white/85 font-medium">{counts.review}</div>
            </div>
          </div>
        </div>

        {/* GTM Hackathon credit — subtle, professional */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[9px] text-white/20">
          <LogoMark className="w-2.5 h-2.5 opacity-40" />
          <span>MVP · GTM Hackathon Bogotá · 36h</span>
        </div>
      </div>
    </aside>
  );
}
