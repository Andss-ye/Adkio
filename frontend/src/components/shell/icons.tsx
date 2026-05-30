import type { SVGProps } from 'react';

type IProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IcDashboard = (p: IProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const IcList = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const IcActive = (p: IProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <circle cx="12" cy="12" r="8" />
  </svg>
);

export const IcDraft = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M14 4v5h5" />
  </svg>
);

export const IcSaved = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M6 4h12v17l-6-3-6 3V4z" />
  </svg>
);

export const IcPlus = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IcConnections = (p: IProps) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="12" r="3" />
    <path d="M9 12h6" />
  </svg>
);

export const IcInsights = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M4 19l4-8 5 5 7-12" />
  </svg>
);

export const IcReports = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M5 4h14v16H5z" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </svg>
);

export const IcSupport = (p: IProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1.1-1.5 2.4" />
    <circle cx="12" cy="17" r=".8" fill="currentColor" />
  </svg>
);

export const IcChevronLeft = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IcChevronRight = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IcChevronDown = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IcHome = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M3 12l9-8 9 8v8a1 1 0 0 1-1 1h-4v-6h-8v6H4a1 1 0 0 1-1-1v-8z" />
  </svg>
);

export const IcSearch = (p: IProps) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IcBell = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M6 8a6 6 0 1 1 12 0v5l2 3H4l2-3V8z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const IcUser = (p: IProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
);

export const IcSettings = (p: IProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.6A7 7 0 0 0 7.4 6.8l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.6a7 7 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.5A7 7 0 0 0 19 12z" />
  </svg>
);

export const IcLogout = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M10 5H5v14h5" />
    <path d="m15 8 4 4-4 4" />
    <path d="M19 12H9" />
  </svg>
);

export const IcKebab = (p: IProps) => (
  <svg {...p} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
);

export const IcUp = (p: IProps) => (
  <svg {...base} {...p} strokeWidth={2.5}>
    <path d="m6 14 6-6 6 6" />
  </svg>
);

export const IcDown = (p: IProps) => (
  <svg {...base} {...p} strokeWidth={2.5}>
    <path d="m6 10 6 6 6-6" />
  </svg>
);

export const IcCheck = (p: IProps) => (
  <svg {...base} {...p} strokeWidth={2}>
    <path d="m5 12 5 5L20 7" />
  </svg>
);

export const IcSend = (p: IProps) => (
  <svg {...base} {...p} strokeWidth={2.2}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const IcSparkle = (p: IProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
  </svg>
);

export const IcReset = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export const IcArrowRight = (p: IProps) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export const IcMic = (p: IProps) => (
  <svg {...base} {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const IcClose = (p: IProps) => (
  <svg {...base} {...p} strokeWidth={2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IcMenu = (p: IProps) => (
  <svg {...base} {...p} strokeWidth={1.9}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
