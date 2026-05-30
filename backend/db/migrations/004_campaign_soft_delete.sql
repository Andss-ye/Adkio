-- ────────────────────────────────────────────────────────────────────────────
-- Adkio · Migración 004: borrado lógico de campañas
-- Pegar en: https://supabase.com/dashboard/project/aphrujuaklsytbnhcthm/sql/new
-- ────────────────────────────────────────────────────────────────────────────
--
-- Hasta ahora DELETE /campaigns/{id} hacía hard-delete (la fila desaparecía).
-- Para la demo y para no perder historial, pasamos a borrado lógico: marcamos
-- `deleted_at` y filtramos en el listado. El estado activo/pausado ya vive en
-- la columna `status` (PAUSED/ACTIVE), que el front mapea a Activa/Pausada.

ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_campaigns_deleted_at
    ON campaigns (deleted_at);

-- Verificación
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='campaigns' AND column_name='deleted_at';
