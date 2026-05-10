import type { SVGProps, ReactNode } from 'react';

type IconProps = {
  className?: string;
  color?: string;
  strokeWidth?: number;
};

type BaseProps = {
  children: ReactNode;
  className?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
} & Omit<SVGProps<SVGSVGElement>, 'children'>;

function Base({
  children,
  className = '',
  stroke = 'currentColor',
  fill = 'none',
  strokeWidth = 2,
  ...rest
}: BaseProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ChevronRight = ({ className = '' }: IconProps) => (
  <Base className={className}>
    <polyline points="9 18 15 12 9 6" />
  </Base>
);

export const Menu = ({ className = '' }: IconProps) => (
  <Base className={className}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </Base>
);

export const Search = ({ className = '' }: IconProps) => (
  <Base className={className}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Base>
);

export const Sparkles = ({ className = '', color }: IconProps) => (
  <Base className={className} stroke={color || 'currentColor'}>
    <path d="M12 3l1.9 4.6L18 9.5l-4.1 1.9L12 16l-1.9-4.6L6 9.5l4.1-1.9z" />
    <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" />
    <path d="M5 4l.6 1.4L7 6l-1.4.6L5 8l-.6-1.4L3 6l1.4-.6z" />
  </Base>
);

export const Inbox = ({ className = '' }: IconProps) => (
  <Base className={className}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </Base>
);

export const Star = ({ className = '' }: IconProps) => (
  <Base className={className}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Base>
);

export const Send = ({ className = '' }: IconProps) => (
  <Base className={className}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </Base>
);

export const FileText = ({ className = '' }: IconProps) => (
  <Base className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </Base>
);

export const Archive = ({ className = '' }: IconProps) => (
  <Base className={className}>
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </Base>
);

export const Forward = ({ className = '' }: IconProps) => (
  <Base className={className}>
    <polyline points="15 17 20 12 15 7" />
    <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
  </Base>
);

export const MoreHorizontal = ({ className = '' }: IconProps) => (
  <Base className={className}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </Base>
);

export const Check = ({ className = '' }: IconProps) => (
  <Base className={className} strokeWidth={2.5}>
    <polyline points="20 6 9 17 4 12" />
  </Base>
);
