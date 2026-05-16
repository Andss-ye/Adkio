import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { isLoggedIn, getAccount } from '@/lib/auth';
import NoiseFilter from '@/components/ui/NoiseFilter';
import LogoMark from '@/components/ui/LogoMark';
import { Sparkles } from '@/components/ui/Icons';
import { type Campaign, type CampaignStatus } from '@/lib/dashboard-data';
import Sidebar from '@/components/dashboard/Sidebar';
import CampaignList from '@/components/dashboard/CampaignList';
import CampaignDetail from '@/components/dashboard/CampaignDetail';
import StatsBar from '@/components/dashboard/StatsBar';
import SettingsDrawer from '@/components/dashboard/SettingsDrawer';
import UserMenu from '@/components/dashboard/UserMenu';

type ViewKey = 'campañas' | 'guardadas' | 'activas' | 'borradores' | 'archivo';

const PLATFORM_LABEL: Record<string, string> = {
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  google_ads: 'Google Ads',
};

function formatRelativeTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days < 7) return `hace ${days} d`;
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function fmtCpl(min: number | null, max: number | null, fallback: number): string {
  if (min != null && max != null && min > 0 && max > 0) {
    return `$${Math.round(min)}–$${Math.round(max)} USD`;
  }
  if (fallback > 0) return `~$${Math.round(fallback)} USD`;
  return '—';
}

function mapBackendCampaign(b: Record<string, unknown>): Campaign {
  const status: Campaign['status'] =
    String(b.status ?? '').toUpperCase() === 'ACTIVE' ? 'Activa' : 'Pausada';
  const budget_usd = Number(b.budget_usd ?? 0);
  const duration_days = Number(b.duration_days ?? 14);
  const created_at = String(b.created_at ?? '');
  const relTime = formatRelativeTime(created_at);
  const paises = (b.paises as string[] | null) ?? [];
  const leads = Number(b.expected_leads ?? 0);
  const platformKey = String(b.platform ?? 'meta').toLowerCase();
  const platformLabel = PLATFORM_LABEL[platformKey] ?? 'Meta Ads';
  const cplMin = b.cpl_min_usd != null ? Number(b.cpl_min_usd) : null;
  const cplMax = b.cpl_max_usd != null ? Number(b.cpl_max_usd) : null;
  const cplMid = Number(b.cpl_usd ?? 0);
  const isMock = Boolean(b.is_mock);
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
    platform: platformLabel,
    liveSince: relTime,
    audience: { label: paises.join(', ') || 'LATAM', reach: String(b.estimated_reach ?? ''), cpm: '' },
    budget: { dia: budget_usd / duration_days, dias: duration_days, total: budget_usd },
    variants: [{ color: '#00d2ff', headline: String(b.copy_headline ?? ''), cta: String(b.copy_cta ?? 'Ver más') }],
    rationale: String(b.copy_body ?? '') + (isMock ? ' · ⚠️ Campaña simulada (sin credenciales conectadas)' : ''),
    metrics: leads > 0
      ? [
          { label: 'Leads estimados', value: `~${leads}`, good: true },
          { label: 'CPL estimado', value: fmtCpl(cplMin, cplMax, cplMid), good: !isMock },
          { label: 'Inversión', value: `$${budget_usd.toFixed(0)}`, good: true },
        ]
      : undefined,
  };
}

export default function DashboardPage() {
  const [view, setView] = useState<ViewKey>('campañas');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Settings drawer (panel slide-over)
  const [settingsOpen, setSettingsOpen] = useState<boolean>(
    () => new URLSearchParams(window.location.search).get('panel') === 'settings'
  );
  // Auth state — re-render cuando cambie login/logout
  const [logged, setLogged] = useState(isLoggedIn());
  const account = getAccount();
  // Plataformas conectadas — para el indicador del top bar
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  // Re-abrir drawer si veníamos del OAuth callback
  useEffect(() => {
    if (sessionStorage.getItem('adkio.open_settings_after_oauth') === '1') {
      sessionStorage.removeItem('adkio.open_settings_after_oauth');
      setSettingsOpen(true);
    }
  }, []);

  useEffect(() => {
    apiFetch('/campaigns')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = (data as Record<string, unknown>[]).map(mapBackendCampaign);
          setCampaigns(mapped);
          setSelectedId(mapped[0].id);
          setSavedMap(Object.fromEntries(mapped.map((c) => [c.id, false])));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    // Plataformas conectadas — solo si hay JWT
    if (logged) {
      apiFetch('/connect/status')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: unknown) => {
          if (data && typeof data === 'object' && 'connections' in data) {
            const conns = (data as { connections: Array<{ platform: string }> }).connections ?? [];
            setConnectedPlatforms(conns.map((c) => c.platform));
          }
        })
        .catch(() => {});
    }
  }, [logged]);

  const counts = useMemo(() => ({
    total: campaigns.filter((c) => !c.archived).length,
    saved: campaigns.filter((c) => !c.archived && savedMap[c.id]).length,
    active: campaigns.filter((c) => !c.archived && c.status === 'Activa').length,
    drafts: campaigns.filter((c) => !c.archived && c.status === 'Borrador').length,
    archived: campaigns.filter((c) => c.archived).length,
    review: campaigns.filter((c) => !c.archived && c.status === 'Revisión').length,
  }), [savedMap, campaigns]);

  const filtered = useMemo(() => {
    let list = [...campaigns];
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
  }, [view, statusFilter, search, savedMap, campaigns]);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((c) => c.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  const handleViewClick = (key: ViewKey) => {
    setView(key);
    setStatusFilter(null);
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
      <div className="relative z-30 h-9 flex-shrink-0 flex items-center px-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex gap-2">
          <button onClick={() => goTo('/')} className="w-3 h-3 rounded-full transition-opacity hover:opacity-75" style={{ background: '#ff5f57' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs text-white/50">
          <LogoMark className="w-3.5 h-3.5" />
          <span>Adkio — Workspace de campañas</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-white/40">
          {logged && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 hover:text-white/70 transition-colors"
              title="Gestionar conexiones"
            >
              {connectedPlatforms.length > 0 ? (
                <>
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full animate-ping" style={{ background: '#10b981', opacity: 0.6 }} />
                    <span className="relative rounded-full w-1.5 h-1.5" style={{ background: '#10b981' }} />
                  </span>
                  <span>
                    {connectedPlatforms.length === 1
                      ? `${PLATFORM_LABEL[connectedPlatforms[0]] ?? connectedPlatforms[0]} conectada`
                      : `${connectedPlatforms.length} plataformas conectadas`}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Sin plataformas · Conectar</span>
                </>
              )}
            </button>
          )}
          <UserMenu
            logged={logged}
            account={account}
            onLogout={() => setLogged(false)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
      </div>

      {/* Stats bar — flex-shrink-0 so it doesn't compress the grid */}
      <div className="relative z-10 flex-shrink-0">
        <StatsBar campaigns={campaigns} />
      </div>

      {/* Main 3-column layout */}
      <div
        className="relative z-10 flex-1 grid min-h-0 overflow-hidden opacity-0 animate-aura-fade-up"
        style={{ gridTemplateColumns: '260px 380px 1fr', animationDelay: '0.05s' }}
      >
        <Sidebar
          view={view}
          statusFilter={statusFilter}
          counts={counts}
          campaigns={campaigns}
          onViewClick={handleViewClick}
          onStatusClick={handleStatusClick}
          onClearStatus={() => setStatusFilter(null)}
          onNew={() => goTo('/app')}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <CampaignList
          filtered={filtered}
          selectedId={selectedId}
          search={search}
          statusFilter={statusFilter}
          view={view}
          savedMap={savedMap}
          isLoading={isLoading}
          onSelect={setSelectedId}
          onSearchChange={setSearch}
          onSearchClear={() => setSearch('')}
        />

        {/* Detail panel */}
        <div className="flex flex-col min-w-0 min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          ) : !selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl liquid-glass flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white/25" />
              </div>
              <p className="text-xs text-white/35 leading-relaxed max-w-xs">
                Todavía no hay campañas. Creá una desde el botón "Nueva campaña".
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

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
