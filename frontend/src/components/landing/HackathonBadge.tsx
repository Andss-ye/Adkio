/**
 * "Built at GTM Hackathon" section — credibility strip with sponsors.
 * Positioned just before the Footer.
 */
export default function HackathonBadge() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 border-t border-white/[0.06]">
      <div className="flex flex-col items-center gap-7 text-center">
        {/* Built in label */}
        <div className="flex items-center gap-3 text-white/35 text-xs">
          <div className="h-px w-16 bg-white/10" />
          <span className="uppercase tracking-widest">Built in 36h at</span>
          <div className="h-px w-16 bg-white/10" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {/* GTM Hackathon — text */}
          <a
            href="https://gtm-hack.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-0.5 hover:opacity-100 opacity-80 transition-opacity"
          >
            <span className="text-xl font-bold text-white/90 tracking-tight leading-none">
              The GTM
            </span>
            <span className="text-xl font-bold tracking-tight leading-none" style={{ color: '#00D4A8' }}>
              Hackathon
            </span>
            <span className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">
              Bogotá · 2026
            </span>
          </a>

          <div className="w-px h-12 bg-white/10 hidden md:block" />

          <span className="text-[11px] text-white/30 uppercase tracking-widest">Supported by</span>

          {/* Sponsors */}
          <div className="flex items-center gap-8 md:gap-10">
            <a
              href="https://30x.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              <img
                src="/logo-30x.svg"
                alt="30X"
                className="h-11"
                style={{ filter: 'brightness(1.3)' }}
              />
            </a>
            <a
              href="https://www.makers.ngo/"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              <img
                src="/logo-makers.png"
                alt="Makers"
                className="h-11"
                style={{ filter: 'brightness(1.5) contrast(1.1)' }}
              />
            </a>
            <a
              href="https://gtm-hack.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              <img
                src="/logo-latambuilds.png"
                alt="Latam Builds"
                className="h-11"
                style={{ filter: 'brightness(1.5) contrast(1.1)' }}
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
