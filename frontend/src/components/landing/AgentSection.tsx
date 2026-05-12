import type { CSSProperties } from 'react';
import SectionEyebrow from '../ui/SectionEyebrow';
import { gradientStyle, monoFont } from '../../lib/styles';

const steps = [
  { fn: 'budget_validator', result: 'Presupuesto viable: $14.3/día', t: '~5s' },
  { fn: 'audience_analyzer', result: '640K founders · CO, MX, PE, AR', t: '~15s' },
  { fn: 'copy_generator', result: '"¿Cuántas decisiones tomás solo?"', t: '~35s' },
  { fn: 'campaign_validator', result: '8/8 criterios Meta superados', t: '~55s' },
];

function CheckIcon() {
  return (
    <span
      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
      style={{
        background: 'rgba(0,210,255,0.08)',
        border: '1px solid rgba(164,244,253,0.35)',
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#A4F4FD"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

export default function AgentSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-t border-white/10">
      <div className="flex flex-col items-center text-center">
        <SectionEyebrow label="El agente" />
        <h2
          className="mt-5 text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.02] max-w-3xl"
          style={{ textWrap: 'balance' } as CSSProperties}
        >
          <span className="block">Una frase. Cuatro pasos.</span>
          <span className="block">
            Tu campaña{' '}
            <span className="animate-shiny" style={gradientStyle}>
              lista en menos de 1 minuto.
            </span>
          </span>
        </h2>
        <p className="mt-6 text-white/60 text-base max-w-lg leading-[1.6]">
          El agente de Adkio valida tu presupuesto, analiza la audiencia, escribe el copy y revisa
          los criterios de Meta — sin que abras Ads Manager.
        </p>
      </div>

      <div className="relative mt-16 md:mt-20 max-w-4xl mx-auto">
        {/* Floating: Tiempo de creación */}
        <div
          className="absolute -top-6 -left-2 md:-top-8 md:-left-12 z-20 opacity-0 animate-aura-fade-up"
          style={{ animationDelay: '0.15s' }}
        >
          <div
            className="liquid-glass rounded-2xl px-5 py-3.5"
            style={{ background: 'rgba(14,16,20,0.92)', minWidth: 180 }}
          >
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              Tiempo de creación
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-3xl font-semibold tracking-tight text-white">
                &lt;1<span className="text-base ml-0.5 text-white/50">min</span>
              </span>
              <span className="text-[10px] text-[#A4F4FD]">vs 3+ horas manual</span>
            </div>
          </div>
        </div>

        {/* Main mockup — chrome matches Inboxes window */}
        <div
          className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0e1014]/90 backdrop-blur-2xl opacity-0 animate-aura-rise"
          style={{ animationDelay: '0.25s' }}
        >
          {/* Window chrome */}
          <div className="h-9 flex items-center px-4 border-b border-white/10 bg-black/30 relative">
            <div className="flex gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
              <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
              <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 text-xs text-white/50">
              Adkio — Agente de campaña
            </div>
            <div className="ml-auto inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/60">
              <span className="relative flex w-1.5 h-1.5">
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: '#00d2ff', opacity: 0.6 }}
                />
                <span
                  className="relative rounded-full w-1.5 h-1.5"
                  style={{ background: '#00d2ff' }}
                />
              </span>
              <span>En vivo</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 md:p-7">
            {/* Prompt row */}
            <div className="flex items-start gap-3 pb-5 border-b border-white/10">
              <span
                className="text-base leading-[1.4] select-none"
                style={{ color: '#A4F4FD' }}
              >
                ›
              </span>
              <div className="flex-1 text-sm md:text-base text-white/90 leading-[1.45]">
                Quiero llenar mi evento en Bogotá, $200, público ejecutivo
                <span
                  className="inline-block w-2 h-4 ml-0.5 align-middle animate-aura-caret"
                  style={{ background: '#A4F4FD' }}
                />
              </div>
            </div>

            {/* Step list */}
            <div className="mt-5 flex flex-col gap-2.5">
              {steps.map((s, i) => (
                <div
                  key={s.fn}
                  className="opacity-0 animate-aura-fade-up flex items-center gap-3 md:gap-4 rounded-xl border border-white/[0.07] bg-white/[0.015] px-4 py-3.5"
                  style={{ animationDelay: `${0.3 + i * 0.12}s` }}
                >
                  <CheckIcon />
                  <span
                    style={{ fontFamily: monoFont, color: '#A4F4FD' }}
                    className="text-sm md:text-[15px] flex-shrink-0"
                  >
                    {s.fn}
                  </span>
                  <span className="hidden sm:inline text-sm text-white/80 truncate">
                    {s.result}
                  </span>
                  <span className="ml-auto rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-white/55 flex-shrink-0">
                    {s.t}
                  </span>
                </div>
              ))}
            </div>

            {/* Mobile-only step results */}
            <div className="sm:hidden mt-3 space-y-1 text-xs text-white/60 px-1">
              {steps.map((s) => (
                <div key={s.fn}>{s.result}</div>
              ))}
            </div>

            {/* Success row */}
            <div
              className="mt-6 rounded-xl px-4 py-4 opacity-0 animate-aura-fade-up"
              style={{
                animationDelay: '0.85s',
                background: 'rgba(0,210,255,0.05)',
                border: '1px solid rgba(164,244,253,0.28)',
              }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm md:text-base text-white/90">
                  Campaña lista para revisión
                </div>
                <button
                  onClick={() => (window.location.href = '/dashboard')}
                  className="text-xs font-semibold tracking-tight px-4 py-2 rounded-full bg-white text-black hover:bg-white/90 transition-colors"
                >
                  Revisar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
