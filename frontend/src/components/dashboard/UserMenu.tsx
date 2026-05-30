import { useEffect, useRef, useState } from 'react';
import type { Account } from '@/lib/auth';
import { logout } from '@/lib/auth';

type Props = {
  logged: boolean;
  account: Account | null;
  onLogout: () => void;
  onOpenSettings: () => void;
};

export default function UserMenu({ logged, account, onLogout, onOpenSettings }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown clickeando afuera o con ESC
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!logged) {
    return (
      <a
        href="/login"
        className="text-[11px] font-medium px-3 py-1.5 rounded-md border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
      >
        Iniciar sesión
      </a>
    );
  }

  const initial = (account?.email ?? 'A')[0].toUpperCase();
  const emailDisplay = account?.email
    ? account.email.length > 22
      ? account.email.slice(0, 20) + '…'
      : account.email
    : 'cuenta';

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-white/[0.10] hover:border-white/25 hover:bg-white/[0.04] transition-all"
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-black"
          style={{ background: 'linear-gradient(135deg, #A4F4FD, #00d2ff)' }}
        >
          {initial}
        </span>
        <span className="hidden sm:inline text-[11px] text-white/75 font-medium">{emailDisplay}</span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/40">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-white/10 bg-[#0e1117] shadow-2xl overflow-hidden z-50"
          style={{ background: 'linear-gradient(180deg, #131820 0%, #0e1117 100%)' }}
        >
          <div className="px-3 py-2.5 border-b border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-widest text-white/35 mb-0.5">Cuenta</div>
            <div className="text-xs text-white truncate" title={account?.email}>{account?.email}</div>
            <div className="text-[10px] text-white/40 mt-1 inline-flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
              Plan <span className="text-white/65 capitalize">{account?.plan}</span>
            </div>
          </div>

          <MenuItem
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            }
          >
            Conexiones y cuenta
          </MenuItem>

          <MenuItem
            onClick={() => {
              setOpen(false);
              window.location.href = '/app';
            }}
            icon={<span className="text-[#A4F4FD]">✦</span>}
          >
            Nueva campaña
          </MenuItem>

          <div className="border-t border-white/[0.06]" />

          <MenuItem
            onClick={() => {
              if (confirm('¿Cerrar sesión?')) {
                logout();
                onLogout();
                window.location.href = '/';
              }
            }}
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            }
            destructive
          >
            Cerrar sesión
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  destructive,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left ${
        destructive ? 'text-red-300/85 hover:bg-red-500/10' : 'text-white/75 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      <span className="w-4 flex items-center justify-center flex-shrink-0">{icon}</span>
      <span className="flex-1">{children}</span>
    </button>
  );
}
