import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Inbox,
  Star,
  Send,
  FileText,
  Archive,
  Search,
  Forward,
  MoreHorizontal,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pause,
  Play,
  Filter,
  Globe,
  Users,
  Calendar,
} from '@/components/ui/Icons';
import NoiseFilter from '@/components/ui/NoiseFilter';
import LogoMark from '@/components/ui/LogoMark';
import { monoFont } from '@/lib/styles';
import {
  campaigns,
  getCampaignsCount,
  STATUS_COLORS,
  type Campaign,
  type CampaignStatus,
} from '@/lib/dashboard-data';

type ViewKey = 'campañas' | 'guardadas' | 'activas' | 'borradores' | 'archivo';

const VIEW_LABELS: Record<ViewKey, string> = {
  campañas: 'Todas las campañas',
  guardadas: 'Guardadas',
  activas: 'Activas',
  borradores: 'Borradores',
  archivo: 'Archivo',
};

const STATUS_LABELS: { name: CampaignStatus; color: string }[] = [
  { name: 'Activa', color: STATUS_COLORS.Activa },
  { name: 'Pausada', color: STATUS_COLORS.Pausada },
  { name: 'Borrador', color: STATUS_COLORS.Borrador },
  { name: 'Revisión', color: STATUS_COLORS.Revisión },
];

const BACKEND: string =
  (import.meta as { env?: { VITE_BACKEND_URL?: string } }).env?.VITE_BACKEND_URL ??
  'http://localhost:8000';

function mapBackendCampaign(b: Record<string, unknown>): Campaign {
  const status: Campaign['status'] =
    String(b.status ?? '').toUpperCase() === 'ACTIVE' ? 'Activa' : 'Pausada';
  const budget_usd = Number(b.budget_usd ?? 0);
  const duration_days = Number(b.duration_days ?? 14);
  const created_at = String(b.created_at ?? '');
  const relTime = created_at
    ? new Date(created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    : 'Hoy';
  const paises = (b.paises as string[] | null) ?? [];
  const leads = Number(b.expected_leads ?? 0);
  return {
    id: String(b.id ?? Math.random()),
    name: String(b.copy_headline ?? 'Campaña Adkio'),
    prompt: String(b.user_prompt ?? ''),
    perf: leads > 0 ? `~${leads} leads` : String(b.estimated_reach ?? ''),
    perfTone: 'good',
    time: relTime,
    status,
    saved: false,
    archived: false,
    unread: true,
    platform: 'Meta',
    liveSince: relTime,
    audience: {
      label: paises.join(', ') || 'LATAM',
      reach: String(b.estimated_reach ?? ''),
      cpm: '',
    },
    budget: { dia: budget_usd / duration_days, dias: duration_days, total: budget_usd },
    variants: [
      {
        color: '#00d2ff',
        headline: String(b.copy_headline ?? ''),
        cta: String(b.copy_cta ?? 'Ver más'),
      },
    ],
    rationale: String(b.copy_body ?? ''),
    metrics: leads > 0
      ? [
          { label: 'Leads estimados', value: `~${leads}`, good: true },
          { label: 'CPL', value: `$${Number(b.cpl_usd ?? 15).toFixed(0)}`, good: true },
          { label: 'Inversión', value: `$${budget_usd.toFixed(0)}`, good: true },
        ]
      : undefined,
  };
}

export default function DashboardPage() {
  const [view, setView] = useState<ViewKey>('campañas');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>(campaigns[0].id);
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(campaigns.map((c) => [c.id, c.saved])),
  );
  const [liveCampaigns, setLiveCampaigns] = useState<Campaign[]>([]);

  /* Fetch real campaigns from backend — prepend to mock data */
  useEffect(() => {
    fetch(`${BACKEND}/campaigns`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const mapped = (data as Record<string, unknown>[]).map(mapBackendCampaign);
        setLiveCampaigns(mapped);
        /* auto-select the most recent real campaign */
        setSelectedId(mapped[0].id);
        setSavedMap((prev) => ({
          ...Object.fromEntries(mapped.map((c) => [c.id, false])),
          ...prev,
        }));
      })
      .catch(() => { /* backend offline — mock data already showing */ });
  }, []);

  /* ─── live counts (use real campaigns if available, else mock) ─── */
  const counts = useMemo(() => {
    const source = liveCampaigns.length > 0 ? liveCampaigns : campaigns;
    const total = source.filter((c) => !c.archived).length;
    const saved = source.filter((c) => !c.archived && savedMap[c.id]).length;
    const active = source.filter((c) => !c.archived && c.status === 'Activa').length;
    const drafts = source.filter((c) => !c.archived && c.status === 'Borrador').length;
    const archived = source.filter((c) => c.archived).length;
    const review = source.filter((c) => !c.archived && c.status === 'Revisión').length;
    return { total, saved, active, drafts, archived, review };
  }, [savedMap, liveCampaigns]);

  /* keep getCampaignsCount export consistent for any external use */
  void getCampaignsCount;

  const nav: { key: ViewKey; Icon: typeof Inbox; label: string; count: number }[] = [
    { key: 'campañas', Icon: Inbox, label: 'Campañas', count: counts.total },
    { key: 'guardadas', Icon: Star, label: 'Guardadas', count: counts.saved },
    { key: 'activas', Icon: Send, label: 'Activas', count: counts.active },
    { key: 'borradores', Icon: FileText, label: 'Borradores', count: counts.drafts },
    { key: 'archivo', Icon: Archive, label: 'Archivo', count: counts.archived },
  ];

  /* ─── filter logic ─── */
  const filtered = useMemo(() => {
    /* If backend returned real campaigns, use only those. Otherwise show mock. */
    let list: Campaign[] = liveCampaigns.length > 0 ? liveCampaigns : campaigns;

    /* primary view */
    if (view === 'archivo') {
      list = list.filter((c) => c.archived);
    } else {
      list = list.filter((c) => !c.archived);
      if (view === 'guardadas') list = list.filter((c) => savedMap[c.id]);
      if (view === 'activas') list = list.filter((c) => c.status === 'Activa');
      if (view === 'borradores') list = list.filter((c) => c.status === 'Borrador');
    }

    /* secondary status filter (orthogonal) */
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);

    /* free-text search */
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.prompt.toLowerCase().includes(q),
      );
    }

    return list;
  }, [view, statusFilter, search, savedMap, liveCampaigns]);

  /* keep selectedId synced with the filtered list — fall back to the
     first item whenever the current selection isn't visible anymore */
  useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  /* handlers */
  const handleViewClick = (key: ViewKey) => {
    setView(key);
    setStatusFilter(null);
    /* explicitly snap selection to the new list's first item so the
       detail panel updates immediately even before the effect runs */
    const next = (() => {
      if (key === 'archivo') return campaigns.filter((c) => c.archived);
      const base = campaigns.filter((c) => !c.archived);
      if (key === 'guardadas') return base.filter((c) => savedMap[c.id]);
      if (key === 'activas') return base.filter((c) => c.status === 'Activa');
      if (key === 'borradores') return base.filter((c) => c.status === 'Borrador');
      return base;
    })();
    if (next.length > 0) setSelectedId(next[0].id);
  };

  const handleStatusClick = (s: CampaignStatus) => {
    /* same status → clear */
    if (statusFilter === s) {
      setStatusFilter(null);
      return;
    }
    setStatusFilter(s);
    /* avoid empty-list dead-ends: when the active view contradicts the
       status (e.g. view=borradores, status=Activa), pivot to a broader
       view that contains that status */
    const incompatible =
      (view === 'activas' && s !== 'Activa') ||
      (view === 'borradores' && s !== 'Borrador') ||
      (view === 'guardadas' && false) /* guardadas is compatible with any status */ ||
      view === 'archivo';
    if (incompatible) setView('campañas');
  };

  const goTo = (path: string) => {
    window.location.href = path;
  };

  const toggleSaved = (id: string) => {
    setSavedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden text-white"
      style={{ background: '#0a0d12' }}
    >
      <NoiseFilter />

      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute top-0 left-0 w-[60vw] h-[60vh] opacity-40"
          style={{
            background:
              'radial-gradient(closest-side, rgba(0,210,255,0.12), rgba(0,0,0,0) 70%)',
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-[50vw] h-[50vh] opacity-30"
          style={{
            background:
              'radial-gradient(closest-side, rgba(164,244,253,0.08), rgba(0,0,0,0) 70%)',
          }}
        />
      </div>

      {/* Window chrome */}
      <div className="relative z-10 h-9 flex items-center px-4 border-b border-white/10 bg-black/40 backdrop-blur-md flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => goTo('/')}
            className="w-3 h-3 rounded-full transition-opacity hover:opacity-75"
            style={{ background: '#ff5f57' }}
            title="Volver al inicio"
          />
          <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-white/50">
          <LogoMark className="w-3.5 h-3.5" />
          <span>Adkio — Workspace de campañas</span>
        </div>

        <div className="ml-auto flex items-center gap-2 text-[10px] text-white/40">
          <span className="inline-flex items-center gap-1">
            <span className="relative flex w-1.5 h-1.5">
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: '#10b981', opacity: 0.6 }}
              />
              <span
                className="relative rounded-full w-1.5 h-1.5"
                style={{ background: '#10b981' }}
              />
            </span>
            <span>Sincronizado con Meta</span>
          </span>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div
        className="relative z-10 flex-1 grid overflow-hidden opacity-0 animate-aura-fade-up"
        style={{ gridTemplateColumns: '260px 380px 1fr', animationDelay: '0.05s' }}
      >
        {/* ── Sidebar ── */}
        <aside className="border-r border-white/10 bg-black/30 backdrop-blur-md flex flex-col overflow-hidden">
          {/* Scrollable nav section */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-4">
            <button
              onClick={() => goTo('/app')}
              className="group rounded-lg bg-white text-black text-xs font-semibold px-3 py-2.5 inline-flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.98] transition-all flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva campaña</span>
              <ChevronRight className="w-3.5 h-3.5 ml-0.5 transition-transform group-hover:translate-x-[1px]" />
            </button>

            <nav className="flex flex-col gap-0.5">
              <button
                onClick={() => goTo('/app')}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-white/60 hover:bg-white/5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" color="#A4F4FD" />
                <span className="flex-1 text-left">Generar</span>
                <ChevronRight className="w-3 h-3 text-white/30" />
              </button>

              {nav.map(({ key, Icon, label, count }) => {
                const active = view === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleViewClick(key)}
                    className={
                      'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ' +
                      (active
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:bg-white/5 hover:text-white/85')
                    }
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="flex-1 text-left">{label}</span>
                    <span
                      className={
                        'text-[10px] tabular-nums ' +
                        (active ? 'text-white/70' : 'text-white/40')
                      }
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div>
              <div className="flex items-center justify-between px-2.5 mb-2">
                <span className="text-[10px] uppercase tracking-widest text-white/30">
                  Estado
                </span>
                {statusFilter && (
                  <button
                    onClick={() => setStatusFilter(null)}
                    className="text-[9px] text-white/40 hover:text-white/70 underline underline-offset-2"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {STATUS_LABELS.map((l) => {
                  const active = statusFilter === l.name;
                  const source = liveCampaigns.length > 0 ? liveCampaigns : campaigns;
                  const statusCount = source.filter(
                    (c) => !c.archived && c.status === l.name,
                  ).length;
                  return (
                    <button
                      key={l.name}
                      onClick={() => handleStatusClick(l.name)}
                      className={
                        'flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-md transition-colors ' +
                        (active
                          ? 'bg-white/10 text-white'
                          : 'text-white/60 hover:bg-white/5 hover:text-white/85')
                      }
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: l.color }}
                      />
                      <span className="flex-1 text-left">{l.name}</span>
                      <span
                        className={
                          'text-[10px] tabular-nums ' +
                          (active ? 'text-white/70' : 'text-white/35')
                        }
                      >
                        {statusCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Spend card — calculado de campañas reales si hay backend */}
          <div className="flex-shrink-0 p-4 border-t border-white/10">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              {liveCampaigns.length > 0 ? (
                <>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                    Inversión planificada
                  </div>
                  <div className="text-2xl font-semibold text-white tracking-tight">
                    ${Math.round(liveCampaigns.reduce((s, c) => s + (c.budget?.total ?? 0), 0)).toLocaleString('en-US')}
                  </div>
                  <div className="text-[11px] text-white/50 mt-1">
                    {liveCampaigns.length} {liveCampaigns.length === 1 ? 'campaña creada' : 'campañas creadas'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                    Gasto hoy
                  </div>
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
          </div>
        </aside>

        {/* ── Campaign list ── */}
        <div className="border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-md min-w-0">
          {/* Search */}
          <div className="h-12 border-b border-white/10 flex items-center gap-2 px-4 flex-shrink-0">
            <Search className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar campañas o prompts"
              className="flex-1 bg-transparent text-xs text-white placeholder:text-white/35 outline-none min-w-0"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-[10px] text-white/40 hover:text-white/70"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Title row */}
          <div className="h-9 border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-white/70 font-medium truncate">
                {VIEW_LABELS[view]}
              </span>
              <span className="text-[10px] text-white/35 tabular-nums">
                {filtered.length}
              </span>
              {statusFilter && (
                <span
                  className="ml-1 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/10 inline-flex items-center gap-1"
                  style={{ color: STATUS_COLORS[statusFilter] }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: STATUS_COLORS[statusFilter] }}
                  />
                  {statusFilter}
                </span>
              )}
            </div>
            <button
              className="text-white/40 hover:text-white/70 transition-colors"
              title="Filtros"
            >
              <Filter className="w-3 h-3" />
            </button>
          </div>

          {/* List — min-h shows ~5 items; styled scroll beyond that */}
          <div className="flex-1 overflow-y-auto dark-scroll min-h-[400px]">
            {filtered.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center">
                  <Search className="w-4 h-4 text-white/25" />
                </div>
                <p className="text-xs text-white/35 leading-relaxed">
                  Nada por acá todavía.
                  <br />
                  Probá otra búsqueda o cambiá la vista.
                </p>
              </div>
            )}

            {filtered.map((m) => {
              const isSelected = m.id === (selected?.id ?? '');
              const statusColor = STATUS_COLORS[m.status];
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={
                    'w-full text-left px-4 py-3 border-b border-white/5 cursor-pointer transition-colors block ' +
                    (isSelected ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.unread && !isSelected && (
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: '#00d2ff' }}
                        />
                      )}
                      {savedMap[m.id] && (
                        <Star
                          className="w-3 h-3 flex-shrink-0"
                          color="#A4F4FD"
                        />
                      )}
                      <span
                        className={
                          'truncate text-xs ' +
                          (m.unread && !isSelected
                            ? 'text-white font-semibold'
                            : isSelected
                              ? 'text-white font-medium'
                              : 'text-white/75')
                        }
                      >
                        {m.name}
                      </span>
                    </div>
                    <span className="text-white/40 text-[10px] flex-shrink-0 tabular-nums">
                      {m.time}
                    </span>
                  </div>
                  <div
                    className={
                      'mt-1 truncate text-xs ' +
                      (m.unread && !isSelected ? 'text-white/85' : 'text-white/55')
                    }
                  >
                    <span className="text-white/30">"</span>
                    {m.prompt}
                    <span className="text-white/30">"</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/55">
                      {m.platform}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                      style={{
                        color: statusColor,
                        background: `${statusColor}14`,
                        border: `1px solid ${statusColor}33`,
                      }}
                    >
                      <span
                        className="w-1 h-1 rounded-full"
                        style={{ background: statusColor }}
                      />
                      {m.status}
                    </span>
                    <span
                      className={
                        'text-[10px] ml-auto ' +
                        (m.perfTone === 'good'
                          ? 'text-[#10b981]'
                          : m.perfTone === 'warn'
                            ? 'text-[#f59e0b]'
                            : 'text-white/45')
                      }
                    >
                      {m.perf}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Detail panel ── */}
        <div className="flex flex-col min-w-0">
          {!selected && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl liquid-glass flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white/25" />
              </div>
              <p className="text-xs text-white/35 leading-relaxed max-w-xs">
                Seleccioná una campaña para ver el detalle, métricas y variantes.
              </p>
            </div>
          )}

          {selected && (
            <DetailPanel
              campaign={selected}
              isSaved={!!savedMap[selected.id]}
              onToggleSaved={() => toggleSaved(selected.id)}
              onNew={() => goTo('/app')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Detail panel                                              */
/* ────────────────────────────────────────────────────────── */

function DetailPanel({
  campaign,
  isSaved,
  onToggleSaved,
  onNew,
}: {
  campaign: Campaign;
  isSaved: boolean;
  onToggleSaved: () => void;
  onNew: () => void;
}) {
  const statusColor = STATUS_COLORS[campaign.status];
  const isLive = campaign.status === 'Activa';

  return (
    <>
      {/* Header */}
      <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-1 text-white/60">
          <button className="px-2.5 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px] transition-colors">
            <Sparkles className="w-3 h-3" />
            Refinar
          </button>
          <button className="px-2.5 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px] transition-colors">
            <Forward className="w-3 h-3" />
            Duplicar
          </button>
          {isLive ? (
            <button className="px-2.5 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px] transition-colors">
              <Pause className="w-3 h-3" />
              Pausar
            </button>
          ) : (
            <button className="px-2.5 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px] transition-colors">
              <Play className="w-3 h-3" />
              Reanudar
            </button>
          )}
          <button
            onClick={onToggleSaved}
            className={
              'px-2.5 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px] transition-colors ' +
              (isSaved ? 'text-[#A4F4FD]' : 'text-white/60')
            }
          >
            <Star className="w-3 h-3" color={isSaved ? '#A4F4FD' : 'currentColor'} />
            {isSaved ? 'Guardada' : 'Guardar'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] text-black bg-white hover:bg-white/90 transition-colors font-semibold"
          >
            <Plus className="w-3 h-3" />
            Nueva
          </button>
          <button className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center text-white/60 transition-colors">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        {/* Title */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-white tracking-tight leading-tight">
              {campaign.name}
            </h2>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-white/55 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                style={{
                  color: statusColor,
                  background: `${statusColor}12`,
                  border: `1px solid ${statusColor}30`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                {campaign.status}
              </span>
              <span>·</span>
              <span>{campaign.liveSince}</span>
              <span>·</span>
              <span>{campaign.platform} Ads</span>
              <span>·</span>
              <span style={{ fontFamily: monoFont }} className="text-white/40">
                {campaign.id}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              Performance
            </div>
            <div
              className={
                'text-base font-semibold mt-1 ' +
                (campaign.perfTone === 'good'
                  ? 'text-[#10b981]'
                  : campaign.perfTone === 'warn'
                    ? 'text-[#f59e0b]'
                    : 'text-white/70')
              }
            >
              {campaign.perf}
            </div>
          </div>
        </div>

        {/* Prompt */}
        <div className="liquid-glass rounded-xl p-4 mt-6">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
            Prompt original
          </div>
          <div className="text-sm text-white/85 leading-relaxed font-medium">
            <span className="text-white/30">"</span>
            {campaign.prompt}
            <span className="text-white/30">"</span>
          </div>
        </div>

        {/* AI rationale */}
        <div className="liquid-glass rounded-xl p-4 mt-3 flex items-start gap-3">
          <div
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(0,210,255,0.08)',
              border: '1px solid rgba(164,244,253,0.30)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" color="#A4F4FD" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-white/45 mb-1">
              Razonamiento de Adkio
            </div>
            <p className="text-xs text-white/85 leading-relaxed">{campaign.rationale}</p>
          </div>
        </div>

        {/* Metrics (live) */}
        {campaign.metrics && campaign.metrics.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
              Métricas en vivo
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {campaign.metrics.map((mt) => (
                <div key={mt.label} className="liquid-glass rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/40">
                    {mt.label}
                  </div>
                  <div className="mt-1 text-base font-semibold text-white tabular-nums">
                    {mt.value}
                  </div>
                  {mt.delta && (
                    <div
                      className={
                        'text-[10px] mt-0.5 ' + (mt.good ? 'text-[#10b981]' : 'text-[#f59e0b]')
                      }
                    >
                      ▲ {mt.delta}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audience + Budget */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="liquid-glass rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 mb-2">
              <Users className="w-3 h-3" />
              Audiencia
            </div>
            <div className="text-sm text-white font-medium">{campaign.audience.label}</div>
            <div className="mt-1 text-[11px] text-white/50 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>Alcance {campaign.audience.reach}</span>
            </div>
            <div className="text-[11px] text-white/50">{campaign.audience.cpm}</div>
          </div>
          <div className="liquid-glass rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 mb-2">
              <Calendar className="w-3 h-3" />
              Presupuesto
            </div>
            <div className="text-sm text-white font-medium tabular-nums">
              ${campaign.budget.dia.toLocaleString()} / día
            </div>
            <div className="mt-1 text-[11px] text-white/50">
              {campaign.budget.dias} días · Total ${campaign.budget.total.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {campaign.warnings && campaign.warnings.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-[#f59e0b]/80 mb-2">
              Advertencias
            </div>
            {campaign.warnings.map((w, i) => (
              <div
                key={i}
                className="text-[11px] text-[#f59e0b]/90 leading-relaxed flex items-start gap-2"
              >
                <span>·</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
