import { useState } from 'react';
import { Check } from '../ui/Icons';

type Plan = {
  tier: string;
  priceMonth: string;
  priceYear: string;
  desc: string;
  pro?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    tier: 'Starter',
    priceMonth: 'Gratis',
    priceYear: 'Gratis',
    desc: 'Para founders en solitario corriendo sus primeras campañas pagas.',
    features: [
      'Hasta 3 campañas activas',
      'Hasta $2.000 / mes de gasto gestionado',
      'Generación con IA básica',
      'Meta, TikTok y Google Ads',
      '1 cuenta por plataforma',
    ],
  },
  {
    tier: 'Growth',
    priceMonth: '$49/m',
    priceYear: '$490/año',
    desc: 'Para marcas y equipos chicos escalando su adquisición paga.',
    features: [
      'Campañas ilimitadas',
      'Hasta $50.000 / mes de gasto gestionado',
      'Modelado avanzado de audiencias',
      'Generador de variantes creativas',
      'Hasta 5 personas en el equipo',
    ],
  },
  {
    tier: 'Agency',
    priceMonth: '$199/m',
    priceYear: '$1.990/año',
    desc: 'Para agencias y operadores gestionando varias marcas a la vez.',
    pro: true,
    features: [
      'Gasto y cuentas publicitarias ilimitadas',
      'Workspaces multi-marca',
      'Plantillas de prompts personalizadas',
      'Reportes white-label',
      'Soporte prioritario por Slack',
    ],
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="precios" className="relative flex flex-col items-center overflow-x-hidden px-5 pt-10 pb-20">
      {/* Local noise filter for watermark gradient */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="c3-noise-pricing">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.5"
            numOctaves={2}
            stitchTiles="stitch"
          />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.075" />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="overlay" />
        </filter>
      </svg>

      {/* Watermark headline */}
      <div className="relative w-full max-w-[1100px] text-center mt-10 z-[2]">
        <div className="flex flex-col items-center font-extrabold leading-[0.9] tracking-[-0.05em] text-[3.5rem] lg:text-[9rem] lg:[filter:url(#c3-noise-pricing)]">
          <span className="text-white">Tus ads en 3 plataformas.</span>
          <span
            className="text-[#00d2ff] lg:text-transparent lg:bg-clip-text"
            style={{
              backgroundImage:
                'linear-gradient(to right, #091020 0%, #0B2551 25%, #A4F4FD 65%, #00d2ff 100%)',
            }}
          >
            Conversacionales.
          </span>
        </div>
      </div>

      {/* Card grid */}
      <div className="relative z-[3] mt-10 lg:mt-[60px] w-full lg:max-w-[1100px] lg:grid lg:grid-cols-3 gap-6 lg:translate-x-5 flex overflow-x-auto snap-x snap-mandatory no-scrollbar lg:overflow-visible">
        {plans.map((p) => {
          const proBg = p.pro
            ? 'linear-gradient(135deg, rgba(0,0,0,0.85), rgba(0,0,0,0.55))'
            : 'linear-gradient(135deg, rgba(0,0,0,0.7), rgba(0,0,0,0.4))';
          return (
            <div
              key={p.tier}
              className="relative flex flex-col overflow-hidden rounded-[44px] border border-white snap-center flex-shrink-0 w-[320px] lg:w-auto px-6 py-[50px] min-h-[580px] backdrop-blur-[14px] backdrop-brightness-[0.91] transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-3 hover:scale-[1.01] hover:!bg-[rgba(15,15,15,0.6)] hover:!border-[rgba(34,211,238,0.7)]"
              style={{ background: proBg }}
            >
              {/* Inner gloss */}
              <span
                className="pointer-events-none absolute inset-0 rounded-[inherit]"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)',
                }}
              />
              <div className="relative text-[1.1rem] font-normal text-white/60">{p.tier}</div>
              <div className="relative mt-2 text-[2.8rem] font-medium tracking-[-0.02em] text-white">
                {yearly ? p.priceYear : p.priceMonth}
              </div>
              <div className="relative text-[0.88rem] text-white/45 leading-[1.5] mt-4 mb-10 min-h-[3.2em]">
                {p.desc}
              </div>
              <ul className="relative m-0 p-0 list-none">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3.5 text-[0.92rem] text-white/80 mb-[18px] leading-[1.4]"
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => (window.location.href = '/dashboard')}
                className="relative mt-auto self-center rounded-full bg-white text-black text-[0.88rem] font-semibold px-8 py-2.5 cursor-pointer transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:bg-[#f5f5f5] hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(255,255,255,0.15)]"
              >
                Probar Adkio
              </button>
            </div>
          );
        })}
      </div>

      {/* Toggle */}
      <div className="w-full lg:max-w-[1100px] mt-8 flex items-center justify-center lg:justify-end gap-3 lg:pr-5 text-[0.9rem] text-white/70">
        <span>Anual</span>
        <button
          onClick={() => setYearly((v) => !v)}
          aria-label="Toggle yearly pricing"
          className={
            'relative w-[52px] h-7 rounded-full border-none p-0 cursor-pointer transition-colors duration-300 ' +
            (yearly ? 'bg-white/20' : 'bg-white')
          }
        >
          <span
            className={
              'absolute top-1 left-1 w-5 h-5 rounded-full transition-all duration-300 ' +
              (yearly ? 'translate-x-6 bg-white' : 'bg-black')
            }
          />
        </button>
      </div>
    </section>
  );
}
