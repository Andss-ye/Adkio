import LogoMark from '../ui/LogoMark';
import { Search } from '../ui/Icons';

const ITEMS = ['Campañas', 'Audiencias', 'Creatividades', 'Métricas', 'Facturación', 'Ayuda'];

export default function MenuBar() {
  return (
    <div
      className="h-10 bg-black/40 backdrop-blur-md border-t border-b border-white/10 opacity-0 animate-aura-fade-up"
      style={{ animationDelay: '0.9s' }}
    >
      <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between text-xs">
        <div className="flex items-center gap-4 text-white/80">
          <LogoMark className="w-3.5 h-3.5" />
          <span className="font-bold text-white">Adkio</span>
          {ITEMS.map((it, i) => (
            <span
              key={it}
              className={
                'text-white/70 ' +
                (i > 3 ? 'hidden md:inline ' : i > 2 ? 'hidden sm:inline ' : '')
              }
            >
              {it}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-white/70">
          <Search className="w-3.5 h-3.5" />
          <span>Mié 6 may · Workspace Acme Co.</span>
        </div>
      </div>
    </div>
  );
}
