import { useState, useEffect } from 'react';
import LogoMark from '../ui/LogoMark';
import AppleButton from '../ui/AppleButton';
import { Menu } from '../ui/Icons';
import { isLoggedIn, getAccount, logout } from '@/lib/auth';

const LINKS = [
  { label: 'Producto', href: '#producto' },
  { label: 'Precios', href: '#precios' },
  { label: 'Seguridad', href: '/seguridad' },
];

export default function Navbar() {
  // Auth state — useEffect porque localStorage no es deterministic en SSR
  const [logged, setLogged] = useState(false);
  const [email, setEmail] = useState<string>('');
  useEffect(() => {
    setLogged(isLoggedIn());
    setEmail(getAccount()?.email ?? '');
  }, []);

  return (
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
          {logged ? (
            <>
              <span className="text-xs text-white/45 hidden lg:inline" title={email}>
                {email.length > 24 ? email.slice(0, 22) + '…' : email}
              </span>
              <button
                onClick={() => {
                  logout();
                  window.location.reload();
                }}
                className="text-sm font-medium px-4 py-2 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
              >
                Cerrar sesión
              </button>
              <AppleButton label="Ir al dashboard" href="/dashboard" />
            </>
          ) : (
            <>
              <a
                href="/login"
                className="text-sm font-medium px-4 py-2 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
              >
                Iniciar sesión
              </a>
              <AppleButton label="Empezar gratis" href="/signup" />
            </>
          )}
        </div>
        <button className="md:hidden w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/80">
          <Menu className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
