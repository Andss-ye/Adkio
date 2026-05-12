/** Realistic Instagram feed ad mockup — rendered from the agent's generated copy */

const PROFILE_INITIAL = 'A';

type Props = {
  headline: string;
  body: string;
  cta: string;
  brandName?: string;
};

export default function InstagramAdPreview({ headline, body, cta, brandName = 'AcademiaEjecutiva' }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] uppercase tracking-widest text-white/40 px-0.5">
        Vista previa · Instagram
      </p>

      {/* Phone frame */}
      <div
        className="relative mx-auto"
        style={{ width: '100%', maxWidth: 240 }}
      >
        {/* Card */}
        <div
          className="rounded-xl overflow-hidden border border-white/10"
          style={{ background: '#fff', color: '#000' }}
        >
          {/* Post header */}
          <div className="flex items-center gap-2 px-2.5 py-2">
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #00d2ff, #0B2551)', color: '#fff' }}
            >
              {PROFILE_INITIAL}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: '#111' }}>
                {brandName}
              </p>
              <p className="text-[9px]" style={{ color: '#666' }}>
                Publicidad
              </p>
            </div>
            {/* Three dots */}
            <div className="flex flex-col gap-[2px] px-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-[3px] h-[3px] rounded-full" style={{ background: '#555' }} />
              ))}
            </div>
          </div>

          {/* Image area — gradient placeholder with headline overlaid */}
          <div
            className="relative flex items-end justify-start px-3 pb-3"
            style={{
              height: 120,
              background: 'linear-gradient(135deg, #0B2551 0%, #091020 60%, #00d2ff20 100%)',
            }}
          >
            {/* Subtle grid pattern */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg,transparent,transparent 15px,rgba(255,255,255,0.3) 15px,rgba(255,255,255,0.3) 16px),repeating-linear-gradient(90deg,transparent,transparent 15px,rgba(255,255,255,0.3) 15px,rgba(255,255,255,0.3) 16px)',
              }}
            />
            <p
              className="relative text-sm font-bold leading-tight text-white z-10"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)', maxWidth: '90%' }}
            >
              {headline}
            </p>
          </div>

          {/* Ad body */}
          <div className="px-2.5 py-2">
            <p className="text-[10px] leading-relaxed" style={{ color: '#333' }}>
              {body.length > 90 ? body.slice(0, 88) + '…' : body}
            </p>

            {/* CTA button */}
            <button
              className="mt-2 w-full text-center text-[11px] font-semibold py-1.5 rounded-md transition-opacity"
              style={{ background: '#0B2551', color: '#fff' }}
            >
              {cta}
            </button>
          </div>

          {/* Instagram actions bar */}
          <div
            className="flex items-center gap-3 px-2.5 py-2 border-t"
            style={{ borderColor: '#f0f0f0' }}
          >
            {/* Heart */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.8" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {/* Comment */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.8" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {/* Send */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.8" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <div className="ml-auto">
              {/* Bookmark */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.8" strokeLinecap="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* "Sponsored" badge */}
        <div className="mt-1 flex justify-end">
          <span className="text-[9px] text-white/25 tracking-widest uppercase">Sponsored · Meta Ads</span>
        </div>
      </div>
    </div>
  );
}
