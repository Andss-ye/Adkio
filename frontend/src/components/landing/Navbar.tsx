import LogoMark from '../ui/LogoMark';
import AppleButton from '../ui/AppleButton';
import { Menu } from '../ui/Icons';

const LINKS = [
  { label: 'Producto', href: '#producto' },
  { label: 'Precios', href: '#precios' },
  { label: 'Seguridad', href: '/seguridad' },
];

export default function Navbar() {
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
        <div className="hidden md:block">
          <AppleButton label="Probar Adkio" href="/dashboard" />
        </div>
        <button className="md:hidden w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/80">
          <Menu className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
