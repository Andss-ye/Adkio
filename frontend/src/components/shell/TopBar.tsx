import { useState } from 'react';
import PlatformIcon from './PlatformIcon';
import {
  IcHome, IcSearch, IcBell, IcChevronDown, IcUser, IcSettings, IcLogout, IcMenu,
} from './icons';

export type Ticker = {
  platform: 'meta' | 'tiktok' | 'google_ads';
  spend: number | null; // null => off / not connected
  connected: boolean;
};

type Props = {
  breadcrumb: { label: string; href?: string }[];
  tickers?: Ticker[];
  /** when true, shows search input; pass an onSearch to enable */
  showSearch?: boolean;
  search?: string;
  onSearch?: (v: string) => void;
  userName: string;
  userEmail?: string;
  userInitials: string;
  onLogout: () => void;
  onOpenSettings: () => void;
  /** right side action zone (e.g. for the New Campaign page) */
  rightExtras?: React.ReactNode;
  /** show hamburger button (mobile) */
  showHamburger?: boolean;
  onHamburger?: () => void;
  /** how many tickers to show — 0 hides them. Pass based on viewport. */
  visibleTickers?: number;
  /** Render condensed for small viewports */
  compact?: boolean;
};

function fmtSpend(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 1 : 2).replace(/\.0$/, '')}k`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export default function TopBar({
  breadcrumb, tickers, showSearch, search, onSearch,
  userName, userEmail, userInitials, onLogout, onOpenSettings, rightExtras,
  showHamburger, onHamburger, visibleTickers, compact,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const tickerList = (tickers ?? []).slice(0, visibleTickers ?? tickers?.length ?? 0);

  return (
    <header
      style={{
        display: 'flex', alignItems: 'center', gap: compact ? 8 : 14,
        padding: compact ? '12px 14px' : '14px 22px',
        borderBottom: '1px solid var(--hairline-soft)',
        position: 'sticky', top: 0, zIndex: 5,
        background: 'rgba(20,21,23,.85)', backdropFilter: 'blur(10px)',
        flexWrap: 'nowrap', minWidth: 0,
      }}
    >
      {showHamburger && (
        <button
          onClick={onHamburger}
          aria-label="Open menu"
          style={{
            width: 34, height: 34, borderRadius: 10,
            background: '#1A1B1F', border: '1px solid var(--hairline-soft)',
            display: 'grid', placeItems: 'center', color: 'var(--text-2)',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <IcMenu width={16} height={16} />
        </button>
      )}

      {/* Breadcrumb — hides intermediate crumbs when compact */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          color: 'var(--text-2)', fontSize: 13,
          minWidth: 0, overflow: 'hidden',
        }}
      >
        <IcHome width={14} height={14} style={{ flexShrink: 0 }} />
        {(compact ? breadcrumb.slice(-1) : breadcrumb).map((c, i, arr) => (
          <span
            key={i}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              overflow: 'hidden', minWidth: 0,
            }}
          >
            {i === arr.length - 1 ? (
              <b
                style={{
                  color: 'var(--text)', fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {c.label}
              </b>
            ) : (
              <>
                {c.href ? (
                  <a
                    href={c.href}
                    style={{
                      color: 'inherit', textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.label}
                  </a>
                ) : (
                  <span style={{ whiteSpace: 'nowrap' }}>{c.label}</span>
                )}
                <span style={{ color: 'var(--text-3)' }}>/</span>
              </>
            )}
          </span>
        ))}
      </div>

      {/* Tickers — only show as many as fit */}
      {tickerList.length > 0 && (
        <div
          className="flex items-center"
          style={{ gap: 6, marginLeft: 18, flexShrink: 0, overflow: 'hidden' }}
        >
          {tickerList.map((t, i) => {
            const off = !t.connected;
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 11px 6px 9px', borderRadius: 999,
                  background: '#1A1B1F', border: '1px solid var(--hairline-soft)',
                  fontSize: 12, color: 'var(--text-2)',
                  whiteSpace: 'nowrap',
                }}
              >
                <PlatformIcon platform={t.platform} variant="ticker" />
                <span>
                  {t.platform === 'meta' ? 'Meta' : t.platform === 'tiktok' ? 'TikTok' : 'Google'}
                </span>
                <b
                  className="tab-num"
                  style={{ color: off ? 'var(--text-3)' : 'var(--text)', fontWeight: 500 }}
                >
                  {fmtSpend(t.spend)}
                </b>
                <span
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: off ? 'var(--text-3)' : 'var(--pos)',
                    boxShadow: off ? 'none' : '0 0 0 3px rgba(124,217,146,.12)',
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center',
          gap: compact ? 6 : 10, flexShrink: 0,
        }}
      >
        {rightExtras}

        {showSearch && !compact && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#1A1B1F', border: '1px solid var(--hairline-soft)',
              padding: '7px 11px', borderRadius: 10, width: 240,
              color: 'var(--text-2)', fontSize: 13,
            }}
          >
            <IcSearch width={14} height={14} />
            <input
              value={search ?? ''}
              onChange={(e) => onSearch?.(e.target.value)}
              placeholder="Search campaigns…"
              style={{
                background: 'transparent', border: 0, outline: 0,
                color: 'var(--text)', width: '100%', font: 'inherit', minWidth: 0,
              }}
            />
            <kbd
              className="font-mono"
              style={{
                fontSize: 10.5, color: 'var(--text-3)',
                background: '#0E0F11', border: '1px solid var(--hairline-soft)',
                padding: '1px 5px', borderRadius: 4,
              }}
            >
              ⌘K
            </kbd>
          </div>
        )}

        {showSearch && compact && (
          <>
            <button
              onClick={() => setSearchOpen((v) => !v)}
              style={iconBtnStyle()}
              aria-label="Search"
            >
              <IcSearch width={16} height={16} />
            </button>
            {searchOpen && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 14, right: 14,
                  background: '#1A1B1F', border: '1px solid var(--hairline-soft)',
                  padding: '7px 11px', borderRadius: 10,
                  display: 'flex', alignItems: 'center', gap: 8, zIndex: 6,
                }}
              >
                <IcSearch width={14} height={14} style={{ color: 'var(--text-2)' }} />
                <input
                  autoFocus
                  value={search ?? ''}
                  onChange={(e) => onSearch?.(e.target.value)}
                  placeholder="Search campaigns…"
                  style={{
                    background: 'transparent', border: 0, outline: 0,
                    color: 'var(--text)', width: '100%', font: 'inherit', minWidth: 0,
                  }}
                />
              </div>
            )}
          </>
        )}

        {!compact && (
          <button style={iconBtnStyle()} title="Notifications">
            <IcBell width={16} height={16} />
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: compact ? 4 : 9,
              background: '#1A1B1F', border: '1px solid var(--hairline-soft)',
              padding: compact ? 3 : '4px 10px 4px 4px',
              borderRadius: 999, cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'linear-gradient(135deg,var(--accent),#2f5e96)',
                color: '#0A0F1A', fontWeight: 600, fontSize: 11,
                display: 'grid', placeItems: 'center',
              }}
            >
              {userInitials}
            </span>
            {!compact && (
              <>
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                  <span
                    style={{
                      fontSize: 12.5, fontWeight: 500, color: 'var(--text)',
                      maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {userName}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {userEmail ? 'Admin' : 'Demo'}
                  </span>
                </span>
                <IcChevronDown width={12} height={12} style={{ color: 'var(--text-3)' }} />
              </>
            )}
          </button>

          {menuOpen && (
            <>
              <div
                onClick={() => setMenuOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 29 }}
              />
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  width: 240, background: '#1A1B1F',
                  border: '1px solid var(--hairline-soft)', borderRadius: 14,
                  padding: 8, zIndex: 30,
                  boxShadow: '0 24px 48px -16px rgba(0,0,0,.6)',
                }}
              >
                <div
                  style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    padding: 10, borderRadius: 8,
                  }}
                >
                  <span
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'linear-gradient(135deg,var(--accent),#2f5e96)',
                      color: '#0A0F1A', fontWeight: 600, fontSize: 12,
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    {userInitials}
                  </span>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <b style={{ display: 'block', fontWeight: 500, color: 'var(--text)' }}>{userName}</b>
                    <span
                      style={{
                        fontSize: 11.5, color: 'var(--text-3)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {userEmail ?? 'Sin sesión'}
                    </span>
                  </div>
                </div>
                <hr style={{ border: 0, borderTop: '1px solid var(--hairline-soft)', margin: '6px 4px' }} />
                <MenuItem icon={<IcUser width={14} height={14} />} label="Account" />
                <MenuItem
                  icon={<IcSettings width={14} height={14} />}
                  label="Settings"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings();
                  }}
                />
                <hr style={{ border: 0, borderTop: '1px solid var(--hairline-soft)', margin: '6px 4px' }} />
                <MenuItem
                  icon={<IcLogout width={14} height={14} />}
                  label="Log out"
                  color="var(--neg)"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function iconBtnStyle(): React.CSSProperties {
  return {
    width: 34, height: 34, borderRadius: 10,
    background: '#1A1B1F', border: '1px solid var(--hairline-soft)',
    display: 'grid', placeItems: 'center', color: 'var(--text-2)',
    cursor: 'pointer', flexShrink: 0,
  };
}

function MenuItem({
  icon, label, color = 'var(--text-2)', onClick,
}: { icon: React.ReactNode; label: string; color?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 10px', borderRadius: 8,
        fontSize: 13, color, cursor: 'pointer',
        background: 'transparent', border: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#23252A';
        if (color === 'var(--text-2)') e.currentTarget.style.color = 'var(--text)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        if (color === 'var(--text-2)') e.currentTarget.style.color = 'var(--text-2)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}
