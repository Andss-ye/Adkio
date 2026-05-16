import { Check } from '@/components/ui/Icons';

export type Platform = 'meta' | 'tiktok' | 'google_ads';

export type Connection = {
  id: string;
  platform: Platform;
  provider_account_id: string;
  connected_at: string;
  last_validated_at: string | null;
  scopes: string[];
};

type PlatformDef = {
  label: string;
  tagline: string;
  brandColor: string;
  /** id field label shown when connected (e.g. "Ad Account") */
  idLabel: string;
  /** SVG path for the platform glyph */
  Icon: () => JSX.Element;
};

function MetaIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.6 6.7a4.8 4.8 0 0 1-3.7-2.4c-.3-.6-.5-1.3-.5-2H11v13.4a2.7 2.7 0 1 1-2.7-2.7c.3 0 .6 0 .8.1V8.5a6.5 6.5 0 0 0-.8 0 6.7 6.7 0 1 0 6.7 6.7V8.8a8.7 8.7 0 0 0 4.7 1.4V6.7Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.24 1.05-3.72 1.05-2.86 0-5.28-1.93-6.15-4.52H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC04" d="M5.85 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.67-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.46 2.1 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.67 2.84C6.72 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export const PLATFORM_META: Record<Platform, PlatformDef> = {
  meta: {
    label: 'Meta Ads',
    tagline: 'Instagram + Facebook',
    brandColor: '#1877F2',
    idLabel: 'Ad Account',
    Icon: MetaIcon,
  },
  tiktok: {
    label: 'TikTok Ads',
    tagline: 'TikTok for Business',
    brandColor: '#000000',
    idLabel: 'Advertiser ID',
    Icon: TikTokIcon,
  },
  google_ads: {
    label: 'Google Ads',
    tagline: 'Search + Display + YouTube',
    brandColor: '#4285F4',
    idLabel: 'Customer ID',
    Icon: GoogleIcon,
  },
};

type Props = {
  platform: Platform;
  connection: Connection | undefined;
  loading: boolean;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
};

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'hace un instante';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `hace ${days} d`;
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ConnectionCard({ platform, connection, loading, busy, onConnect, onDisconnect }: Props) {
  const meta = PLATFORM_META[platform];
  const isConnected = Boolean(connection);
  const Icon = meta.Icon;

  return (
    <div
      className={`relative rounded-2xl border transition-all overflow-hidden ${
        isConnected
          ? 'border-emerald-500/20 bg-emerald-500/[0.025]'
          : 'border-white/[0.07] bg-white/[0.015] hover:border-white/15 hover:bg-white/[0.025]'
      }`}
    >
      {/* Subtle accent stripe when connected */}
      {isConnected && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${meta.brandColor}66, transparent)`,
          }}
        />
      )}

      <div className="flex items-center gap-4 p-5">
        {/* Brand mark */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-lg"
          style={{
            background: meta.brandColor,
            boxShadow: isConnected ? `0 8px 24px -8px ${meta.brandColor}80` : 'none',
          }}
        >
          <Icon />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold tracking-tight">{meta.label}</span>
            {isConnected && (
              <span
                className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(16,185,129,0.10)',
                  color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.30)',
                }}
              >
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                Conectada
              </span>
            )}
          </div>

          {isConnected && connection ? (
            <div className="mt-1 flex items-center gap-2 text-[11px] text-white/55 flex-wrap">
              <span className="text-white/40">{meta.idLabel}:</span>
              <code className="px-1.5 py-0.5 rounded bg-white/5 text-white/75 font-mono">
                {connection.provider_account_id}
              </code>
              <span className="text-white/25">·</span>
              <span title={connection.connected_at}>desde {formatRelativeDate(connection.connected_at)}</span>
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-white/45">{meta.tagline}</div>
          )}
        </div>

        {/* Action */}
        <div className="flex-shrink-0">
          {loading ? (
            <div className="w-24 h-9 rounded-lg bg-white/[0.03] animate-pulse" />
          ) : isConnected ? (
            <button
              onClick={onDisconnect}
              disabled={busy}
              className="text-xs px-3.5 py-2 rounded-lg border border-white/[0.10] text-white/70 hover:text-white hover:border-white/25 hover:bg-white/[0.03] transition-all disabled:opacity-40"
            >
              {busy ? 'Espera…' : 'Desconectar'}
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={busy}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-white text-black hover:bg-white/90 transition-all disabled:opacity-40 inline-flex items-center gap-1.5 group"
            >
              {busy ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  Abriendo…
                </>
              ) : (
                <>
                  Conectar
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Connected details (scopes) */}
      {isConnected && connection && connection.scopes.length > 0 && (
        <div className="px-5 pb-4 -mt-1 border-t border-white/[0.05] pt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[9px] uppercase tracking-widest text-white/35">Permisos</span>
          {connection.scopes.slice(0, 4).map((s) => (
            <span
              key={s}
              className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/55 font-mono"
            >
              {s.replace('https://www.googleapis.com/auth/', '').slice(0, 28)}
            </span>
          ))}
          {connection.scopes.length > 4 && (
            <span className="text-[10px] text-white/35">+{connection.scopes.length - 4} más</span>
          )}
        </div>
      )}
    </div>
  );
}
