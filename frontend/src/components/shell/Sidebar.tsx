import { useEffect } from 'react';
import {
  IcDashboard, IcList, IcActive, IcDraft, IcSaved,
  IcPlus, IcConnections, IcChevronLeft, IcClose,
} from './icons';
import LogoMark from '@/components/ui/LogoMark';

export type SidebarSection =
  | 'dashboard'
  | 'all'
  | 'active'
  | 'drafts'
  | 'saved'
  | 'new'
  | 'connections';

type Counts = {
  all?: number;
  active?: number;
  drafts?: number;
  saved?: number;
};

type Props = {
  active: SidebarSection;
  collapsed: boolean;
  /** When true the sidebar floats above content as an overlay with scrim (mobile). */
  overlay: boolean;
  /** Only meaningful in overlay mode — controls visibility. */
  overlayOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseOverlay?: () => void;
  onNavigate: (section: SidebarSection) => void;
  onOpenSettings: () => void;
  userName: string;
  userInitials: string;
  counts: Counts;
};

export default function Sidebar({
  active, collapsed, overlay, overlayOpen,
  onToggleCollapsed, onCloseOverlay, onNavigate, onOpenSettings,
  userName, userInitials, counts,
}: Props) {
  /* Close overlay on Esc */
  useEffect(() => {
    if (!overlay || !overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseOverlay?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, overlayOpen, onCloseOverlay]);

  const navItem = (
    section: SidebarSection,
    Icon: React.ComponentType<{ width?: number; height?: number; style?: React.CSSProperties }>,
    label: string,
    badge?: number | string,
    extra?: React.ReactNode,
  ) => {
    const isActive = active === section;
    return (
      <button
        key={section}
        onClick={() => onNavigate(section)}
        className="w-full text-left flex items-center gap-3 px-2.5 py-2 rounded-[10px] text-[13.5px] font-medium transition-colors"
        style={{
          color: isActive ? 'var(--text)' : 'var(--text-2)',
          background: isActive ? 'var(--bg-raised)' : 'transparent',
          boxShadow: isActive ? 'inset 0 0 0 1px #2E3035' : 'none',
          justifyContent: collapsed && !overlay ? 'center' : 'flex-start',
          paddingLeft: 10,
          paddingRight: 10,
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = '#15161A';
            (e.currentTarget as HTMLElement).style.color = 'var(--text)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-2)';
          }
        }}
        title={collapsed && !overlay ? label : undefined}
      >
        <Icon width={16} height={16} style={{ flex: 'none' }} />
        {(!collapsed || overlay) && (
          <>
            <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
            {badge !== undefined && badge !== null && (
              <span
                className="tab-num"
                style={{
                  fontSize: 11,
                  color: isActive ? 'var(--text)' : 'var(--text-3)',
                  background: isActive ? '#0E0F11' : '#15161A',
                  border: '1px solid var(--hairline-soft)',
                  padding: '1px 7px',
                  borderRadius: 999,
                }}
              >
                {badge}
              </span>
            )}
            {extra}
          </>
        )}
      </button>
    );
  };

  const grpLabel = (label: string) =>
    (!collapsed || overlay) && (
      <div
        style={{
          fontSize: 10.5,
          textTransform: 'uppercase',
          letterSpacing: '.12em',
          color: 'var(--text-3)',
          padding: '6px 10px 8px',
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    );

  // When overlay mode is closed, render nothing
  if (overlay && !overlayOpen) return null;

  const sidebar = (
    <aside
      className="dark-scroll"
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: overlay ? 'none' : '1px solid var(--hairline-soft)',
        padding: '18px 14px 14px',
        overflow: 'hidden auto',
        width: overlay ? 280 : collapsed ? 76 : 260,
        transition: overlay ? 'none' : 'width .25s ease',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        position: overlay ? 'fixed' : 'relative',
        top: overlay ? 0 : undefined,
        left: overlay ? 0 : undefined,
        height: overlay ? '100vh' : undefined,
        maxHeight: overlay ? '100vh' : undefined,
        zIndex: overlay ? 51 : 1,
        boxShadow: overlay ? '0 24px 64px -8px rgba(0,0,0,.7)' : 'none',
      }}
    >
      {/* Brand + collapse */}
      <div
        className="flex items-center gap-2.5"
        style={{
          padding: '4px 6px 14px',
          justifyContent: collapsed && !overlay ? 'center' : 'flex-start',
        }}
      >
        {/* Logo real de Adkio — visible también colapsado (solo la marca). */}
        <LogoMark className="w-7 h-7" />
        {(!collapsed || overlay) && (
          <div style={{ fontWeight: 600, letterSpacing: '-.01em', fontSize: 15, lineHeight: 1.15 }}>
            Adkio
            <div style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 500 }}>
              Agent · v2.4
            </div>
          </div>
        )}
        <button
          onClick={overlay ? onCloseOverlay : onToggleCollapsed}
          aria-label={overlay ? 'Close menu' : 'Toggle sidebar'}
          title={overlay ? 'Close' : collapsed ? 'Expand' : 'Collapse'}
          style={{
            marginLeft: collapsed && !overlay ? 0 : 'auto',
            width: 28, height: 28, borderRadius: 8,
            border: '1px solid var(--hairline-soft)', background: '#15161A',
            color: 'var(--text-2)', display: 'grid', placeItems: 'center',
            cursor: 'pointer',
            transform: !overlay && collapsed ? 'rotate(180deg)' : 'none',
            transition: 'transform .2s ease',
            flexShrink: 0,
          }}
        >
          {overlay ? <IcClose width={14} height={14} /> : <IcChevronLeft width={14} height={14} />}
        </button>
      </div>

      {/* Welcome */}
      {(!collapsed || overlay) && (
        <div
          style={{
            margin: '6px 6px 14px', color: 'var(--text-2)', fontSize: 12.5,
            padding: '10px 12px', borderRadius: 10,
            background: '#15161A', border: '1px solid var(--hairline-soft)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <div
            style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'linear-gradient(135deg,#3a3b40,#1a1b1f)',
              flex: 'none', display: 'grid', placeItems: 'center',
              fontSize: 11, color: 'var(--text)',
            }}
          >
            {userInitials}
          </div>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Welcome, <b style={{ color: 'var(--text)', fontWeight: 500 }}>{userName}</b>
          </div>
        </div>
      )}

      {/* Overview */}
      <div style={{ padding: '10px 0' }}>
        {grpLabel('Overview')}
        <nav className="flex flex-col" style={{ gap: 2 }}>
          {navItem('dashboard', IcDashboard, 'Dashboard')}
        </nav>
      </div>

      {/* Campaigns */}
      <div style={{ padding: '10px 0', borderTop: '1px solid var(--hairline-soft)' }}>
        {grpLabel('Campaigns')}
        <nav className="flex flex-col" style={{ gap: 2 }}>
          {navItem('all', IcList, 'All campaigns', counts.all ?? 0)}
          {navItem('active', IcActive, 'Active', counts.active ?? 0)}
          {navItem('drafts', IcDraft, 'Drafts', counts.drafts ?? 0)}
          {navItem('saved', IcSaved, 'Saved', counts.saved ?? 0)}
        </nav>
      </div>

      {/* Actions */}
      <div style={{ padding: '10px 0', borderTop: '1px solid var(--hairline-soft)' }}>
        {grpLabel('Actions')}
        <nav className="flex flex-col" style={{ gap: 2 }}>
          {navItem('new', IcPlus, 'New campaign')}
          {navItem('connections', IcConnections, 'Connections')}
        </nav>
      </div>

      {/* Footer card */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
        {(!collapsed || overlay) && (
          <div
            style={{
              background: 'linear-gradient(180deg,#1A1B1F,#15161A)',
              border: '1px solid var(--hairline-soft)',
              borderRadius: 14, padding: 14, position: 'relative', overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute', right: -14, top: -14, width: 64, height: 64, borderRadius: 14,
                background:
                  'radial-gradient(circle at 30% 30%,var(--accent) 0 30%,transparent 31%),' +
                  'radial-gradient(circle at 70% 70%,#16314f 0 22%,transparent 23%),' +
                  '#16171A',
                opacity: 0.55,
              }}
            />
            <h4 style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 600 }}>Conectá tus plataformas</h4>
            <p style={{ margin: '0 0 12px', color: 'var(--text-2)', fontSize: 12, lineHeight: 1.5 }}>
              Conectá Meta, TikTok o Google para lanzar campañas reales. Sin conectar, Adkio las
              simula en un sandbox (no gasta dinero).
            </p>
            <button
              onClick={onOpenSettings}
              style={{
                width: '100%', background: 'var(--text)', color: '#0E0F11',
                padding: '8px 12px', borderRadius: 8, fontWeight: 600, fontSize: 12.5,
                cursor: 'pointer', border: 0,
              }}
            >
              Conectar
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  if (overlay) {
    return (
      <>
        <div
          onClick={onCloseOverlay}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(8,9,11,.55)',
            backdropFilter: 'blur(2px)',
            zIndex: 50,
          }}
        />
        {sidebar}
      </>
    );
  }
  return sidebar;
}
