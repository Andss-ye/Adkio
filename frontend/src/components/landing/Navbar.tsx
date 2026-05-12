import { useState } from 'react';
import LogoMark from '../ui/LogoMark';
import AppleButton from '../ui/AppleButton';
import { Menu } from '../ui/Icons';

const LINKS = [
  { label: 'Producto', href: '#producto' },
  { label: 'Precios', href: '#precios' },
  { label: 'Seguridad', href: '/seguridad' },
];

function MetaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
    </svg>
  );
}

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative liquid-glass rounded-2xl p-8 max-w-sm w-full text-center"
        style={{ background: 'rgba(14,16,20,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Meta icon */}
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: '#1877F2' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-white mb-2">
          Conectar Meta Ads
        </h3>
        <p className="text-sm text-white/60 leading-relaxed mb-6">
          La verificación oficial de nuestra app con Meta está en proceso (2–5 días hábiles).
          <br /><br />
          Por ahora podés usar Adkio con nuestra cuenta de demostración y ver el flujo completo.
        </p>

        <div
          className="text-[10px] uppercase tracking-widest font-semibold mb-4 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)', color: '#f59e0b' }}
        >
          <span>⏳</span> Meta App Verification · In progress
        </div>

        <button
          onClick={() => { window.location.href = '/dashboard'; }}
          className="w-full py-3 rounded-xl text-sm font-semibold text-black transition-opacity hover:opacity-90"
          style={{ background: '#00d2ff' }}
        >
          Continuar con demo →
        </button>
        <button
          onClick={onClose}
          className="mt-3 w-full py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default function Navbar() {
  const [showMetaModal, setShowMetaModal] = useState(false);

  return (
    <>
      <nav className="max-w-6xl mx-auto px-6 pt-6 opacity-0 animate-aura-fade-down">
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-white">
            <LogoMark className="w-7 h-7" />
            <span className="text-sm font-semibold tracking-tight">Adkio</span>
          </a>
          <div className="hidden md:flex gap-8">
            {LINKS.map(({ label, href }, i) => (
              <a
                key={label}
                href={href}
                className="text-white/70 text-sm font-medium hover:text-white opacity-0 animate-aura-fade-down"
                style={{ animationDelay: `${0.1 + i * 0.05}s` }}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            {/* Meta SSO — coming soon, aesthetic */}
            <button
              onClick={() => setShowMetaModal(true)}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              <MetaIcon />
              Conectar Meta
            </button>
            <AppleButton label="Probar Adkio" href="/dashboard" />
          </div>
          <button className="md:hidden w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/80">
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {showMetaModal && <ComingSoonModal onClose={() => setShowMetaModal(false)} />}
    </>
  );
}
