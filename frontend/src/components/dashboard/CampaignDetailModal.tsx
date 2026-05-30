import { useEffect } from 'react';
import { IcClose, IcSparkle } from '@/components/shell/icons';
import { Play, Pause, Globe, Users, Calendar } from '@/components/ui/Icons';
import { monoFont } from '@/lib/styles';

export type DetailCampaign = {
  id: string;
  shortId: string;
  name: string;
  platform: 'meta' | 'tiktok' | 'google_ads';
  status: 'Active' | 'Paused' | 'Draft' | 'Review';
  spend: number;
  leads: number;
  cpl: number | null;
  isMock?: boolean;
  raw?: Record<string, unknown>;
};

const PLATFORM_LABEL: Record<string, string> = {
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  google_ads: 'Google Ads',
};

const STATUS_COLOR: Record<string, string> = {
  Active: '#10b981',
  Paused: '#f59e0b',
  Draft: '#6B7280',
  Review: '#A4F4FD',
};

type Props = {
  campaign: DetailCampaign;
  busy: boolean;
  onClose: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
  onRefine: () => void;
};

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v : fallback;
}

export default function CampaignDetailModal({
  campaign,
  busy,
  onClose,
  onTogglePause,
  onDelete,
  onRefine,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const raw = campaign.raw ?? {};
  const isReal = Boolean(campaign.raw);
  const isActive = campaign.status === 'Active';

  const prompt = str(raw.user_prompt);
  const headline = str(raw.copy_headline, campaign.name);
  const body = str(raw.copy_body);
  const cta = str(raw.copy_cta);
  const paises = Array.isArray(raw.paises) ? (raw.paises as string[]) : [];
  const reach = str(raw.estimated_reach);
  const durationDays = Number(raw.duration_days ?? 0);
  const cplMin = raw.cpl_min_usd != null ? Number(raw.cpl_min_usd) : null;
  const cplMax = raw.cpl_max_usd != null ? Number(raw.cpl_max_usd) : null;
  const cplLabel =
    cplMin != null && cplMax != null
      ? `$${Math.round(cplMin)}–$${Math.round(cplMax)}`
      : campaign.cpl != null
        ? `~$${Math.round(campaign.cpl)}`
        : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Card */}
      <div
        role="dialog"
        aria-label={`Detalle de ${campaign.name}`}
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar rounded-2xl border border-white/10 shadow-2xl text-white"
        style={{ background: 'linear-gradient(180deg,#131820 0%,#0e1117 100%)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 h-12 border-b border-white/10 bg-[#131820]/95 backdrop-blur">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[campaign.status] }} />
            <span className="text-sm font-semibold tracking-tight truncate">{campaign.name}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-white/5 text-white/55 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Cerrar"
          >
            <IcClose width={15} height={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {/* Meta row */}
          <div className="flex items-center gap-2 text-[11px] text-white/55 flex-wrap">
            <span
              className="px-1.5 py-0.5 rounded-full"
              style={{
                color: STATUS_COLOR[campaign.status],
                background: `${STATUS_COLOR[campaign.status]}1A`,
                border: `1px solid ${STATUS_COLOR[campaign.status]}40`,
              }}
            >
              {campaign.status}
            </span>
            <span>·</span>
            <span>{PLATFORM_LABEL[campaign.platform] ?? campaign.platform}</span>
            <span>·</span>
            <span style={{ fontFamily: monoFont }} className="text-white/40 text-[10px]">{campaign.shortId}</span>
            {campaign.isMock && (
              <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/25">
                Simulada
              </span>
            )}
          </div>

          {campaign.isMock && (
            <div className="rounded-lg px-3 py-2 text-[11px] text-amber-200/90 bg-amber-500/[0.06] border border-amber-500/20">
              Campaña simulada (sin credenciales de plataforma conectadas). Conectá Meta/TikTok/Google
              en Configuración para lanzarla de verdad.
            </div>
          )}

          {/* Prompt */}
          {prompt && (
            <div className="rounded-xl p-4 border border-white/[0.07] bg-white/[0.015]">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">Prompt original</div>
              <p className="text-sm text-white/85 leading-relaxed">"{prompt}"</p>
            </div>
          )}

          {/* Copy */}
          {(headline || body || cta) && (
            <div className="rounded-xl p-4 border border-white/[0.07] bg-white/[0.015]">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Copy</div>
              <h3 className="text-base font-semibold text-white leading-tight">{headline}</h3>
              {body && <p className="mt-2 text-xs text-white/65 leading-relaxed">{body}</p>}
              {cta && (
                <span className="mt-3 inline-block text-[11px] px-3 py-1 rounded-full border border-white/15 text-white/70">
                  {cta}
                </span>
              )}
            </div>
          )}

          {/* Audience + Budget grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-4 border border-white/[0.07] bg-white/[0.015]">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 mb-2">
                <Users className="w-3 h-3" /> Audiencia
              </div>
              <div className="text-sm text-white font-medium">{paises.length ? paises.join(', ') : 'LATAM'}</div>
              {reach && (
                <div className="mt-1 text-[11px] text-white/50 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {reach}
                </div>
              )}
            </div>
            <div className="rounded-xl p-4 border border-white/[0.07] bg-white/[0.015]">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 mb-2">
                <Calendar className="w-3 h-3" /> Inversión
              </div>
              <div className="text-sm text-white font-medium tabular-nums">${Math.round(campaign.spend).toLocaleString()}</div>
              <div className="mt-1 text-[11px] text-white/50">
                {durationDays > 0 ? `${durationDays} días · ` : ''}CPL {cplLabel}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3 border border-white/[0.07] bg-white/[0.015]">
              <div className="text-[10px] uppercase tracking-widest text-white/40">Leads estimados</div>
              <div className="mt-1 text-lg font-semibold text-white tabular-nums" style={{ fontFamily: monoFont }}>
                ~{campaign.leads}
              </div>
            </div>
            <div className="rounded-xl p-3 border border-white/[0.07] bg-white/[0.015]">
              <div className="text-[10px] uppercase tracking-widest text-white/40">CPL estimado</div>
              <div className="mt-1 text-lg font-semibold text-white tabular-nums" style={{ fontFamily: monoFont }}>
                {cplLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 px-5 py-3 border-t border-white/10 bg-[#0e1117]/95 backdrop-blur flex items-center gap-2">
          <button
            onClick={onRefine}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold text-black bg-white hover:bg-white/90 transition-colors"
          >
            <IcSparkle width={13} height={13} /> Refinar en el chat
          </button>
          {isReal && (
            <>
              <button
                onClick={onTogglePause}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-xs text-white/80 border border-white/10 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40"
              >
                {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isActive ? 'Pausar' : 'Reanudar'}
              </button>
              <button
                onClick={onDelete}
                disabled={busy}
                className="inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs text-red-300 border border-red-500/25 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
