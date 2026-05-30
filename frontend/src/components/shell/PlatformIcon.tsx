type Platform = 'meta' | 'tiktok' | 'google_ads' | 'google';

type Props = {
  platform: Platform;
  size?: number;
  /** "ticker" = small pill; "card" = featured card 38px; "row" = inside table */
  variant?: 'ticker' | 'card' | 'row';
};

/**
 * Abstract platform marks — branded tone only, no actual logos.
 * Matches the design pack: Meta = filled blue "f", TikTok = music-note glyph
 * with magenta+cyan offset, Google = amber "G".
 */
export default function PlatformIcon({ platform, variant = 'row', size }: Props) {
  const px = size ?? (variant === 'card' ? 38 : variant === 'ticker' ? 16 : 32);
  const radius = variant === 'ticker' ? 5 : variant === 'card' ? 10 : 8;
  const baseStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius: radius,
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: variant === 'card' ? 15 : variant === 'ticker' ? 10 : 13,
    boxShadow: variant === 'card' ? 'inset 0 0 0 1px rgba(255,255,255,.06)' : undefined,
    flex: 'none',
    position: 'relative',
    fontFamily: "'Geist', sans-serif",
  };

  if (platform === 'meta') {
    return (
      <div
        style={{
          ...baseStyle,
          background:
            variant === 'card'
              ? 'linear-gradient(135deg,#5B8DEF,#3a6fd0)'
              : 'var(--meta-tone, #5B8DEF)',
        }}
      >
        f
      </div>
    );
  }
  if (platform === 'tiktok') {
    return (
      <div
        style={{
          ...baseStyle,
          background:
            variant === 'card'
              ? 'linear-gradient(135deg,#1A1B1F,#0E0F11)'
              : '#0E0F11',
          border: variant !== 'card' ? '1px solid #2A2B2F' : undefined,
        }}
      >
        <span
          style={{
            fontSize: variant === 'card' ? 18 : variant === 'ticker' ? 10 : 14,
            lineHeight: 1,
            color: '#fff',
            textShadow:
              variant === 'card'
                ? '1px 0 #E96BA8, -1px 0 #3DD8E0'
                : '.8px 0 #E96BA8, -.8px 0 #3DD8E0',
          }}
        >
          ♪
        </span>
      </div>
    );
  }
  // google_ads / google
  return (
    <div
      style={{
        ...baseStyle,
        background:
          variant === 'card'
            ? 'linear-gradient(135deg,#E8B260,#cf8d3d)'
            : 'var(--google-tone, #E8B260)',
      }}
    >
      G
    </div>
  );
}

export function platformLabel(p: Platform): string {
  if (p === 'meta') return 'Meta';
  if (p === 'tiktok') return 'TikTok';
  return 'Google';
}
