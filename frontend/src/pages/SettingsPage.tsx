import { useEffect, useState } from 'react';
import { apiFetch, BACKEND } from '@/lib/api';
import { getAccount, isLoggedIn, logout, signup, login } from '@/lib/auth';
import NoiseFilter from '@/components/ui/NoiseFilter';
import LogoMark from '@/components/ui/LogoMark';

type Platform = 'meta' | 'tiktok' | 'google_ads';

type Connection = {
  id: string;
  platform: Platform;
  provider_account_id: string;
  connected_at: string;
  last_validated_at: string | null;
  scopes: string[];
};

const PLATFORM_META: Record<Platform, { label: string; color: string; icon: string }> = {
  meta: { label: 'Meta Ads', color: '#1877F2', icon: 'M' },
  tiktok: { label: 'TikTok Ads', color: '#000', icon: 'T' },
  google_ads: { label: 'Google Ads', color: '#4285F4', icon: 'G' },
};

function PlatformIcon({ platform }: { platform: Platform }) {
  const m = PLATFORM_META[platform];
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
      style={{ background: m.color }}
    >
      {m.icon}
    </div>
  );
}

export default function SettingsPage() {
  const [logged, setLogged] = useState(isLoggedIn());
  const account = getAccount();

  if (!logged) return <AuthBox onSuccess={() => setLogged(true)} />;

  return <ConnectionsView account={account} onLogout={() => { logout(); setLogged(false); }} />;
}

function AuthBox({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await signup(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center text-white" style={{ background: '#0a0d12' }}>
      <NoiseFilter />
      <form onSubmit={handle} className="relative z-10 w-full max-w-sm liquid-glass rounded-2xl p-8" style={{ background: 'rgba(19,24,32,0.95)' }}>
        <div className="flex items-center gap-2 mb-6">
          <LogoMark className="w-7 h-7" />
          <span className="text-base font-semibold">Adkio</span>
        </div>
        <h1 className="text-xl font-semibold mb-1">
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>
        <p className="text-sm text-white/50 mb-6">
          {mode === 'login'
            ? 'Conectá tus cuentas de ads y lanzá campañas desde lenguaje natural.'
            : 'Necesitás una cuenta Adkio para conectar Meta, TikTok o Google Ads.'}
        </p>

        <label className="block text-xs text-white/60 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm mb-3 focus:outline-none focus:border-[#00d2ff]"
          placeholder="vos@ejemplo.com"
        />

        <label className="block text-xs text-white/60 mb-1">Contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm mb-4 focus:outline-none focus:border-[#00d2ff]"
          placeholder="min. 8 caracteres, letra + número"
        />

        {error && (
          <div className="mb-3 text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-black bg-white hover:bg-white/90 disabled:opacity-40 transition-opacity"
        >
          {loading ? '...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
          className="w-full mt-3 text-xs text-white/50 hover:text-white"
        >
          {mode === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </form>
    </div>
  );
}

function ConnectionsView({ account, onLogout }: { account: ReturnType<typeof getAccount>; onLogout: () => void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ text: string; ok: boolean } | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const r = await apiFetch('/connect/status');
      if (r.ok) {
        const data = await r.json();
        setConnections(data.connections ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // Detect callback return: ?connect=meta&status=ok&msg=...
    const qs = new URLSearchParams(window.location.search);
    const platform = qs.get('connect');
    const status = qs.get('status');
    if (platform && status) {
      setBanner({
        text: status === 'ok'
          ? `✓ ${PLATFORM_META[platform as Platform]?.label ?? platform} conectado correctamente`
          : `✗ Falló la conexión: ${qs.get('msg') ?? 'error desconocido'}`,
        ok: status === 'ok',
      });
      // Limpiar query string
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  async function connect(platform: Platform) {
    try {
      const r = await apiFetch(`/connect/${platform}`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setBanner({ text: err.detail ?? `Error HTTP ${r.status}`, ok: false });
        return;
      }
      const body = (await r.json()) as { authorize_url?: string };
      if (body.authorize_url) {
        window.location.href = body.authorize_url;
      }
    } catch (err) {
      setBanner({
        text: err instanceof Error ? err.message : 'Error iniciando OAuth',
        ok: false,
      });
    }
  }

  async function disconnect(platform: Platform) {
    if (!confirm(`¿Desconectar ${PLATFORM_META[platform].label}? Tendrás que volver a autorizar.`)) return;
    const r = await apiFetch(`/connect/${platform}`, { method: 'DELETE' });
    if (r.ok) {
      setBanner({ text: `Desconectado de ${PLATFORM_META[platform].label}`, ok: true });
      refresh();
    }
  }

  const byPlatform = (p: Platform) => connections.find((c) => c.platform === p);

  return (
    <div className="min-h-screen w-screen text-white" style={{ background: '#0a0d12' }}>
      <NoiseFilter />
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between mb-8">
          <a href="/" className="flex items-center gap-2">
            <LogoMark className="w-6 h-6" />
            <span className="text-sm font-semibold">Adkio</span>
          </a>
          <div className="flex items-center gap-4 text-xs text-white/60">
            <span>{account?.email}</span>
            <button onClick={onLogout} className="hover:text-white">Cerrar sesión</button>
          </div>
        </header>

        <h1 className="text-3xl font-semibold tracking-tight mb-2">Cuentas conectadas</h1>
        <p className="text-white/60 mb-8 text-sm">
          Conectá las plataformas donde querés lanzar campañas. Adkio elige automáticamente la mejor según tu objetivo.
        </p>

        {banner && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg text-sm ${banner.ok ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200' : 'bg-red-500/10 border border-red-500/30 text-red-200'}`}
          >
            {banner.text}
          </div>
        )}

        <div className="space-y-3">
          {(['meta', 'tiktok', 'google_ads'] as Platform[]).map((platform) => {
            const conn = byPlatform(platform);
            const meta = PLATFORM_META[platform];
            return (
              <div
                key={platform}
                className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.02]"
              >
                <PlatformIcon platform={platform} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{meta.label}</div>
                  {conn ? (
                    <div className="text-xs text-white/55 mt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Conectado · {conn.provider_account_id}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-white/40 mt-0.5">No conectado</div>
                  )}
                </div>
                {conn ? (
                  <button
                    onClick={() => disconnect(platform)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-white/70"
                  >
                    Desconectar
                  </button>
                ) : (
                  <button
                    onClick={() => connect(platform)}
                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-white text-black hover:bg-white/90"
                  >
                    Conectar →
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-white/35 mt-8 leading-relaxed">
          Adkio guarda únicamente tokens cifrados (Fernet AES-128) y nunca tu contraseña.
          {' '}Desconectando una plataforma revocás el acceso inmediato.
        </p>
      </div>
    </div>
  );
}

