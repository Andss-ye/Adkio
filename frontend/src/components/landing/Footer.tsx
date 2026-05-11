import LogoMark from '../ui/LogoMark';

const team = [
  { name: 'Jonathan', github: 'https://github.com/Jonathanrbt', linkedin: 'https://www.linkedin.com/in/jonathan-romero-b2044a303/' },
  { name: 'Andrew', github: 'https://github.com/Andss-ye', linkedin: 'https://www.linkedin.com/in/andss-ye/' },
  { name: 'Freddy', github: 'https://github.com/FreddyB200', linkedin: 'https://www.linkedin.com/in/freddy-bautista-baquero/' },
  { name: 'Julian', github: 'https://github.com/Julianlamaravilla', linkedin: 'https://www.linkedin.com/in/jarestrepo/' },
];

const links = {
  producto: [
    { label: 'Funciones', href: '#producto' },
    { label: 'Precios', href: '#precios' },
    { label: 'Estado', href: '#' },
  ],
  legal: [
    { label: 'Privacidad', href: '/privacidad' },
    { label: 'Términos', href: '/terminos' },
    { label: 'Seguridad', href: '/seguridad' },
    { label: 'Cookies', href: '/cookies' },
  ],
};

function GithubIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-white/10 overflow-hidden">
      {/* ── Top grid ── */}
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-10 grid grid-cols-12 gap-x-8 gap-y-12">

        {/* Brand block — left */}
        <div className="col-span-12 md:col-span-5">
          <span className="inline-flex items-center gap-2 border border-white/25 rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-[0.18em] uppercase text-white/90">
            <LogoMark className="w-3.5 h-3.5" />
            Adkio
          </span>
          <p className="mt-7 text-[1.9rem] md:text-[2.4rem] font-medium leading-[1.15] tracking-tight text-white max-w-xs">
            Tus Meta Ads,<br />
            desde lenguaje{' '}
            <em className="font-serif" style={{ fontStyle: 'italic' }}>natural.</em>
          </p>
        </div>

        {/* Nav columns — right */}
        <div className="col-span-12 md:col-span-7 grid grid-cols-2 gap-x-8 gap-y-8 md:pt-1">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35 mb-5">Producto</div>
            <ul className="flex flex-col gap-3.5">
              {links.producto.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-[0.95rem] text-white/65 hover:text-white transition-colors">{label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/35 mb-5">Legal</div>
            <ul className="flex flex-col gap-3.5">
              {links.legal.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} className="text-[0.95rem] text-white/65 hover:text-white transition-colors">{label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Wordmark ── */}
      <div
        className="relative select-none pointer-events-none overflow-hidden"
        style={{ height: 'clamp(110px, 16vw, 220px)' }}
      >
        <div
          className="absolute bottom-0 w-full text-center font-serif italic font-bold leading-none tracking-[-0.02em] translate-y-[28%]"
          style={{ fontSize: 'clamp(9rem, 18vw, 22rem)', color: 'rgba(255,255,255,0.88)' }}
        >
          Adkio
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="max-w-6xl mx-auto px-6 py-4 border-t border-white/[0.07] flex items-center justify-between flex-wrap gap-3">
        {/* Left: copyright */}
        <span className="text-xs text-white/30">© 2026 Adkio, Inc. Todos los derechos reservados.</span>

        {/* Center: dev links — tiny, same scale as copyright */}
        <div className="flex items-center gap-4">
          {team.map(({ name, github, linkedin }) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className="text-[11px] text-white/30">{name}</span>
              <a
                href={github || '#'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`GitHub de ${name}`}
                className="text-white/25 hover:text-white/60 transition-colors"
              >
                <GithubIcon />
              </a>
              <a
                href={linkedin || '#'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`LinkedIn de ${name}`}
                className="text-white/25 hover:text-[#A4F4FD]/70 transition-colors"
              >
                <LinkedInIcon />
              </a>
            </div>
          ))}
        </div>

        {/* Right: legal links */}
        <div className="flex items-center gap-4 text-[11px] text-white/30">
          <a href="/privacidad" className="hover:text-white/60 transition-colors">Privacidad</a>
          <a href="/terminos" className="hover:text-white/60 transition-colors">Términos</a>
          <a href="#" className="hover:text-white/60 transition-colors">Estado</a>
        </div>
      </div>
    </footer>
  );
}
