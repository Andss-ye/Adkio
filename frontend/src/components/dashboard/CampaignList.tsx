import { Search, Filter } from '@/components/ui/Icons';
import { STATUS_COLORS, type Campaign, type CampaignStatus } from '@/lib/dashboard-data';
import CampaignCard from './CampaignCard';

const VIEW_LABELS: Record<string, string> = {
  campañas: 'Todas las campañas',
  guardadas: 'Guardadas',
  activas: 'Activas',
  borradores: 'Borradores',
  archivo: 'Archivo',
};

type Props = {
  filtered: Campaign[];
  selectedId: string;
  search: string;
  statusFilter: CampaignStatus | null;
  view: string;
  savedMap: Record<string, boolean>;
  isLoading?: boolean;
  onSelect: (id: string) => void;
  onSearchChange: (v: string) => void;
  onSearchClear: () => void;
};

export default function CampaignList({ filtered, selectedId, search, statusFilter, view, savedMap, isLoading, onSelect, onSearchChange, onSearchClear }: Props) {
  return (
    <div className="border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-md min-w-0 min-h-0 overflow-hidden">
      {/* Search */}
      <div className="h-12 border-b border-white/10 flex items-center gap-2 px-4 flex-shrink-0">
        <Search className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar campañas o prompts"
          className="flex-1 bg-transparent text-xs text-white placeholder:text-white/35 outline-none min-w-0"
        />
        {search && (
          <button onClick={onSearchClear} className="text-[10px] text-white/40 hover:text-white/70">
            Limpiar
          </button>
        )}
      </div>

      {/* Title row */}
      <div className="h-9 border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] text-white/70 font-medium truncate">{VIEW_LABELS[view] ?? view}</span>
          <span className="text-[10px] text-white/35 tabular-nums">{filtered.length}</span>
          {statusFilter && (
            <span
              className="ml-1 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/10 inline-flex items-center gap-1"
              style={{ color: STATUS_COLORS[statusFilter] }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[statusFilter] }} />
              {statusFilter}
            </span>
          )}
        </div>
        <button className="text-white/40 hover:text-white/70 transition-colors" title="Filtros">
          <Filter className="w-3 h-3" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto dark-scroll">
        {isLoading && (
          <div className="flex flex-col gap-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-white/5 animate-pulse">
                <div className="flex justify-between mb-2">
                  <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
                  <div className="h-3 w-8 rounded bg-white/[0.04]" />
                </div>
                <div className="h-2.5 w-4/5 rounded bg-white/[0.04] mb-2" />
                <div className="flex gap-2">
                  <div className="h-2 w-8 rounded bg-white/[0.04]" />
                  <div className="h-2 w-12 rounded bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center">
              <Search className="w-4 h-4 text-white/25" />
            </div>
            <p className="text-xs text-white/35 leading-relaxed">
              Nada por acá todavía.
              <br />
              Probá otra búsqueda o cambiá la vista.
            </p>
          </div>
        )}
        {!isLoading && filtered.map((m) => (
          <CampaignCard
            key={m.id}
            campaign={m}
            isSelected={m.id === selectedId}
            isSaved={!!savedMap[m.id]}
            onClick={() => onSelect(m.id)}
          />
        ))}
      </div>
    </div>
  );
}
