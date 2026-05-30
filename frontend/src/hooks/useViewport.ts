import { useEffect, useState } from 'react';

export type Bp = 'sm' | 'md' | 'lg' | 'xl';

export type Viewport = {
  width: number;
  height: number;
  bp: Bp;
  /** ≥ 1280: full desktop with expanded sidebar + 3-col workspace */
  isXl: boolean;
  /** 1024-1279: collapsed sidebar, 2-col workspace still ok */
  isLg: boolean;
  /** 768-1023: collapsed sidebar, single-column workspace with tabs */
  isMd: boolean;
  /** < 768: overlay sidebar, mobile UX */
  isSm: boolean;
};

function compute(w: number, h: number): Viewport {
  const isXl = w >= 1280;
  const isLg = w >= 1024 && w < 1280;
  const isMd = w >= 768 && w < 1024;
  const isSm = w < 768;
  const bp: Bp = isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : 'sm';
  return { width: w, height: h, bp, isXl, isLg, isMd, isSm };
}

/**
 * Returns the current viewport size and resolved breakpoint.
 * SSR-safe (defaults to xl on first render before window is available).
 */
export function useViewport(): Viewport {
  const [v, setV] = useState<Viewport>(() => {
    if (typeof window === 'undefined') return compute(1440, 900);
    return compute(window.innerWidth, window.innerHeight);
  });

  useEffect(() => {
    let raf = 0;
    function onResize() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setV(compute(window.innerWidth, window.innerHeight));
      });
    }
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return v;
}
