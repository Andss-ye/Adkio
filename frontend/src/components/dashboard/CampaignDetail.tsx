import {
  Sparkles, Star, Forward, Pause, Play, Plus, MoreHorizontal,
  Globe, Users, Calendar,
} from '@/components/ui/Icons';
import { STATUS_COLORS, type Campaign } from '@/lib/dashboard-data';
import { monoFont } from '@/lib/styles';
import StatusBadge from './StatusBadge';

type Props = {
  campaign: Campaign;
  isSaved: boolean;
  onToggleSaved: () => void;
  onNew: () => void;
};

export default function CampaignDetail({ campaign, isSaved, onToggleSaved, onNew }: Props) {
  const isLive = campaign.status === 'Activa';

  return (
    <>
      {/* Header */}
      <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-1 text-white/60">
          <button className="px-2.5 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px] transition-colors">
            <Sparkles className="w-3 h-3" />Refinar
          </button>
          <button className="px-2.5 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px] transition-colors">
            <Forward className="w-3 h-3" />Duplicar
          </button>
          {isLive ? (
            <button className="px-2.5 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px] transition-colors">
              <Pause className="w-3 h-3" />Pausar
            </button>
          ) : (
            <button className="px-2.5 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px] transition-colors">
              <Play className="w-3 h-3" />Reanudar
            </button>
          )}
          <button
            onClick={onToggleSaved}
            className={
              'px-2.5 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px] transition-colors ' +
              (isSaved ? 'text-[#A4F4FD]' : 'text-white/60')
            }
          >
            <Star className="w-3 h-3" color={isSaved ? '#A4F4FD' : 'currentColor'} />
            {isSaved ? 'Guardada' : 'Guardar'}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] text-black bg-white hover:bg-white/90 transition-colors font-semibold"
          >
            <Plus className="w-3 h-3" />Nueva
          </button>
          <button className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center text-white/60 transition-colors">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        {/* Title */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-white tracking-tight leading-tight">{campaign.name}</h2>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-white/55 flex-wrap">
              <StatusBadge status={campaign.status} />
              <span>·</span>
              <span>{campaign.liveSince}</span>
              <span>·</span>
              <span>{campaign.platform} Ads</span>
              <span>·</span>
              <span style={{ fontFamily: monoFont }} className="text-white/40 text-[10px]">{campaign.id}</span>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Performance</div>
            <div
              className={
                'text-base font-semibold mt-1 ' +
                (campaign.perfTone === 'good' ? 'text-[#10b981]' : campaign.perfTone === 'warn' ? 'text-[#f59e0b]' : 'text-white/70')
              }
            >
              {campaign.perf}
            </div>
          </div>
        </div>

        {/* Prompt */}
        <div className="liquid-glass rounded-xl p-4 mt-6">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Prompt original</div>
          <div className="text-sm text-white/85 leading-relaxed font-medium">
            <span className="text-white/30">"</span>
            {campaign.prompt}
            <span className="text-white/30">"</span>
          </div>
        </div>

        {/* AI rationale */}
        <div className="liquid-glass rounded-xl p-4 mt-3 flex items-start gap-3">
          <div
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,210,255,0.08)', border: '1px solid rgba(164,244,253,0.30)' }}
          >
            <Sparkles className="w-3.5 h-3.5" color="#A4F4FD" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-white/45 mb-1">Razonamiento de Adkio</div>
            <p className="text-xs text-white/85 leading-relaxed">{campaign.rationale}</p>
          </div>
        </div>

        {/* Metrics */}
        {campaign.metrics && campaign.metrics.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Métricas en vivo</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {campaign.metrics.map((mt) => (
                <div key={mt.label} className="liquid-glass rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/40">{mt.label}</div>
                  <div className="mt-1 text-base font-semibold text-white tabular-nums">{mt.value}</div>
                  {mt.delta && (
                    <div className={'text-[10px] mt-0.5 ' + (mt.good ? 'text-[#10b981]' : 'text-[#f59e0b]')}>
                      ▲ {mt.delta}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audience + Budget */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="liquid-glass rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 mb-2">
              <Users className="w-3 h-3" />Audiencia
            </div>
            <div className="text-sm text-white font-medium">{campaign.audience.label}</div>
            <div className="mt-1 text-[11px] text-white/50 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>Alcance {campaign.audience.reach}</span>
            </div>
          </div>
          <div className="liquid-glass rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40 mb-2">
              <Calendar className="w-3 h-3" />Presupuesto
            </div>
            <div className="text-sm text-white font-medium tabular-nums">
              ${campaign.budget.dia.toFixed(0)} / día
            </div>
            <div className="mt-1 text-[11px] text-white/50">
              {campaign.budget.dias} días · Total ${campaign.budget.total.toLocaleString()}
            </div>
            {/* CPL viene desde campaign.metrics.CPL — el mapper en DashboardPage
                lee cpl_min_usd/cpl_max_usd del backend (dinámico por país+audiencia) */}
            <div className="mt-1 text-[10px] text-white/35">
              CPL: {campaign.metrics?.find((m) => m.label.toLowerCase().includes('cpl'))?.value ?? '—'}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {campaign.warnings && campaign.warnings.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-[#f59e0b]/80 mb-2">Advertencias</div>
            {campaign.warnings.map((w, i) => (
              <div key={i} className="text-[11px] text-[#f59e0b]/90 leading-relaxed flex items-start gap-2">
                <span>·</span><span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
