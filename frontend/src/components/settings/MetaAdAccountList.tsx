import { useEffect, useState } from 'react';
import {
  listMetaAdAccounts,
  selectMetaAdAccount,
  type MetaAdAccount,
} from '@/lib/api';
import { Check } from '@/components/ui/Icons';

/**
 * ADK-23 — Settings: lista y default de ad accounts Meta.
 *
 * Solo ad accounts. Cablea contra `GET/POST /connect/meta/assets` (ADK-14).
 *
 * Pendiente de refactor: extender esta misma lista a `page` e `instagram` con
 * un `is_selected` por tipo (el schema de `platform_assets` ya lo soporta,
 * ver `backend/db/migrations/009_platform_assets.sql`); la UI de Settings
 * hoy solo consume `ad_account`.
 */
export default function MetaAdAccountList() {
  const [accounts, setAccounts] = useState<MetaAdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await listMetaAdAccounts());
    } catch (err) {
      setAccounts([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las ad accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function choose(externalId: string) {
    if (selectingId || accounts.find((a) => a.is_selected)?.external_id === externalId) {
      return;
    }
    const previous = accounts;
    setSelectingId(externalId);
    setError(null);
    setAccounts((current) =>
      current.map((account) => ({
        ...account,
        is_selected: account.external_id === externalId,
      })),
    );
    try {
      await selectMetaAdAccount(externalId);
    } catch (err) {
      setAccounts(previous);
      setError(err instanceof Error ? err.message : 'No se pudo guardar la ad account default.');
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <div className="mt-2 p-4 rounded-xl border border-white/[0.07] bg-white/[0.015] space-y-3">
      <div>
        <span className="block text-[10px] uppercase tracking-widest text-white/45 mb-1">
          Ad accounts
        </span>
        <p className="text-xs text-white/55 leading-relaxed">
          Elegí de qué ad account se van a crear las campañas.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl border bg-red-500/[0.08] border-red-500/25 text-red-100 text-xs">
          <span className="mt-0.5">✕</span>
          <span className="flex-1">{error}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando ad accounts">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {!loading && !error && accounts.length === 0 && (
        <div className="space-y-3">
          <div className="px-3 py-4 text-xs text-white/40 leading-relaxed">
            No hay ad accounts visibles. Conectá Meta o reintentá.
          </div>
          <button
            type="button"
            onClick={load}
            className="text-xs px-3.5 py-2 rounded-lg border border-white/[0.10] text-white/70 hover:text-white hover:border-white/25 hover:bg-white/[0.03] transition-all"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && error && accounts.length === 0 && (
        <button
          type="button"
          onClick={load}
          className="text-xs px-3.5 py-2 rounded-lg border border-white/[0.10] text-white/70 hover:text-white hover:border-white/25 hover:bg-white/[0.03] transition-all"
        >
          Reintentar
        </button>
      )}

      {!loading && accounts.length > 0 && (
        <div role="radiogroup" aria-label="Ad account default" className="space-y-2">
          {accounts.map((account) => {
            const selected = account.is_selected;
            const busy = selectingId === account.external_id;
            return (
              <button
                key={account.external_id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={Boolean(selectingId)}
                onClick={() => choose(account.external_id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all disabled:opacity-40 ${
                  selected
                    ? 'border-emerald-500/20 bg-emerald-500/[0.025]'
                    : 'border-white/[0.07] bg-transparent hover:border-white/15 hover:bg-white/[0.025]'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0 border flex items-center justify-center"
                  style={
                    selected
                      ? {
                          borderColor: 'rgba(16,185,129,0.50)',
                          background: 'rgba(16,185,129,0.15)',
                        }
                      : {
                          borderColor: 'rgba(255,255,255,0.18)',
                          background: 'transparent',
                        }
                  }
                >
                  {busy ? (
                    <span className="w-2 h-2 rounded-full border border-emerald-400/40 border-t-emerald-400 animate-spin" />
                  ) : (
                    selected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium tracking-tight text-white truncate">
                    {account.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11px] text-white/55">
                    <span className="text-white/40">Ad Account:</span>
                    <code className="px-1.5 py-0.5 rounded bg-white/5 text-white/75 font-mono">
                      {account.external_id}
                    </code>
                  </span>
                </span>

                {selected && (
                  <span
                    className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: 'rgba(16,185,129,0.10)',
                      color: '#10b981',
                      border: '1px solid rgba(16,185,129,0.30)',
                    }}
                  >
                    <Check className="w-2.5 h-2.5" />
                    Default
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
