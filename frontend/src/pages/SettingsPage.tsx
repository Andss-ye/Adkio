import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccount, isLoggedIn, logout, signup, login, type Account } from '@/lib/auth';
import NoiseFilter from '@/components/ui/NoiseFilter';
import LogoMark from '@/components/ui/LogoMark';
import AuthScreen from '@/components/settings/AuthScreen';
import ConnectionCard, { type Platform, type Connection, PLATFORM_META } from '@/components/settings/ConnectionCard';
import { ChevronLeft, Check } from '@/components/ui/Icons';

export default function SettingsPage() {
  const [logged, setLogged] = useState(isLoggedIn());

  if (!logged) {
    return <AuthScreen onSuccess={() => setLogged(true)} signup={signup} login={login} />;
  }

  return (
    <ConnectionsView
      account={getAccount()}
      onLogout={() => {
        logout();
        setLogged(false);
      }}
    />
  );
}

function ConnectionsView({ account, onLogout }: { account: Account | null; onLogout: () => void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlatform, setBusyPlatform] = useState<Platform | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const r = await apiFetch('/connect/status');
      if (r.ok) {
        const data = (await r.json()) as { connections: Connection[] };
        setConnections(data.connections ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // Captura el resultado del OAuth callback (?connect=meta&status=ok|error&msg=...)
    const qs = new URLSearchParams(window.location.search);
    const platform = qs.get('connect') as Platform | null;
    const status = qs.get('status');
    if (platform && status) {
      const label = PLATFORM_META[platform]?.label ?? platform;
      setBanner({
        text: status === 'ok' ? `${label} conectado correctamente` : `Falló: ${qs.get('msg') ?? 'error desconocido'}`,
        tone: status === 'ok' ? 'ok' : 'error',
      });
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  async function connect(platform: Platform) {
    setBusyPlatform(platform);
    setBanner(null);
    try {
      const r = await apiFetch(`/connect/${platform}`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setBanner({ text: err.detail ?? `Error HTTP ${r.status}`, tone: 'error' });
        setBusyPlatform(null);
        return;
      }
      const body = (await r.json()) as { authorize_url?: string };
      if (body.authorize_url) {
        window.location.href = body.authorize_url;
      } else {
        setBanner({ text: 'No se obtuvo authorize_url del backend', tone: 'error' });
      }
    } catch (err) {
      setBanner({ text: err instanceof Error ? err.message : 'Error iniciando OAuth', tone: 'error' });
    } finally {
      setBusyPlatform(null);
    }
  }

  async function disconnect(platform: Platform) {
    const meta = PLATFORM_META[platform];
    if (!confirm(`¿Desconectar ${meta.label}? Tendrás que volver a autorizar a Adkio si querés usarlo otra vez.`)) {
      return;
    }
    setBusyPlatform(platform);
    try {
      const r = await apiFetch(`/connect/${platform}`, { method: 'DELETE' });
      if (r.ok) {
        setBanner({ text: `Desconectado de ${meta.label}`, tone: 'ok' });
        await refresh();
      } else {
        setBanner({ text: `No se pudo desconectar ${meta.label}`, tone: 'error' });
      }
    } finally {
      setBusyPlatform(null);
    }
  }

  const byPlatform = (p: Platform) => connections.find((c) => c.platform === p);
  const connectedCount = connections.length;

  return (
    <div className="min-h-screen w-screen text-white overflow-x-hidden" style={{ background: '#0a0d12' }}>
      <NoiseFilter />

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute top-0 left-0 w-[60vw] h-[60vh] opacity-40"
          style={{ background: 'radial-gradient(closest-side, rgba(0,210,255,0.10), rgba(0,0,0,0) 70%)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-[50vw] h-[50vh] opacity-30"
          style={{ background: 'radial-gradient(closest-side, rgba(164,244,253,0.08), rgba(0,0,0,0) 70%)' }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 h-12 flex items-center justify-between px-6 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center gap-2 group">
            <LogoMark className="w-6 h-6" />
            <span className="text-sm font-semibold tracking-tight">Adkio</span>
          </a>
          <span className="text-white/20">/</span>
          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="group inline-flex items-center gap-1 text-xs text-white/55 hover:text-white transition-colors"
            title="Volver al workspace"
          >
            <ChevronLeft className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" />
            Workspace
          </button>
          <span className="text-white/20">/</span>
          <span className="text-xs text-white/80 font-medium">Conexiones</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-white/45">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {account?.email}
          </div>
          <span
            className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border"
            style={{
              borderColor: 'rgba(0,210,255,0.30)',
              color: '#A4F4FD',
              background: 'rgba(0,210,255,0.06)',
            }}
          >
            {account?.plan ?? 'starter'}
          </span>
          <button
            onClick={onLogout}
            className="text-[11px] text-white/45 hover:text-white transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-10">
          <div>
            <span className="inline-flex items-center gap-2 border border-white/20 rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase text-white/80 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff] animate-pulse" />
              Conexiones de plataformas
            </span>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              Conectá tus cuentas{' '}
              <span className="italic font-serif text-white/90">de ads.</span>
            </h1>
            <p className="mt-3 text-white/55 text-sm max-w-md leading-relaxed">
              Adkio elige automáticamente la plataforma óptima según tu objetivo, audiencia y presupuesto.
              Cuantas más conectes, mejor decide.
            </p>
          </div>

          {/* Connection counter */}
          <div className="hidden md:flex flex-col items-end">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Conectadas</div>
            <div className="text-4xl font-semibold tracking-tight tabular-nums">
              {connectedCount}<span className="text-white/30 text-2xl">/3</span>
            </div>
          </div>
        </div>

        {/* Banner */}
        {banner && (
          <div
            className={`mb-8 flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
              banner.tone === 'ok'
                ? 'bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-100'
                : 'bg-red-500/[0.08] border-red-500/25 text-red-100'
            }`}
          >
            <span className="mt-0.5">
              {banner.tone === 'ok' ? <Check className="w-4 h-4" /> : '✕'}
            </span>
            <span className="flex-1">{banner.text}</span>
            <button
              onClick={() => setBanner(null)}
              className="text-white/40 hover:text-white text-xs"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        )}

        {/* Connection cards */}
        <div className="grid gap-3">
          {(['meta', 'tiktok', 'google_ads'] as Platform[]).map((platform) => (
            <ConnectionCard
              key={platform}
              platform={platform}
              connection={byPlatform(platform)}
              loading={loading}
              busy={busyPlatform === platform}
              onConnect={() => connect(platform)}
              onDisconnect={() => disconnect(platform)}
            />
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <InfoCell title="Tokens cifrados" desc="Guardamos solo ciphertext (Fernet AES-128). Tu password nunca toca disco." />
          <InfoCell title="Revocable al instante" desc="Desconectar elimina la fila y revoca el acceso de Adkio inmediatamente." />
          <InfoCell title="HITL por default" desc="Toda campaña se crea en PAUSED. Vos aprobás antes de que corra." />
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.06] text-[11px] text-white/30 flex items-center justify-between flex-wrap gap-3">
          <span>Account ID: <code className="text-white/45">{account?.id?.slice(0, 8)}…{account?.id?.slice(-4)}</code></span>
          <a href="/dashboard" className="text-white/45 hover:text-white">
            Ir al workspace →
          </a>
        </div>
      </div>
    </div>
  );
}

function InfoCell({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-4 py-3">
      <div className="text-white/85 font-medium mb-1">{title}</div>
      <div className="text-white/45 leading-snug">{desc}</div>
    </div>
  );
}
