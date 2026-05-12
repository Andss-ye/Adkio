/**
 * "Built at GTM Hackathon" section — credibility strip with sponsors.
 * Positioned just before the Footer.
 */
export default function HackathonBadge() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-10 border-t border-white/[0.06]">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Built in label */}
        <div className="flex items-center gap-3 text-white/35 text-xs">
          <div className="h-px w-12 bg-white/10" />
          <span className="uppercase tracking-widest">Built in 36h at</span>
          <div className="h-px w-12 bg-white/10" />
        </div>

        {/* GTM Hackathon text + sponsors */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {/* GTM Hackathon name — en texto para evitar el SVG negro */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg font-bold text-white/85 tracking-tight leading-none">
              The GTM
            </span>
            <span
              className="text-lg font-bold tracking-tight leading-none"
              style={{ color: '#00D4A8' }}
            >
              Hackathon
            </span>
            <span className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">
              Bogotá · 2026
            </span>
          </div>

          <div className="w-px h-10 bg-white/10 hidden md:block" />

          <div className="flex items-center gap-1.5 text-[10px] text-white/30 uppercase tracking-widest">
            Supported by
          </div>

          {/* Sponsor logos */}
          <div className="flex items-center gap-6 md:gap-8">
            <img src="/logo-30x.svg" alt="30X" className="h-9 opacity-65 hover:opacity-95 transition-opacity" style={{ filter: 'brightness(1.3)' }} />
            <img src="/logo-makers.png" alt="Makers" className="h-9 opacity-65 hover:opacity-95 transition-opacity" style={{ filter: 'brightness(1.4) contrast(1.1)' }} />
            <img src="/logo-latambuilds.png" alt="Latam Builds" className="h-9 opacity-65 hover:opacity-95 transition-opacity" style={{ filter: 'brightness(1.4) contrast(1.1)' }} />
          </div>
        </div>
      </div>
    </section>
  );
}
