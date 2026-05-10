import SectionEyebrow from '../ui/SectionEyebrow';
import { Sparkles } from '../ui/Icons';

const chips = [
  'Targeting automático',
  'Variantes de copy',
  'Distribución de presupuesto',
  'Publicación en un click',
];

const buckets = [
  {
    name: 'Audiencias',
    count: 4,
    color: '#ffffff',
    items: ['Lookalike 2% — compradores AR', 'Retargeting — visitantes 30d'],
  },
  {
    name: 'Creatividades',
    count: 7,
    color: '#e5e5e5',
    items: ['"Vuelve el verano. Y 40% off."', '"Un swipe. Después, verano."'],
  },
  {
    name: 'Ubicaciones Meta',
    count: 6,
    color: '#a3a3a3',
    items: ['Feed · 60% del gasto', 'Stories y Reels · 40% del gasto'],
  },
  {
    name: 'Optimización',
    count: 3,
    color: '#525252',
    items: ['Objetivo: compras · CPA meta $24'],
  },
];

export default function FeatureTriage() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
        <div>
          <SectionEyebrow label="Generación" tag="AI-native" />
          <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
            De una frase
            <br />a una campaña en vivo.
          </h2>
          <p className="mt-6 text-white/60 text-base leading-[1.6] max-w-md">
            Adkio lee tu prompt, planea la audiencia, escribe el copy, genera las creatividades y
            publica en Meta — en menos de un minuto. Iterás escribiendo, no haciendo click en seis
            dashboards.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c}
                className="text-xs text-white/70 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="liquid-glass rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-white/55 mb-4">
            <span>Esta semana · 18 campañas generadas</span>
            <Sparkles className="w-3.5 h-3.5" color="#A4F4FD" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {buckets.map((b) => (
              <div key={b.name} className="liquid-glass rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                    <span className="text-sm text-white font-medium">{b.name}</span>
                    <span className="text-xs text-white/40">({b.count})</span>
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {b.items.map((it) => (
                    <li key={it} className="text-xs text-white/55">
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
