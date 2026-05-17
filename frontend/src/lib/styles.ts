import type { CSSProperties } from 'react';

export const gradientStyle: CSSProperties = {
  // Paleta suavizada: los extremos ya no son casi negros (#091020) sino azules
  // medios — el shimmer se nota pero sin el salto brusco oscuro→claro anterior.
  backgroundImage:
    'linear-gradient(to right, #3A6DA8 0%, #6DA8D8 20%, #A4F4FD 40%, #C9F8FF 50%, #A4F4FD 60%, #6DA8D8 80%, #3A6DA8 100%)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  filter: 'url(#c3-noise)',
};

export const monoFont =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'JetBrains Mono', monospace";
