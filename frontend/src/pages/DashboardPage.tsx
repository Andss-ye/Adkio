import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { isLoggedIn, getAccount, logout as authLogout } from '@/lib/auth';
import { useViewport } from '@/hooks/useViewport';
import Sidebar, { type SidebarSection } from '@/components/shell/Sidebar';
import TopBar, { type Ticker } from '@/components/shell/TopBar';
import PlatformIcon, { platformLabel } from '@/components/shell/PlatformIcon';
import Sparkline from '@/components/shell/Sparkline';
import {
  IcKebab, IcUp, IcDown, IcChevronRight, IcPlus,
} from '@/components/shell/icons';
import SettingsDrawer from '@/components/dashboard/SettingsDrawer';

type Status = 'Active' | 'Paused' | 'Draft' | 'Review';
type Platform = 'meta' | 'tiktok' | 'google_ads';

type Campaign = {
  id: string;
  shortId: string;
  name: string;
  platform: Platform;
  status: Status;
  spend: number;
  leads: number;
  delta7d: number;
  cpl: number | null;
  spark: number[];
  isMock?: boolean;
  createdAt?: string;
};

function statusFromBackend(raw: string): Status {
  const s = raw.toUpperCase();
  if (s === 'ACTIVE') return 'Active';
  if (s === 'PAUSED') return 'Paused';
  if (s === 'DRAFT' || s === 'PENDING') return 'Draft';
  return 'Review';
}

function platformFromBackend(raw: string): Platform {
  const p = raw.toLowerCase();
  if (p === 'tiktok') return 'tiktok';
  if (p === 'google' || p === 'google_ads') return 'google_ads';
  return 'meta';
}

function syntheticSpark(seed: number, trend: 'up' | 'down'): number[] {
  const base = 14 + (seed % 7);
  const pts: number[] = [];
  for (let i = 0; i < 13; i++) {
    const drift = trend === 'up' ? i * 1.4 : -i * 0.9;
    const noise = ((seed * (i + 1)) % 6) - 3;
    pts.push(Math.max(2, base + drift + noise));
  }
  return pts;
}

function mapBackendCampaign(b: Record<string, unknown>, idx: number): Campaign {
  const id = String(b.id ?? `cmp_${idx}`);
  const shortId = `CMP-${String(id).slice(-6).toUpperCase().padStart(6, '0')}`;
  const platform = platformFromBackend(String(b.platform ?? 'meta'));
  const status = statusFromBackend(String(b.status ?? 'DRAFT'));
  const spend = Number(b.budget_usd ?? b.spend_usd ?? 0);
  const leads = Number(b.expected_leads ?? b.leads ?? 0);
  const cpl = b.cpl_usd != null ? Number(b.cpl_usd) : null;
  const seed = (id.charCodeAt(id.length - 1) || 0) + idx;
  const delta = (seed % 28) - 7;
  const trend: 'up' | 'down' = delta >= 0 ? 'up' : 'down';
  return {
    id,
    shortId,
    name: String(b.copy_headline ?? b.name ?? `Campaign ${idx + 1}`),
    platform,
    status,
    spend,
    leads,
    delta7d: delta,
    cpl,
    spark: syntheticSpark(seed, trend),
    isMock: Boolean(b.is_mock),
    createdAt: typeof b.created_at === 'string' ? b.created_at : undefined,
  };
}

const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: 'demo-1', shortId: 'CMP-018472',
    name: 'Spring Drop — Awareness',
    platform: 'meta', status: 'Active',
    spend: 5820, leads: 342, delta7d: 18.4, cpl: 17.02,
    spark: syntheticSpark(11, 'up'),
  },
  {
    id: 'demo-2', shortId: 'CMP-018331',
    name: 'Creator UGC — Conversions',
    platform: 'tiktok', status: 'Active',
    spend: 3140, leads: 198, delta7d: 6.2, cpl: 15.86,
    spark: syntheticSpark(7, 'up'),
  },
  {
    id: 'demo-3', shortId: 'CMP-018104',
    name: 'Search — Branded Keywords',
    platform: 'google_ads', status: 'Paused',
    spend: 1920, leads: 74, delta7d: -4.1, cpl: 25.95,
    spark: syntheticSpark(4, 'down'),
  },
];

type TabKey = 'all' | 'active' | 'paused' | 'drafts';

export default function DashboardPage() {
  const vp = useViewport();
  /** Sidebar mode auto-derived from viewport but user can override locally. */
  const [collapseOverride, setCollapseOverride] = useState<boolean | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const isOverlay = vp.isSm;
  const collapsed = collapseOverride ?? (vp.isMd || vp.isLg);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  const [settingsOpen, setSettingsOpen] = useState(
    () => new URLSearchParams(window.location.search).get('panel') === 'settings',
  );
  const [logged, setLogged] = useState(isLoggedIn());
  const account = getAccount();
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (sessionStorage.getItem('adkio.open_settings_after_oauth') === '1') {
      sessionStorage.removeItem('adkio.open_settings_after_oauth');
      setSettingsOpen(true);
    }
  }, []);

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
  }, []);

  /* Fetch campaigns — account-scoped via Bearer when logged in,
     falls back to brand_id when not. */
  useEffect(() => {
    setIsLoading(true);
    apiFetch('/campaigns')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = (data as Record<string, unknown>[]).map(mapBackendCampaign);
          setCampaigns(mapped);
          setUsingDemo(false);
        } else {
          // Logged-in users with no campaigns yet see a clean empty state, not demo data.
          // Non-logged users keep demo cards as a teaser.
          if (logged) {
            setCampaigns([]);
            setUsingDemo(false);
          } else {
            setCampaigns(DEMO_CAMPAIGNS);
            setUsingDemo(true);
          }
        }
      })
      .catch(() => {
        setCampaigns(logged ? [] : DEMO_CAMPAIGNS);
        setUsingDemo(!logged);
      })
      .finally(() => setIsLoading(false));

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
    } else {
      setConnectedPlatforms([]);
    }
  }, [logged]);

  const counts = useMemo(
    () => ({
      all: campaigns.length,
      active: campaigns.filter((c) => c.status === 'Active').length,
      paused: campaigns.filter((c) => c.status === 'Paused').length,
      drafts: campaigns.filter((c) => c.status === 'Draft').length,
      saved: 0,
    }),
    [campaigns],
  );

  const featured = useMemo(() => campaigns.slice(0, 3), [campaigns]);

  const filtered = useMemo(() => {
    let list = [...campaigns];
    if (tab === 'active') list = list.filter((c) => c.status === 'Active');
    else if (tab === 'paused') list = list.filter((c) => c.status === 'Paused');
    else if (tab === 'drafts') list = list.filter((c) => c.status === 'Draft');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.shortId.toLowerCase().includes(q));
    }
    return list;
  }, [campaigns, tab, search]);

  const tickers: Ticker[] = useMemo(() => {
    const sum = (p: Platform) =>
      campaigns.filter((c) => c.platform === p).reduce((acc, c) => acc + c.spend, 0);
    const connected = (p: string) =>
      connectedPlatforms.length === 0 ? !logged : connectedPlatforms.includes(p);
    return [
      { platform: 'meta', spend: sum('meta') || (logged ? null : 12480), connected: connected('meta') },
      { platform: 'tiktok', spend: sum('tiktok') || (logged ? null : 6210), connected: connected('tiktok') },
      { platform: 'google_ads', spend: sum('google_ads') || null, connected: connectedPlatforms.includes('google_ads') },
    ];
  }, [campaigns, connectedPlatforms, logged]);

  const goTo = (path: string) => {
    window.location.href = path;
  };

  const handleNavigate = (s: SidebarSection) => {
    if (isOverlay) setOverlayOpen(false);
    if (s === 'new') goTo('/app');
    else if (s === 'connections') setSettingsOpen(true);
    else if (s === 'active') setTab('active');
    else if (s === 'drafts') setTab('drafts');
    else if (s === 'all' || s === 'dashboard' || s === 'saved') setTab('all');
  };

  const handleLogout = () => {
    authLogout();
    setLogged(false);
    goTo('/');
  };

  const userName = account?.email?.split('@')[0] ?? 'Demo';
  const userInitials = (userName[0] ?? 'A').toUpperCase() + (userName[1] ?? 'D').toUpperCase();

  const lastUpdated = now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  /* Featured cards columns + table tickers count, derived from viewport */
  const featCols = vp.isXl ? 3 : vp.isLg ? 3 : vp.isMd ? 2 : 1;
  const visibleTickers = vp.isXl ? 3 : vp.isLg ? 2 : vp.isMd ? 0 : 0;
  const compactBar = vp.isSm;

  return (
    <div className="adkio-surface" style={{ height: '100vh', display: 'flex', minWidth: 0 }}>
      <Sidebar
        active={tab === 'active' ? 'active' : tab === 'drafts' ? 'drafts' : 'dashboard'}
        collapsed={collapsed}
        overlay={isOverlay}
        overlayOpen={overlayOpen}
        onToggleCollapsed={() => setCollapseOverride((v) => !(v ?? collapsed))}
        onCloseOverlay={() => setOverlayOpen(false)}
        onNavigate={handleNavigate}
        onOpenSettings={() => {
          setSettingsOpen(true);
          if (isOverlay) setOverlayOpen(false);
        }}
        userName={userName}
        userInitials={userInitials}
        counts={counts}
      />

      <main
        style={{
          background: 'var(--bg-main)',
          overflow: 'auto',
          borderTopLeftRadius: vp.isSm ? 0 : 18,
          borderTop: vp.isSm ? '0' : '1px solid var(--hairline-soft)',
          borderLeft: vp.isSm ? '0' : '1px solid var(--hairline-soft)',
          marginTop: vp.isSm ? 0 : 8,
          marginRight: vp.isSm ? 0 : 8,
          flex: 1, minWidth: 0,
          position: 'relative',
        }}
        className="dark-scroll"
      >
        <TopBar
          breadcrumb={[{ label: 'Workspace' }, { label: 'Dashboard' }]}
          tickers={tickers}
          visibleTickers={visibleTickers}
          showSearch
          search={search}
          onSearch={setSearch}
          userName={userName}
          userEmail={account?.email}
          userInitials={userInitials}
          onLogout={handleLogout}
          onOpenSettings={() => setSettingsOpen(true)}
          showHamburger={isOverlay}
          onHamburger={() => setOverlayOpen(true)}
          compact={compactBar}
        />

        {usingDemo && !logged && (
          <div
            style={{
              padding: '10px 22px', borderBottom: '1px solid var(--hairline-soft)',
              background: 'rgba(91,157,255,.04)', color: 'var(--text-2)',
              fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
            Vista demo · Iniciá sesión para ver y crear tus propias campañas.
          </div>
        )}

        <section
          style={{
            padding: vp.isSm ? '20px 16px 28px' : '28px 28px 36px',
            display: 'flex', flexDirection: 'column', gap: vp.isSm ? 22 : 28,
            maxWidth: 1440, width: '100%',
            margin: '0 auto', boxSizing: 'border-box',
          }}
        >
          {/* Hero */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: vp.isSm ? 12 : 18 }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                padding: '5px 10px 5px 8px', borderRadius: 999,
                background: '#1A1B1F', border: '1px solid var(--hairline-soft)',
                color: 'var(--text-2)', fontSize: 12,
              }}
              className="tab-num"
            >
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--accent)',
                  boxShadow: '0 0 0 4px rgba(91,157,255,.16)',
                  animation: 'adkio-live-pulse 1.6s infinite',
                }}
              />
              Last updated <span style={{ color: 'var(--text)', marginLeft: 4 }}>{lastUpdated}</span>
            </div>

            <h1
              style={{
                margin: 0, letterSpacing: '-.022em', fontWeight: 600, lineHeight: 1.05,
                display: 'flex', alignItems: 'center', gap: vp.isSm ? 12 : 18,
                fontSize: 'clamp(26px, 4.5vw, 48px)',
                flexWrap: 'wrap',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: vp.isSm ? 40 : 52, height: vp.isSm ? 40 : 52,
                  borderRadius: 12, flex: 'none',
                  background: 'linear-gradient(135deg,#1d2c40,#15161A)',
                  border: '1px solid var(--hairline)',
                  display: 'grid', placeItems: 'center',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04)',
                }}
              >
                <svg width={vp.isSm ? 20 : 26} height={vp.isSm ? 20 : 26}
                  viewBox="0 0 24 24" fill="none"
                  stroke="var(--accent)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9">
                  <path d="M4 18V8M10 18V5M16 18v-7M22 18V10" />
                </svg>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {counts.active > 0
                  ? `Today's campaigns, running across ${tickers.filter((t) => t.connected).length || 1} channel${(tickers.filter((t) => t.connected).length || 1) === 1 ? '' : 's'}.`
                  : counts.all > 0
                  ? `${counts.all} campaign${counts.all === 1 ? '' : 's'} saved — none live yet.`
                  : logged
                  ? 'Welcome to Adkio. Launch your first campaign.'
                  : "Your campaigns, ready to launch."}
              </span>
            </h1>
            <p style={{ margin: 0, color: 'var(--text-2)', fontSize: vp.isSm ? 13.5 : 14.5, maxWidth: 640 }}>
              Adkio is monitoring spend and pacing in real-time. The featured campaigns below
              need your attention this hour.
            </p>
          </div>

          {/* Featured cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${featCols},1fr)`, gap: 14 }}>
            {isLoading
              ? Array.from({ length: featCols }).map((_, i) => <FeatureSkeleton key={i} />)
              : featured.length === 0
              ? (logged
                  ? <EmptyFeatures onNew={() => goTo('/app')} />
                  : DEMO_CAMPAIGNS.slice(0, featCols).map((c) => <FeatureCard key={c.id} c={c} />))
              : featured.map((c) => <FeatureCard key={c.id} c={c} />)}
          </div>

          {/* Section head + tabs — hidden when there are zero campaigns
              (the empty hero above already covers that case). */}
          {(isLoading || campaigns.length > 0) && (
          <div>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <h2 style={{ margin: 0, fontSize: vp.isSm ? 18 : 22, fontWeight: 600, letterSpacing: '-.018em' }}>
                All campaigns
              </h2>
              <span style={{ color: 'var(--text-3)', fontSize: 13 }}>
                {filtered.length} of {counts.all} shown
              </span>
              <div
                style={{
                  marginLeft: vp.isSm ? 0 : 'auto',
                  display: 'inline-flex', gap: 2,
                  background: '#1A1B1F', border: '1px solid var(--hairline-soft)',
                  padding: 3, borderRadius: 10,
                  overflow: 'hidden',
                  flexWrap: 'wrap',
                }}
              >
                <TabBtn label="All" count={counts.all} on={tab === 'all'} onClick={() => setTab('all')} />
                <TabBtn label="Active" count={counts.active} on={tab === 'active'} onClick={() => setTab('active')} />
                <TabBtn label="Paused" count={counts.paused} on={tab === 'paused'} onClick={() => setTab('paused')} />
                <TabBtn label="Drafts" count={counts.drafts} on={tab === 'drafts'} onClick={() => setTab('drafts')} />
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState onNew={() => goTo('/app')} />
            ) : vp.isSm ? (
              <CampaignsListMobile rows={filtered} onRowClick={() => goTo('/app')} />
            ) : (
              <CampaignsTable rows={filtered} onRowClick={() => goTo('/app')} compact={vp.isMd} />
            )}
          </div>
          )}
        </section>
      </main>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/* ───────────────────────── inner components ───────────────────────── */

function TabBtn({ label, count, on, onClick }: { label: string; count: number; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 7, fontSize: 12.5,
        color: on ? 'var(--text)' : 'var(--text-2)', fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: on ? 'var(--bg-raised)' : 'transparent',
        boxShadow: on ? 'inset 0 0 0 1px #2E3035' : 'none',
        border: 0, cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label}{' '}
      <span style={{ color: on ? 'var(--text-2)' : 'var(--text-3)', fontSize: 11 }} className="tab-num">
        {count}
      </span>
    </button>
  );
}

function StatusTag({ status }: { status: Status }) {
  const map: Record<Status, { color: string; bg: string; dot: string }> = {
    Active: { color: 'var(--pos)', bg: 'rgba(124,217,146,.08)', dot: 'var(--pos)' },
    Paused: { color: 'var(--google-tone)', bg: 'rgba(232,178,96,.08)', dot: 'var(--google-tone)' },
    Draft: { color: 'var(--text-2)', bg: '#23252A', dot: 'var(--text-3)' },
    Review: { color: 'var(--accent-soft)', bg: 'rgba(91,157,255,.08)', dot: 'var(--accent)' },
  };
  const t = map[status];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 10.5, fontWeight: 500,
        padding: '2px 7px 2px 6px', borderRadius: 5,
        color: t.color, background: t.bg, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: t.dot }} />
      {status}
    </span>
  );
}

function PlatformTag({ platform }: { platform: Platform }) {
  const colorMap: Record<Platform, string> = {
    meta: 'var(--meta-tone)',
    tiktok: 'var(--tiktok-tone)',
    google_ads: 'var(--google-tone)',
  };
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 10.5, fontWeight: 500,
        padding: '2px 7px 2px 6px', borderRadius: 5,
        background: '#23252A', color: 'var(--text-2)', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: colorMap[platform] }} />
      {platformLabel(platform)}
    </span>
  );
}

function FeatureCard({ c }: { c: Campaign }) {
  const isUp = c.delta7d >= 0;
  return (
    <article
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
        padding: '18px 18px 16px',
        display: 'flex', flexDirection: 'column', gap: 14,
        position: 'relative', transition: 'border-color .15s',
        minWidth: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#34363C')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--hairline)')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <PlatformIcon platform={c.platform} variant="card" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <PlatformTag platform={c.platform} />
            <StatusTag status={c.status} />
          </div>
          <h3
            style={{
              margin: 0, fontSize: 15.5, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.25,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}
          >
            {c.name}
          </h3>
        </div>
        <button
          aria-label="More"
          style={{
            width: 28, height: 28, borderRadius: 8, color: 'var(--text-3)',
            display: 'grid', placeItems: 'center', flex: 'none',
            background: 'transparent', border: 0, cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#23252A';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-3)';
          }}
        >
          <IcKebab width={16} height={16} />
        </button>
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6, letterSpacing: '.02em' }}>
            Invested
          </span>
          <div
            className="tab-num"
            style={{
              fontSize: 'clamp(22px, 2.4vw, 30px)',
              letterSpacing: '-.02em', fontWeight: 600, lineHeight: 1,
            }}
          >
            ${c.spend.toLocaleString('en-US')}
          </div>
        </div>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 500, padding: '3px 7px', borderRadius: 6,
            color: isUp ? 'var(--pos)' : 'var(--neg)',
            background: isUp ? 'rgba(124,217,146,.1)' : 'rgba(233,122,122,.1)',
          }}
          className="tab-num"
        >
          {isUp ? <IcUp width={11} height={11} /> : <IcDown width={11} height={11} />}
          {isUp ? '+' : ''}{c.delta7d.toFixed(1)}%
        </span>
      </div>

      <Sparkline data={c.spark} trend={isUp ? 'up' : 'down'} />

      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 12, borderTop: '1px dashed var(--hairline)',
          color: 'var(--text-3)', fontSize: 11.5, gap: 8, flexWrap: 'wrap',
        }}
      >
        <span>Leads <b style={{ color: 'var(--text-2)', fontWeight: 500 }} className="tab-num">{c.leads}</b></span>
        <span>CPL <b style={{ color: 'var(--text-2)', fontWeight: 500 }} className="tab-num">
          {c.cpl != null ? `$${c.cpl.toFixed(2)}` : '—'}
        </b></span>
        <span>7d</span>
      </div>
    </article>
  );
}

function FeatureSkeleton() {
  return (
    <article
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
        padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="adkio-skel" style={{ width: 38, height: 38 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="adkio-skel" style={{ width: '60%', height: 12 }} />
          <div className="adkio-skel" style={{ width: '80%', height: 14 }} />
        </div>
      </div>
      <div className="adkio-skel" style={{ width: '40%', height: 24 }} />
      <div className="adkio-skel" style={{ width: '100%', height: 48 }} />
    </article>
  );
}

function EmptyFeatures({ onNew }: { onNew: () => void }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        background: 'var(--bg-card)', border: '1px dashed var(--hairline)',
        borderRadius: 'var(--radius)',
        padding: '40px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12, textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'linear-gradient(135deg,#1d2c40,#15161A)',
          border: '1px solid var(--hairline)',
          display: 'grid', placeItems: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>No campaigns yet</h3>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', maxWidth: 380 }}>
        Launch your first campaign with Adkio. Tell us what you want and it sets up the rest.
      </p>
      <button
        onClick={onNew}
        style={{
          background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600,
          padding: '8px 14px', borderRadius: 9, fontSize: 12.5,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          border: 0, cursor: 'pointer',
        }}
      >
        <IcPlus width={12} height={12} /> New campaign
      </button>
    </div>
  );
}

function CampaignsTable({
  rows, onRowClick, compact,
}: { rows: Campaign[]; onRowClick: (c: Campaign) => void; compact: boolean }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)', overflow: 'auto',
      }}
      className="dark-scroll"
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: compact ? 720 : undefined }}>
        <thead>
          <tr>
            {[' #', 'Campaign', 'Platform', 'Investment', 'Leads', '7D %', 'Status', ''].map((h, i) => {
              const right = i === 3 || i === 4 || i === 5;
              return (
                <th
                  key={i}
                  style={{
                    textAlign: i === 0 ? 'right' : right ? 'right' : 'left',
                    fontWeight: 500, fontSize: 11.5, color: 'var(--text-3)',
                    letterSpacing: '.06em', textTransform: 'uppercase',
                    padding: '12px 18px', background: '#1A1B1F',
                    borderBottom: '1px solid var(--hairline)',
                    width: i === 0 ? 46 : undefined,
                  }}
                >
                  {h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const up = c.delta7d >= 0;
            return (
              <tr
                key={c.id}
                onClick={() => onRowClick(c)}
                style={{ cursor: 'pointer', transition: 'background .12s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1F2024')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td
                  className="tab-num"
                  style={{
                    padding: '14px 12px 14px 18px', borderBottom: '1px solid var(--hairline-soft)',
                    fontSize: 12, color: 'var(--text-3)', textAlign: 'right',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </td>
                <td style={cellStyle()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <PlatformIcon platform={c.platform} variant="row" />
                    <div style={{ minWidth: 0 }}>
                      <b
                        style={{
                          display: 'block', fontWeight: 500, letterSpacing: '-.005em',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 280,
                        }}
                      >
                        {c.name}
                      </b>
                      <small
                        className="font-mono"
                        style={{ color: 'var(--text-3)', fontSize: 11.5 }}
                      >
                        {c.shortId}
                      </small>
                    </div>
                  </div>
                </td>
                <td style={cellStyle()}>
                  <PlatformTag platform={c.platform} />
                </td>
                <td style={cellStyle(true)} className="tab-num">
                  ${c.spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={cellStyle(true)} className="tab-num">
                  {c.leads}
                </td>
                <td
                  style={{ ...cellStyle(true), color: up ? 'var(--pos)' : 'var(--neg)' }}
                  className="tab-num"
                >
                  {up ? '+' : ''}{c.delta7d.toFixed(1)}%
                </td>
                <td style={cellStyle()}>
                  <StatusTag status={c.status} />
                </td>
                <td style={cellStyle()}>
                  <div
                    style={{
                      width: 24, height: 24, borderRadius: 6, color: 'var(--text-3)',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    <IcChevronRight width={14} height={14} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CampaignsListMobile({ rows, onRowClick }: { rows: Campaign[]; onRowClick: (c: Campaign) => void }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {rows.map((c, i) => {
        const up = c.delta7d >= 0;
        return (
          <button
            key={c.id}
            onClick={() => onRowClick(c)}
            style={{
              padding: 14, borderBottom: i === rows.length - 1 ? 0 : '1px solid var(--hairline-soft)',
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
              background: 'transparent', border: 0, cursor: 'pointer',
              borderTop: 0, borderLeft: 0, borderRight: 0, borderRadius: 0,
              borderBottomColor: i === rows.length - 1 ? 'transparent' : 'var(--hairline-soft)',
              borderBottomStyle: 'solid', borderBottomWidth: i === rows.length - 1 ? 0 : 1,
              color: 'var(--text)', width: '100%',
            }}
          >
            <PlatformIcon platform={c.platform} variant="row" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b
                style={{
                  display: 'block', fontWeight: 500, fontSize: 13.5,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {c.name}
              </b>
              <div
                style={{
                  display: 'flex', gap: 8, alignItems: 'center', marginTop: 4,
                  fontSize: 11.5, color: 'var(--text-3)',
                }}
              >
                <span className="font-mono">{c.shortId}</span>
                <span>·</span>
                <span className="tab-num" style={{ color: up ? 'var(--pos)' : 'var(--neg)' }}>
                  {up ? '+' : ''}{c.delta7d.toFixed(1)}%
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="tab-num" style={{ fontSize: 14, fontWeight: 600 }}>
                ${c.spend.toLocaleString('en-US')}
              </div>
              <StatusTag status={c.status} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function cellStyle(right = false): React.CSSProperties {
  return {
    padding: '14px 18px',
    borderBottom: '1px solid var(--hairline-soft)',
    fontSize: 13.5, color: 'var(--text)', verticalAlign: 'middle',
    textAlign: right ? 'right' : 'left',
  };
}

function TableSkeleton() {
  return (
    <div
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)', overflow: 'hidden',
      }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            padding: '14px 18px', borderBottom: '1px solid var(--hairline-soft)',
            gap: 12, alignItems: 'center',
          }}
        >
          <div className="adkio-skel" style={{ width: 16, height: 10, flexShrink: 0 }} />
          <div className="adkio-skel" style={{ flex: 1, height: 14 }} />
          <div className="adkio-skel" style={{ width: 60, height: 14, flexShrink: 0 }} />
          <div className="adkio-skel" style={{ width: 80, height: 14, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
        padding: '56px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 14, textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 72, height: 72, borderRadius: 18,
          background: 'linear-gradient(135deg,#23252A,#1A1B1F)',
          border: '1px solid var(--hairline)',
          display: 'grid', placeItems: 'center', color: 'var(--text-3)',
          marginBottom: 6,
        }}
      >
        <span
          style={{ width: 30, height: 22, border: '2px dashed var(--text-3)', borderRadius: 4 }}
        />
      </div>
      <h3 style={{ margin: 0, fontSize: 20, letterSpacing: '-.015em', fontWeight: 600 }}>
        No campaigns match
      </h3>
      <p style={{ margin: 0, color: 'var(--text-2)', maxWidth: 380, fontSize: 13.5 }}>
        Try a different filter or kick off a new campaign with Adkio.
      </p>
      <button
        onClick={onNew}
        style={{
          background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600,
          padding: '10px 16px', borderRadius: 10, fontSize: 13,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 24px -10px rgba(91,157,255,.5)',
          border: 0, cursor: 'pointer',
        }}
      >
        <IcPlus width={14} height={14} />
        Create first campaign
      </button>
    </div>
  );
}
