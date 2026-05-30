import { useEffect, useState } from 'react';
import { apiFetch, parseErrorResponse } from '@/lib/api';
import { isLoggedIn, getAccount, logout, type Account } from '@/lib/auth';
import ConnectionCard, {
  type Platform,
  type Connection,
  PLATFORM_META,
} from '@/components/settings/ConnectionCard';
import { Check } from '@/components/ui/Icons';

type Props = {
  open: boolean;
  onClose: () => void;
};

type Tab = 'connections' | 'brand' | 'account';

/**
 * Slide-over drawer que vive dentro del dashboard. El usuario abre Settings
 * desde el sidebar o desde el top bar — no es una página separada.
 *
 * Soporta dos formas de conectar plataformas:
 *  1. OAuth (recomendado, pero requiere app aprobada por el provider)
 *  2. API key manual (pegar access_token + provider_account_id)
 */
export default function SettingsDrawer({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('connections');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlatform, setBusyPlatform] = useState<Platform | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [manualOpen, setManualOpen] = useState<Platform | null>(null);

  const logged = isLoggedIn();
  const account = getAccount();

  async function refresh() {
    if (!logged) {
      setLoading(false);
      setConnections([]);
      return;
    }
    setLoading(true);
    try {
      const r = await apiFetch('/connect/status');
      if (r.ok) {
        const data = (await r.json()) as { connections: Connection[] };
        setConnections(data.connections ?? []);
      } else if (r.status === 401) {
        // Token expirado — cerramos sesión y forzamos re-login
        logout();
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Captura el callback OAuth (?panel=settings&connect=meta&status=ok)
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const platform = qs.get('connect') as Platform | null;
    const status = qs.get('status');
    if (platform && status) {
      const label = PLATFORM_META[platform]?.label ?? platform;
      setBanner({
        text:
          status === 'ok'
            ? `${label} conectado correctamente`
            : `Falló: ${qs.get('msg') ?? 'error desconocido'}`,
        tone: status === 'ok' ? 'ok' : 'error',
      });
      // Limpiamos la query string pero preservamos el panel abierto
      window.history.replaceState({}, '', '/dashboard?panel=settings');
    }
  }, []);

  // Cierra con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function connect(platform: Platform) {
    setBusyPlatform(platform);
    setBanner(null);
    try {
      const r = await apiFetch(`/connect/${platform}`);
      if (!r.ok) {
        setBanner({ text: await parseErrorResponse(r), tone: 'error' });
        return;
      }
      const body = (await r.json()) as { authorize_url?: string };
      if (body.authorize_url) {
        // Volvemos al dashboard con el panel abierto
        sessionStorage.setItem('adkio.open_settings_after_oauth', '1');
        window.location.href = body.authorize_url;
      }
    } catch (err) {
      setBanner({ text: err instanceof Error ? err.message : 'Error iniciando OAuth', tone: 'error' });
    } finally {
      setBusyPlatform(null);
    }
  }

  async function disconnect(platform: Platform) {
    const meta = PLATFORM_META[platform];
    if (!confirm(`¿Desconectar ${meta.label}? Tendrás que volver a autorizar para usarlo otra vez.`)) {
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

  async function saveManual(platform: Platform, payload: ManualPayload) {
    setBusyPlatform(platform);
    setBanner(null);
    try {
      const r = await apiFetch(`/connect/${platform}/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        setBanner({ text: await parseErrorResponse(r), tone: 'error' });
        return;
      }
      const meta = PLATFORM_META[platform];
      setBanner({ text: `${meta.label} conectado con API key manual`, tone: 'ok' });
      setManualOpen(null);
      await refresh();
    } finally {
      setBusyPlatform(null);
    }
  }

  const byPlatform = (p: Platform) => connections.find((c) => c.platform === p);
  const connectedCount = connections.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-screen w-full md:max-w-xl bg-[#0e1117] border-l border-white/10 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: 'linear-gradient(180deg, #0e1117 0%, #0a0d12 100%)' }}
        role="dialog"
        aria-label="Configuración"
      >
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-white">Configuración</span>
            {logged && (
              <span className="text-[10px] text-white/40">
                · {account?.email}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-white/5 text-white/55 hover:text-white text-sm flex items-center justify-center transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 px-5">
          <TabButton active={tab === 'connections'} onClick={() => setTab('connections')}>
            Conexiones {connectedCount > 0 && <span className="text-white/40">· {connectedCount}/3</span>}
          </TabButton>
          <TabButton active={tab === 'brand'} onClick={() => setTab('brand')}>
            Marca
          </TabButton>
          <TabButton active={tab === 'account'} onClick={() => setTab('account')}>
            Cuenta
          </TabButton>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ height: 'calc(100% - 6.5rem)' }}>
          {/* Login gate */}
          {!logged && (
            <div className="p-6">
              <LoginGate />
            </div>
          )}

          {/* Connections tab */}
          {logged && tab === 'connections' && (
            <div className="p-5 space-y-4">
              <div className="text-xs text-white/55 leading-relaxed">
                Conectá tus cuentas de ads para que Adkio pueda lanzar campañas.{' '}
                <strong className="text-white/70">Adkio elige la mejor plataforma</strong> según tu
                objetivo, audiencia y presupuesto.
              </div>

              {banner && (
                <div
                  className={`flex items-start gap-3 px-3.5 py-2.5 rounded-xl border text-xs ${
                    banner.tone === 'ok'
                      ? 'bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-100'
                      : 'bg-red-500/[0.08] border-red-500/25 text-red-100'
                  }`}
                >
                  <span className="mt-0.5">
                    {banner.tone === 'ok' ? <Check className="w-3.5 h-3.5" /> : '✕'}
                  </span>
                  <span className="flex-1">{banner.text}</span>
                  <button
                    onClick={() => setBanner(null)}
                    className="text-white/40 hover:text-white text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {(['meta', 'tiktok', 'google_ads'] as Platform[]).map((platform) => (
                  <div key={platform}>
                    <ConnectionCard
                      platform={platform}
                      connection={byPlatform(platform)}
                      loading={loading}
                      busy={busyPlatform === platform}
                      onConnect={() => connect(platform)}
                      onDisconnect={() => disconnect(platform)}
                    />
                    {!byPlatform(platform) && (
                      <button
                        onClick={() => setManualOpen(manualOpen === platform ? null : platform)}
                        className="mt-2 text-[11px] text-white/45 hover:text-white/85 transition-colors px-1"
                      >
                        {manualOpen === platform ? '↑ Cerrar' : '↓ Conectar con API key manual'}
                      </button>
                    )}
                    {manualOpen === platform && (
                      <ManualKeyForm
                        platform={platform}
                        busy={busyPlatform === platform}
                        onSubmit={(payload) => saveManual(platform, payload)}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-5 border-t border-white/[0.06] text-[11px] text-white/40 leading-relaxed">
                Adkio guarda tokens cifrados (Fernet AES-128) y nunca tu password. Desconectando
                una plataforma revocás el acceso al instante.
              </div>
            </div>
          )}

          {/* Brand tab */}
          {logged && tab === 'brand' && <BrandTab />}

          {/* Account tab */}
          {logged && tab === 'account' && account && (
            <AccountTab account={account} />
          )}
        </div>
      </aside>
    </>
  );
}

// ── Brand tab — editar la marca de la cuenta (brand por cuenta) ─────────────

type BrandConfig = {
  negocio_nombre?: string;
  negocio_industria?: string;
  propuesta_de_valor?: string;
  publico_paises?: string[];
  publico_edad_min?: number;
  publico_edad_max?: number;
  publico_intereses?: string[];
  presupuesto_min_campana_usd?: number;
  presupuesto_max_campana_usd?: number;
  tono_estilo?: string[];
  tono_evitar?: string[];
};

function BrandTab() {
  const [data, setData] = useState<BrandConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await apiFetch('/brand-config/me');
        if (!cancel && r.ok) setData(await r.json());
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  function set<K extends keyof BrandConfig>(k: K, v: BrandConfig[K]) {
    setData((prev) => ({ ...(prev ?? {}), [k]: v }));
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setBanner(null);
    try {
      const payload = {
        negocio_nombre: data.negocio_nombre,
        negocio_industria: data.negocio_industria,
        propuesta_de_valor: data.propuesta_de_valor,
        publico_paises: data.publico_paises,
        publico_edad_min: data.publico_edad_min,
        publico_edad_max: data.publico_edad_max,
        publico_intereses: data.publico_intereses,
        presupuesto_min_campana_usd: data.presupuesto_min_campana_usd,
        presupuesto_max_campana_usd: data.presupuesto_max_campana_usd,
        tono_estilo: data.tono_estilo,
      };
      const r = await apiFetch('/brand-config/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        setData(await r.json());
        setBanner({ text: 'Marca actualizada — el agente la usará en tus próximas campañas.', tone: 'ok' });
      } else {
        setBanner({ text: await parseErrorResponse(r), tone: 'error' });
      }
    } catch (e) {
      setBanner({ text: e instanceof Error ? e.message : 'Error al guardar', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-xs text-white/40">Cargando tu marca…</div>;
  }
  if (!data) {
    return <div className="p-6 text-xs text-white/40">No se pudo cargar la marca.</div>;
  }

  const csv = (arr?: string[]) => (arr ?? []).join(', ');
  const toArr = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  return (
    <div className="p-5 space-y-3">
      <div className="text-xs text-white/55 leading-relaxed">
        Adkio usa tu marca para inferir audiencia, copy y plataforma. Cuanto más precisa, mejores
        las campañas. <strong className="text-white/70">Se aplica a tu cuenta</strong>.
      </div>

      {banner && (
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs ${
            banner.tone === 'ok'
              ? 'bg-emerald-500/[0.08] border-emerald-500/25 text-emerald-100'
              : 'bg-red-500/[0.08] border-red-500/25 text-red-100'
          }`}
        >
          {banner.text}
        </div>
      )}

      <BField label="Nombre del negocio" value={data.negocio_nombre ?? ''} onChange={(v) => set('negocio_nombre', v)} />
      <BField label="Industria / vertical" value={data.negocio_industria ?? ''} onChange={(v) => set('negocio_industria', v)} placeholder="ej: e-commerce de moda, SaaS B2B, gimnasio" />
      <BField label="Propuesta de valor" value={data.propuesta_de_valor ?? ''} onChange={(v) => set('propuesta_de_valor', v)} textarea />
      <BField label="Países (separados por coma)" value={csv(data.publico_paises)} onChange={(v) => set('publico_paises', toArr(v))} placeholder="Mexico, Colombia" />
      <div className="grid grid-cols-2 gap-3">
        <BField label="Edad mín" value={String(data.publico_edad_min ?? '')} onChange={(v) => set('publico_edad_min', Number(v) || undefined)} type="number" />
        <BField label="Edad máx" value={String(data.publico_edad_max ?? '')} onChange={(v) => set('publico_edad_max', Number(v) || undefined)} type="number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <BField label="Presup. mín (USD)" value={String(data.presupuesto_min_campana_usd ?? '')} onChange={(v) => set('presupuesto_min_campana_usd', Number(v) || undefined)} type="number" />
        <BField label="Presup. máx (USD)" value={String(data.presupuesto_max_campana_usd ?? '')} onChange={(v) => set('presupuesto_max_campana_usd', Number(v) || undefined)} type="number" />
      </div>
      <BField label="Tono (separado por coma)" value={csv(data.tono_estilo)} onChange={(v) => set('tono_estilo', toArr(v))} placeholder="cercano, profesional, directo" />

      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-2 py-2.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-40 transition-opacity"
      >
        {saving ? 'Guardando…' : 'Guardar marca'}
      </button>
    </div>
  );
}

function BField({
  label, value, onChange, placeholder, type = 'text', textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-white/45 mb-1">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs placeholder:text-white/25 focus:outline-none focus:border-[#00d2ff]/50 resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs placeholder:text-white/25 focus:outline-none focus:border-[#00d2ff]/50"
        />
      )}
    </label>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-3 text-xs font-medium transition-colors ${
        active ? 'text-white' : 'text-white/45 hover:text-white/75'
      }`}
    >
      {children}
      {active && (
        <span
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, #00d2ff, transparent)' }}
        />
      )}
    </button>
  );
}

function LoginGate() {
  return (
    <div className="text-center py-10">
      <div className="text-base font-semibold text-white mb-2">Iniciá sesión para configurar conexiones</div>
      <p className="text-xs text-white/55 leading-relaxed max-w-xs mx-auto mb-6">
        Tus conexiones a Meta, TikTok y Google Ads quedan ligadas a tu cuenta Adkio. Sin login
        usamos las credenciales del entorno por default (modo demo).
      </p>
      <a
        href="/login"
        className="inline-block text-sm font-semibold px-5 py-2.5 rounded-lg bg-white text-black hover:bg-white/90"
      >
        Iniciar sesión
      </a>
      <a href="/signup" className="block mt-3 text-xs text-white/55 hover:text-white">
        ¿No tenés cuenta? Registrate
      </a>
    </div>
  );
}

function AccountTab({ account }: { account: Account }) {
  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.015] p-4">
        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Email</div>
        <div className="text-sm text-white">{account.email}</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.015] p-4">
        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Plan</div>
        <div className="text-sm text-white capitalize">{account.plan}</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.015] p-4">
        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Account ID</div>
        <code className="text-xs text-white/70 font-mono break-all">{account.id}</code>
      </div>

      <button
        onClick={() => {
          if (confirm('¿Cerrar sesión?')) {
            logout();
            window.location.href = '/';
          }
        }}
        className="w-full mt-4 py-2.5 rounded-lg text-xs font-medium border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

// ── Manual API key form ────────────────────────────────────────────────────

type ManualPayload = {
  access_token: string;
  provider_account_id: string;
  extra?: Record<string, unknown>;
};

const MANUAL_HELP: Record<Platform, { tokenHelp: string; idHelp: string; extraField?: { key: string; label: string; help: string } }> = {
  meta: {
    tokenHelp: 'Generá uno en developers.facebook.com/tools/explorer con scopes ads_management + ads_read',
    idHelp: 'Formato act_XXXXXXXXXX — está en business.facebook.com > Ad Accounts',
    extraField: { key: 'page_id', label: 'Page ID (opcional)', help: 'Sin él el adapter solo crea Campaign, no AdSet ni Ad' },
  },
  tiktok: {
    tokenHelp: 'Sandbox token desde TikTok for Business Developer Portal',
    idHelp: 'Advertiser ID del sandbox o cuenta real',
  },
  google_ads: {
    tokenHelp: 'Refresh token — generalo con generate_user_credentials.py del SDK de Google Ads',
    idHelp: 'Customer ID (10 dígitos, sin guiones)',
  },
};

function ManualKeyForm({
  platform,
  busy,
  onSubmit,
}: {
  platform: Platform;
  busy: boolean;
  onSubmit: (payload: ManualPayload) => void;
}) {
  const help = MANUAL_HELP[platform];
  const [token, setToken] = useState('');
  const [pid, setPid] = useState('');
  const [extraValue, setExtraValue] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: ManualPayload = {
      access_token: token.trim(),
      provider_account_id: pid.trim(),
    };
    if (help.extraField && extraValue.trim()) {
      payload.extra = { [help.extraField.key]: extraValue.trim() };
    }
    onSubmit(payload);
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 p-4 rounded-xl border border-white/[0.07] bg-white/[0.015] space-y-3"
    >
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-white/45 mb-1">
          Access token
        </label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          placeholder="pegá tu access_token"
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs placeholder:text-white/25 focus:outline-none focus:border-[#00d2ff]/50 font-mono"
        />
        <div className="mt-1 text-[10px] text-white/40">{help.tokenHelp}</div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-white/45 mb-1">
          {PLATFORM_META[platform].idLabel}
        </label>
        <input
          type="text"
          value={pid}
          onChange={(e) => setPid(e.target.value)}
          required
          placeholder={platform === 'meta' ? 'act_269458954399128' : platform === 'google_ads' ? '1234567890' : 'tu advertiser_id'}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs placeholder:text-white/25 focus:outline-none focus:border-[#00d2ff]/50 font-mono"
        />
        <div className="mt-1 text-[10px] text-white/40">{help.idHelp}</div>
      </div>

      {help.extraField && (
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white/45 mb-1">
            {help.extraField.label}
          </label>
          <input
            type="text"
            value={extraValue}
            onChange={(e) => setExtraValue(e.target.value)}
            placeholder="opcional"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs placeholder:text-white/25 focus:outline-none focus:border-[#00d2ff]/50 font-mono"
          />
          <div className="mt-1 text-[10px] text-white/40">{help.extraField.help}</div>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !token.trim() || !pid.trim()}
        className="w-full py-2 rounded-lg text-xs font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-40 transition-opacity"
      >
        {busy ? 'Guardando…' : 'Guardar credenciales'}
      </button>
    </form>
  );
}
