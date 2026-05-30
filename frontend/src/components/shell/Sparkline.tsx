type Props = {
  data: number[];
  trend: 'up' | 'down';
  width?: number;
  height?: number;
};

/**
 * Lightweight inline sparkline — no chart library.
 * Renders the line + a soft area fill underneath, color reflecting trend.
 */
export default function Sparkline({ data, trend, width = 240, height = 48 }: Props) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return [x, y] as const;
  });
  const path = points.map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `L${x} ${y}`)).join(' ');
  const area = `${path} L${width} ${height} L0 ${height} Z`;
  const stroke = trend === 'up' ? '#7CD992' : '#E97A7A';
  const gradId = `sparkg-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.6" />
    </svg>
  );
}
