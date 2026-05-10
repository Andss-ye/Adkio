import type { ComponentType } from 'react';
import {
  Sparkles,
  Inbox,
  Star,
  Send,
  FileText,
  Archive,
  Search,
  Forward,
  MoreHorizontal,
} from '../ui/Icons';

type IconCmp = ComponentType<{ className?: string; color?: string }>;

type NavItem = {
  Icon: IconCmp;
  label: string;
  count?: number | null;
  active?: boolean;
};

const campaigns = [
  {
    name: 'Sale de Verano — Lookalike',
    prompt: 'Empujá nuestro sale de verano a LAL de compradores, $200/día, AR',
    perf: 'ROAS 4.8x',
    time: 'En vivo',
    unread: true,
    active: true,
    platform: 'Meta',
  },
  {
    name: 'Leads — SaaS Q3',
    prompt: 'Conseguir registros a demo de founders LATAM, $150/día, retargeting',
    perf: 'CPL $11',
    time: 'En vivo',
    unread: true,
    platform: 'Meta',
  },
  {
    name: 'Nuevo producto — Drop 04',
    prompt: 'Anticipá nuestro drop a fashion-forward 18–28 en MX y AR',
    perf: 'CTR 2.4%',
    time: 'Hace 2h',
    platform: 'Meta',
  },
  {
    name: 'Black Friday — Teaser',
    prompt: 'Construí awareness para el BF sale, audiencia amplia, video first',
    perf: 'CPM $6.20',
    time: 'Ayer',
    platform: 'Meta',
  },
  {
    name: 'Crecer newsletter',
    prompt: 'Más suscriptores — lectores de blogs de tech, lead form ads',
    perf: 'CPL $2.80',
    time: 'Lun',
    platform: 'Meta',
  },
  {
    name: 'Instalaciones — Android',
    prompt: 'Generá installs en MX y BR, optimización por valor',
    perf: 'CPI $0.42',
    time: 'Lun',
    platform: 'Meta',
  },
];

const nav: NavItem[] = [
  { Icon: Sparkles, label: 'Generar', count: null, active: true },
  { Icon: Inbox, label: 'Campañas', count: 14 },
  { Icon: Star, label: 'Guardadas', count: 5 },
  { Icon: Send, label: 'Activas', count: 8 },
  { Icon: FileText, label: 'Borradores', count: 3 },
  { Icon: Archive, label: 'Archivo' },
];

const statusLabels = [
  { name: 'Activa', color: '#10b981' },
  { name: 'Pausada', color: '#f59e0b' },
  { name: 'Borrador', color: '#A4F4FD' },
  { name: 'Revisión', color: '#00d2ff' },
];

export default function Inboxes() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
      <div
        className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0e1014]/90 backdrop-blur-2xl opacity-0 animate-aura-rise"
        style={{ animationDelay: '1.1s' }}
      >
        {/* Window chrome */}
        <div className="h-9 flex items-center px-4 border-b border-white/10 bg-black/30 relative">
          <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 text-xs text-white/50">
            Adkio — Workspace de campañas
          </div>
        </div>

        <div className="grid grid-cols-12 h-[560px]">
          {/* Sidebar */}
          <aside className="col-span-3 border-r border-white/10 bg-black/30 p-4 flex flex-col gap-4 overflow-hidden">
            <button className="rounded-lg bg-white text-black text-xs font-semibold px-3 py-2 inline-flex items-center justify-center gap-2 hover:bg-white/90">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nueva campaña</span>
            </button>
            <nav className="flex flex-col gap-0.5">
              {nav.map(({ Icon: I, label, count, active }) => (
                <button
                  key={label}
                  className={
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs ' +
                    (active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5')
                  }
                >
                  <I className="w-3.5 h-3.5" />
                  <span className="flex-1 text-left">{label}</span>
                  {count !== null && count !== undefined && (
                    <span className="text-[10px] text-white/40">{count}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-widest text-white/30 px-2.5 mb-2">
                Estado
              </div>
              <div className="flex flex-col gap-0.5">
                {statusLabels.map((l) => (
                  <div
                    key={l.name}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/5 rounded-md cursor-pointer"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    <span>{l.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
                Gasto hoy
              </div>
              <div className="text-lg font-semibold text-white">
                $1,284.<span className="text-white/40 text-sm">12</span>
              </div>
              <div className="text-[10px] text-[#10b981] mt-0.5">▲ 3.6x ROAS</div>
            </div>
          </aside>

          {/* Campaign list */}
          <div className="col-span-4 border-r border-white/10 flex flex-col">
            <div className="h-10 border-b border-white/10 flex items-center gap-2 px-3 text-xs text-white/40">
              <Search className="w-3.5 h-3.5" />
              <span>Buscar campañas o prompts</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {campaigns.map((m, i) => (
                <div
                  key={i}
                  className={
                    'px-4 py-3 border-b border-white/5 cursor-pointer text-xs ' +
                    (m.active ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.unread && (
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: '#00d2ff' }}
                        />
                      )}
                      <span
                        className={
                          'truncate ' +
                          (m.unread ? 'text-white font-semibold' : 'text-white/70')
                        }
                      >
                        {m.name}
                      </span>
                    </div>
                    <span className="text-white/40 text-[10px] flex-shrink-0">{m.time}</span>
                  </div>
                  <div
                    className={
                      'mt-1 truncate ' + (m.unread ? 'text-white/85' : 'text-white/55')
                    }
                  >
                    <span className="text-white/35">"</span>
                    {m.prompt}
                    <span className="text-white/35">"</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/55">
                      {m.platform}
                    </span>
                    <span className="text-[10px] text-[#10b981]">{m.perf}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="col-span-5 flex flex-col">
            <div className="h-10 border-b border-white/10 flex items-center justify-between px-3">
              <div className="flex items-center gap-1 text-white/60">
                <button className="px-2 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="w-3 h-3" /> Refinar
                </button>
                <button className="px-2 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px]">
                  <Forward className="w-3 h-3" /> Duplicar
                </button>
                <button className="px-2 h-7 rounded-md hover:bg-white/5 flex items-center gap-1.5 text-[11px]">
                  <Archive className="w-3 h-3" /> Pausar
                </button>
              </div>
              <button className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center text-white/60">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm text-white/80">
              <h3 className="text-lg font-semibold text-white tracking-tight">
                Sale de Verano — Lookalike
              </h3>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-white/55">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> En vivo
                </span>
                <span>·</span>
                <span>Lanzada hace 2h</span>
                <span>·</span>
                <span>Meta Ads</span>
              </div>

              {/* Prompt block */}
              <div className="liquid-glass rounded-xl p-3 mt-5">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
                  Prompt
                </div>
                <div className="text-xs text-white/85 leading-[1.5] font-medium">
                  "Empujá nuestro sale de verano a un lookalike 2% de compradores en AR. Presupuesto
                  $200/día, optimizá por compras. Que corra 14 días."
                </div>
              </div>

              {/* AI breakdown */}
              <div className="liquid-glass rounded-xl p-3 mt-3 flex items-start gap-3">
                <Sparkles className="w-3.5 h-3.5 mt-0.5" color="#A4F4FD" />
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-widest text-white/50 mb-1">
                    Generado por Adkio
                  </div>
                  <div className="text-xs text-white/85 leading-[1.55]">
                    3 audiencias, 4 variantes creativas, presupuesto diario $200 sobre Meta Ads.
                    ROAS estimado 4.6x.
                  </div>
                </div>
              </div>

              {/* Audience + budget */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="liquid-glass rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/40">
                    Audiencia
                  </div>
                  <div className="text-xs text-white mt-1 font-medium">LAL 2% · AR</div>
                  <div className="text-[10px] text-white/50 mt-0.5">Alcance 2.4M · CPM est. $7</div>
                </div>
                <div className="liquid-glass rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/40">
                    Presupuesto
                  </div>
                  <div className="text-xs text-white mt-1 font-medium">$200 / día</div>
                  <div className="text-[10px] text-white/50 mt-0.5">14 días · Total $2,800</div>
                </div>
              </div>

              {/* Creative previews */}
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                  Variantes creativas
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['#00d2ff', '#A4F4FD', '#0B2551'].map((c, i) => (
                    <div
                      key={i}
                      className="aspect-[9/12] rounded-lg overflow-hidden border border-white/10 relative"
                      style={{ background: `linear-gradient(160deg, ${c}, #0B2551)` }}
                    >
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                        <div className="text-[9px] font-semibold text-white leading-tight">
                          {
                            [
                              'Vuelve el verano. Y 40% off.',
                              'Un swipe. Después, verano.',
                              'Llevá menos. Comprá mejor.',
                            ][i]
                          }
                        </div>
                        <div className="text-[8px] text-white/65 mt-0.5">Comprar ahora ›</div>
                      </div>
                      <div className="absolute top-1.5 left-1.5 text-[8px] font-semibold text-white/85 bg-black/40 backdrop-blur px-1.5 py-0.5 rounded">
                        v{i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
