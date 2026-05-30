import { useEffect, useState } from 'react';
import AppleButton from '../ui/AppleButton';
import { ChevronRight } from '../ui/Icons';
import { isLoggedIn } from '@/lib/auth';

export default function FinalCTA() {
  const [logged, setLogged] = useState(false);
  useEffect(() => setLogged(isLoggedIn()), []);
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-32">
      <div className="liquid-glass relative overflow-hidden rounded-3xl px-8 py-16 md:py-24 text-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(600px circle at 50% 0%, rgba(255,255,255,0.15), transparent 70%)',
            opacity: 0.3,
          }}
        />
        <h2 className="relative text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02]">
          <span className="block">Olvidá los dashboards.</span>
          <span className="block">Solo describí el anuncio.</span>
        </h2>
        <p className="relative mt-6 text-white/60 max-w-md mx-auto text-sm leading-[1.6]">
          Sumáte a los founders, marketers y agencias que lanzaron su última campaña en una sola
          frase.
        </p>
        <div className="relative mt-8 flex items-center justify-center gap-3 flex-wrap">
          <AppleButton
            label={logged ? 'Ir al dashboard' : 'Empezá gratis'}
            href={logged ? '/dashboard' : '/signup'}
          />
          <button className="group inline-flex items-center gap-2 rounded-full border border-white/15 text-white text-sm font-medium px-5 py-3 hover:bg-white/5 transition-colors">
            <span>Hablar con ventas</span>
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-[1px]" />
          </button>
        </div>
      </div>
    </section>
  );
}
