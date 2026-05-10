import type { CSSProperties, ReactNode } from 'react';
import SectionEyebrow from '../ui/SectionEyebrow';
import { gradientStyle } from '../../lib/styles';

const ClockIcon: ReactNode = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
  </svg>
);

const TargetIcon: ReactNode = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2.5" x2="12" y2="6.5" />
    <line x1="12" y1="17.5" x2="12" y2="21.5" />
    <line x1="2.5" y1="12" x2="6.5" y2="12" />
    <line x1="17.5" y1="12" x2="21.5" y2="12" />
  </svg>
);

const LayersIcon: ReactNode = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="12 3 2.5 8 12 13 21.5 8 12 3" />
    <polyline points="2.5 13 12 18 21.5 13" />
    <polyline points="2.5 17.5 12 22.5 21.5 17.5" />
  </svg>
);

const cards = [
  {
    icon: ClockIcon,
    title: 'Configurar bien una campaña toma 2+ horas.',
    body: 'Audiencias, presupuesto, ubicaciones, creatividades, conversiones, exclusiones. Cada paso es un lugar donde algo se rompe.',
    stat: '~127 min',
    statLabel: 'por campaña',
  },
  {
    icon: TargetIcon,
    title: 'Las agencias cobran $2K/mes por hacer lo mismo.',
    body: 'Pagás un fee mensual fijo, mandás briefings por Slack y esperás 3 días para ver tu primera campaña al aire.',
    stat: '$2,000 USD',
    statLabel: 'mes promedio LATAM',
  },
  {
    icon: LayersIcon,
    title: 'Un error reinicia la fase de aprendizaje.',
    body: 'Cambiar el presupuesto a destiempo, usar el evento equivocado, mezclar ubicaciones. 7 días de optimización a la basura.',
    stat: '~$340 USD',
    statLabel: 'perdidos por reset',
  },
];

export default function StatusQuo() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-t border-white/10">
      <div className="flex flex-col items-center text-center">
        <SectionEyebrow label="El status quo" />
        <h2
          className="mt-5 text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.02] max-w-4xl"
          style={{ textWrap: 'balance' } as CSSProperties}
        >
          <span className="block">Lanzar bien una campaña en Meta</span>
          <span className="block">
            es{' '}
            <span className="animate-shiny" style={gradientStyle}>
              caro y lento.
            </span>
          </span>
        </h2>
        <p className="mt-6 text-white/60 text-base max-w-md leading-[1.6]">
          Y un solo error te resetea siete días de aprendizaje del algoritmo.
        </p>
      </div>

      <div className="mt-14 grid md:grid-cols-3 gap-5">
        {cards.map((c, i) => (
          <article key={i} className="liquid-glass rounded-2xl p-6 flex flex-col">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-6"
              style={{
                color: '#A4F4FD',
                background: 'rgba(0,210,255,0.08)',
                border: '1px solid rgba(164,244,253,0.20)',
              }}
            >
              {c.icon}
            </div>
            <h3 className="text-lg md:text-xl font-semibold text-white leading-[1.25] tracking-tight">
              {c.title}
            </h3>
            <p className="mt-3 text-sm text-white/60 leading-[1.6]">{c.body}</p>
            <div className="mt-6 pt-5 border-t border-white/10 flex items-baseline gap-2">
              <span className="text-sm font-semibold text-white tracking-tight">{c.stat}</span>
              <span className="text-xs text-white/45">· {c.statLabel}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
