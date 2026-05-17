import { gradientStyle } from '../../lib/styles';

type Card = {
  badge: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
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
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.36a8.16 8.16 0 0 0 4.77 1.52V6.43a4.85 4.85 0 0 1-1.84-.74z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

const CARDS: Card[] = [
  {
    badge: 'Meta Ads',
    title: 'Facebook + Instagram, sin Ads Manager',
    desc: 'Adkio genera el copy, define la audiencia detallada y los objetivos (leads, ventas, mensajes) y deja la campaña en PAUSED para tu OK.',
    icon: <MetaIcon />,
  },
  {
    badge: 'TikTok Ads',
    title: 'Llegale a Gen Z en formato vertical',
    desc: 'Hooks adaptados al feed de TikTok, segmentación por intereses y comportamiento, y validación de cada paso contra las reglas de la plataforma.',
    icon: <TikTokIcon />,
  },
  {
    badge: 'Google Ads',
    title: 'Búsqueda + YouTube + Display',
    desc: 'Adkio elige keywords, escribe los responsive search ads y configura el customer_id correcto — vos no tocás el panel de Google.',
    icon: <GoogleIcon />,
  },
];

const STATS = [
  { value: '3', label: 'Plataformas\nconectadas' },
  { value: '60s', label: 'De config\na live' },
  { value: '100%', label: 'Pausadas\nhasta tu OK' },
];

export default function WhyAdkio() {
  return (
    <section id="producto" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-x-10 gap-y-12 items-start">
        {/* ── Left: copy + stats ── */}
        <div className="md:col-span-6">
          <span className="inline-flex items-center gap-2 border border-white/15 rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase text-white/80 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff] animate-pulse" />
            Por qué Adkio
          </span>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            <span className="block text-white">Una frase. Tres plataformas.</span>
            <span className="block animate-shiny" style={gradientStyle}>
              Cero dashboards.
            </span>
          </h2>

          <p className="mt-6 text-white/60 text-base leading-[1.6] max-w-md">
            Hoy lanzar bien una campaña en Meta, TikTok o Google requiere tres herramientas
            distintas, tres lenguajes y horas de configuración manual. Adkio entiende qué querés
            vender, elige la plataforma correcta y arma toda la campaña — copy, audiencia,
            presupuesto y validación — desde una sola frase en español.
          </p>

          {/* Stats row */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col">
                <div className="text-3xl md:text-4xl font-semibold tracking-tight text-white tabular-nums">
                  {s.value}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/40 leading-snug whitespace-pre-line">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: cards ── */}
        <div className="md:col-span-6 flex flex-col gap-3">
          {CARDS.map((c) => (
            <div
              key={c.badge}
              className="liquid-glass rounded-2xl p-5 md:p-6 transition-colors hover:bg-white/[0.025]"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white/85"
                  style={{
                    background: 'rgba(0,210,255,0.06)',
                    border: '1px solid rgba(164,244,253,0.20)',
                  }}
                >
                  {c.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#A4F4FD]">
                      {c.badge}
                    </span>
                  </div>
                  <div className="text-white font-medium text-base md:text-lg leading-snug mb-2">
                    {c.title}
                  </div>
                  <p className="text-white/55 text-sm leading-[1.55]">{c.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
