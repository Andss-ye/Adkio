import { useState } from 'react';
import { signup, login, isLoggedIn } from '@/lib/auth';
import NoiseFilter from '@/components/ui/NoiseFilter';
import LogoMark from '@/components/ui/LogoMark';
import { Check } from '@/components/ui/Icons';

type Mode = 'login' | 'signup';

type Props = {
  /** Modo inicial — el usuario puede cambiarlo con la tab */
  initialMode: Mode;
};

const FEATURES = [
  { title: 'Una sola oración', desc: 'Describí la campaña — Adkio infiere objetivo, audiencia, copy y presupuesto.' },
  { title: 'Multi-canal', desc: 'Meta, TikTok y Google desde la misma cuenta. Adkio elige la mejor según tu objetivo.' },
  { title: 'Human-in-the-loop', desc: 'Todas las campañas se crean en PAUSED. Vos aprobás antes de que gaste un peso.' },
  { title: 'Memoria de marca', desc: 'Adkio aprende tu tono, tu audiencia y qué copy convierte para vos.' },
];

export default function AuthPage({ initialMode }: Props) {
  // Si ya estás logueado, redirect inmediato al dashboard
  if (isLoggedIn()) {
    window.location.replace('/dashboard');
    return null;
  }

  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="min-h-screen w-screen text-white overflow-hidden" style={{ background: '#0a0d12' }}>
      <NoiseFilter />

      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute top-0 left-0 w-[60vw] h-[60vh] opacity-50"
          style={{ background: 'radial-gradient(closest-side, rgba(0,210,255,0.18), rgba(0,0,0,0) 70%)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-[50vw] h-[50vh] opacity-40"
          style={{ background: 'radial-gradient(closest-side, rgba(164,244,253,0.15), rgba(0,0,0,0) 70%)' }}
        />
      </div>

      <header className="relative z-10 px-6 py-5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <LogoMark className="w-7 h-7" />
          <span className="text-sm font-semibold tracking-tight">Adkio</span>
        </a>
        <a href="/" className="text-xs text-white/45 hover:text-white transition-colors">
          ← Volver a la landing
        </a>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-8 pb-16 grid md:grid-cols-2 gap-12 items-center">
        {/* Left: Marketing */}
        <div className="hidden md:block">
          <span className="inline-flex items-center gap-2 border border-white/20 rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase text-white/85 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff] animate-pulse" />
            Cuenta Adkio
          </span>
          <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.05]">
            Tus campañas de ads,
            <br />
            <span className="italic font-serif text-white/95">desde una oración.</span>
          </h1>
          <p className="mt-5 text-white/55 text-[15px] leading-relaxed max-w-md">
            Creá una cuenta Adkio para conectar Meta, TikTok y Google Ads, y dejar que un agente
            experto configure tus campañas en segundos.
          </p>

          <ul className="mt-8 space-y-3.5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3 text-sm">
                <span
                  className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,210,255,0.10)', border: '1px solid rgba(164,244,253,0.30)' }}
                >
                  <Check className="w-2.5 h-2.5 text-[#A4F4FD]" />
                </span>
                <div className="leading-snug">
                  <div className="text-white/90 font-medium">{f.title}</div>
                  <div className="text-white/45 mt-0.5">{f.desc}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 inline-flex items-center gap-2 text-[10px] text-white/35 uppercase tracking-widest">
            <span>🏆</span>
            <span>Built in 36h · GTM Hackathon Bogotá</span>
          </div>
        </div>

        {/* Right: Form */}
        <div>
          <AuthForm mode={mode} setMode={setMode} />
        </div>
      </div>
    </div>
  );
}

function AuthForm({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
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
      // Después del login/signup vamos directo al dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handle}
      className="relative w-full max-w-md mx-auto rounded-2xl p-8 border border-white/10 backdrop-blur-xl"
      style={{ background: 'rgba(19,24,32,0.85)' }}
    >
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-7">
        <button
          type="button"
          onClick={() => { setMode('signup'); setError(''); window.history.replaceState({}, '', '/signup'); }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === 'signup' ? 'bg-white text-black shadow-lg' : 'text-white/55 hover:text-white'
          }`}
        >
          Crear cuenta
        </button>
        <button
          type="button"
          onClick={() => { setMode('login'); setError(''); window.history.replaceState({}, '', '/login'); }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            mode === 'login' ? 'bg-white text-black shadow-lg' : 'text-white/55 hover:text-white'
          }`}
        >
          Iniciar sesión
        </button>
      </div>

      <h2 className="text-xl font-semibold tracking-tight mb-1">
        {mode === 'signup' ? 'Empezá en 30 segundos' : 'Bienvenido de vuelta'}
      </h2>
      <p className="text-xs text-white/45 mb-6">
        {mode === 'signup' ? 'No te pedimos tarjeta. Free trial de 14 días.' : 'Entrá a tu workspace.'}
      </p>

      <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="vos@empresa.com" required />
      <Field
        label="Contraseña"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder={mode === 'signup' ? 'Mín. 8 caracteres + letra + número' : 'Tu contraseña'}
        required
        minLength={8}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg bg-red-500/[0.08] border border-red-500/25 text-red-200">
          <span>✕</span>
          <span className="flex-1">{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 group"
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #e6e6e6 100%)',
          color: '#000',
          boxShadow: loading ? 'none' : '0 4px 24px rgba(0,210,255,0.15)',
        }}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin" />
            {mode === 'signup' ? 'Creando…' : 'Entrando…'}
          </span>
        ) : (
          <span>
            {mode === 'signup' ? 'Crear mi cuenta' : 'Entrar'}{' '}
            <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        )}
      </button>

      <p className="mt-5 text-[10px] text-white/30 leading-relaxed text-center">
        Al continuar aceptás los{' '}
        <a href="/terminos" className="text-white/55 hover:text-white">términos</a>{' '}
        y la{' '}
        <a href="/privacidad" className="text-white/55 hover:text-white">política de privacidad</a>.
      </p>
    </form>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  minLength,
}: {
  label: string;
  type: 'email' | 'password' | 'text';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-[10px] uppercase tracking-widest text-white/45 mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoFocus={type === 'email'}
        className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm placeholder:text-white/25 focus:outline-none focus:border-[#00d2ff]/50 focus:bg-white/[0.06] transition-colors"
      />
    </label>
  );
}
