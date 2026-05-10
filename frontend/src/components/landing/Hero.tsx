import AppleButton from '../ui/AppleButton';
import { gradientStyle } from '../../lib/styles';

export default function Hero() {
  return (
    <section className="pt-16 md:pt-28 pb-20 text-center flex flex-col items-center px-6">
      <div
        className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[11px] text-white/70 opacity-0 animate-aura-fade-down"
        style={{ animationDelay: '0.2s' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff] animate-pulse" />
        <span>Ya disponible para Meta Ads</span>
      </div>
      <h1
        className="text-4xl md:text-7xl font-semibold tracking-tight leading-[0.9] opacity-0 animate-aura-h1"
        style={{ animationDelay: '0.3s' }}
      >
        <span className="block text-white">Tus Meta ads.</span>
        <span className="block animate-shiny" style={gradientStyle}>
          Conversacionales.
        </span>
      </h1>
      <p
        className="mt-8 text-white/60 max-w-md text-base leading-[1.5] opacity-0 animate-aura-fade-up"
        style={{ animationDelay: '0.5s' }}
      >
        Adkio convierte lenguaje natural en campañas de Meta Ads completas y segmentadas. Describí
        qué vendés y a quién querés llegar — Adkio escribe el copy, elige la audiencia y la pone al
        aire.
      </p>
      <div
        className="mt-8 flex flex-col items-center gap-3 opacity-0 animate-aura-fade-up"
        style={{ animationDelay: '0.7s' }}
      >
        <AppleButton label="Probá Adkio gratis" />
        <span className="text-xs text-white/40">
          Sin tarjeta · Conectá tu cuenta de Meta en 60 segundos
        </span>
      </div>
    </section>
  );
}
