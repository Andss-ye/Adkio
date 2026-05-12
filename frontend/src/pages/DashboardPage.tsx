import { useEffect, useMemo, useState } from 'react';
import NoiseFilter from '@/components/ui/NoiseFilter';
import LogoMark from '@/components/ui/LogoMark';
import { Sparkles } from '@/components/ui/Icons';
import { campaigns, getCampaignsCount, type Campaign, type CampaignStatus } from '@/lib/dashboard-data';
import Sidebar from '@/components/dashboard/Sidebar';
import CampaignList from '@/components/dashboard/CampaignList';
import CampaignDetail from '@/components/dashboard/CampaignDetail';
import StatsBar from '@/components/dashboard/StatsBar';

type ViewKey = 'campañas' | 'guardadas' | 'activas' | 'borradores' | 'archivo';

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
    audience: { label: paises.join(', ') || 'LATAM', reach: String(b.estimated_reach ?? ''), cpm: '' },
    budget: { dia: budget_usd / duration_days, dias: duration_days, total: budget_usd },
    variants: [{ color: '#00d2ff', headline: String(b.copy_headline ?? ''), cta: String(b.copy_cta ?? 'Ver más') }],
    rationale: String(b.copy_body ?? ''),
    metrics: leads > 0
      ? [
          { label: 'Leads estimados', value: `~${leads}`, good: true },
          { label: 'CPL estimado', value: '$8–25 USD', good: true },
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

  useEffect(() => {
    fetch(`${BACKEND}/campaigns`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const mapped = (data as Record<string, unknown>[]).map(mapBackendCampaign);
        setLiveCampaigns(mapped);
        setSelectedId(mapped[0].id);
        setSavedMap((prev) => ({ ...Object.fromEntries(mapped.map((c) => [c.id, false])), ...prev }));
      })
      .catch(() => {});
  }, []);

  void getCampaignsCount;

  const counts = useMemo(() => {
    const source = liveCampaigns.length > 0 ? liveCampaigns : campaigns;
    return {
      total: source.filter((c) => !c.archived).length,
      saved: source.filter((c) => !c.archived && savedMap[c.id]).length,
      active: source.filter((c) => !c.archived && c.status === 'Activa').length,
      drafts: source.filter((c) => !c.archived && c.status === 'Borrador').length,
      archived: source.filter((c) => c.archived).length,
      review: source.filter((c) => !c.archived && c.status === 'Revisión').length,
    };
  }, [savedMap, liveCampaigns]);

  const filtered = useMemo(() => {
    let list: Campaign[] = liveCampaigns.length > 0 ? liveCampaigns : campaigns;
    if (view === 'archivo') { list = list.filter((c) => c.archived); }
    else {
      list = list.filter((c) => !c.archived);
      if (view === 'guardadas') list = list.filter((c) => savedMap[c.id]);
      if (view === 'activas') list = list.filter((c) => c.status === 'Activa');
      if (view === 'borradores') list = list.filter((c) => c.status === 'Borrador');
    }
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.prompt.toLowerCase().includes(q));
    }
    return list;
  }, [view, statusFilter, search, savedMap, liveCampaigns]);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((c) => c.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  const handleViewClick = (key: ViewKey) => {
    setView(key);
    setStatusFilter(null);
    const src = liveCampaigns.length > 0 ? liveCampaigns : campaigns;
    const next = (() => {
      if (key === 'archivo') return src.filter((c) => c.archived);
      const base = src.filter((c) => !c.archived);
      if (key === 'guardadas') return base.filter((c) => savedMap[c.id]);
      if (key === 'activas') return base.filter((c) => c.status === 'Activa');
      if (key === 'borradores') return base.filter((c) => c.status === 'Borrador');
      return base;
    })();
    if (next.length > 0) setSelectedId(next[0].id);
  };

  const handleStatusClick = (s: CampaignStatus) => {
    if (statusFilter === s) { setStatusFilter(null); return; }
    setStatusFilter(s);
    const incompatible =
      (view === 'activas' && s !== 'Activa') ||
      (view === 'borradores' && s !== 'Borrador') ||
      view === 'archivo';
    if (incompatible) setView('campañas');
  };

  const goTo = (path: string) => { window.location.href = path; };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden text-white" style={{ background: '#0a0d12' }}>
      <NoiseFilter />

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-0 w-[60vw] h-[60vh] opacity-40"
          style={{ background: 'radial-gradient(closest-side, rgba(0,210,255,0.12), rgba(0,0,0,0) 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[50vw] h-[50vh] opacity-30"
          style={{ background: 'radial-gradient(closest-side, rgba(164,244,253,0.08), rgba(0,0,0,0) 70%)' }} />
      </div>

      {/* Window chrome */}
      <div className="relative z-10 h-9 flex items-center px-4 border-b border-white/10 bg-black/40 backdrop-blur-md flex-shrink-0">
        <div className="flex gap-2">
          <button onClick={() => goTo('/')} className="w-3 h-3 rounded-full transition-opacity hover:opacity-75" style={{ background: '#ff5f57' }} />
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
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: '#10b981', opacity: 0.6 }} />
              <span className="relative rounded-full w-1.5 h-1.5" style={{ background: '#10b981' }} />
            </span>
            <span>Sincronizado con Meta</span>
          </span>
        </div>
      </div>

      {/* Stats bar — only when real campaigns are loaded */}
      <div className="relative z-10">
        <StatsBar campaigns={liveCampaigns} />
      </div>

      {/* Main 3-column layout */}
      <div
        className="relative z-10 flex-1 grid overflow-hidden opacity-0 animate-aura-fade-up"
        style={{ gridTemplateColumns: '260px 380px 1fr', animationDelay: '0.05s' }}
      >
        <Sidebar
          view={view}
          statusFilter={statusFilter}
          counts={counts}
          liveCampaigns={liveCampaigns}
          allCampaigns={campaigns}
          onViewClick={handleViewClick}
          onStatusClick={handleStatusClick}
          onClearStatus={() => setStatusFilter(null)}
          onNew={() => goTo('/app')}
        />

        <CampaignList
          filtered={filtered}
          selectedId={selectedId}
          search={search}
          statusFilter={statusFilter}
          view={view}
          savedMap={savedMap}
          onSelect={setSelectedId}
          onSearchChange={setSearch}
          onSearchClear={() => setSearch('')}
        />

        {/* Detail panel */}
        <div className="flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl liquid-glass flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white/25" />
              </div>
              <p className="text-xs text-white/35 leading-relaxed max-w-xs">
                Seleccioná una campaña para ver el detalle, métricas y variantes.
              </p>
            </div>
          ) : (
            <CampaignDetail
              campaign={selected}
              isSaved={!!savedMap[selected.id]}
              onToggleSaved={() => setSavedMap((prev) => ({ ...prev, [selected.id]: !prev[selected.id] }))}
              onNew={() => goTo('/app')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
