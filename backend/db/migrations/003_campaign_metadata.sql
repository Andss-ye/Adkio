-- ────────────────────────────────────────────────────────────────────────────
-- Adkio · Migración 003: metadata adicional en campaigns
-- Pegar en: https://supabase.com/dashboard/project/aphrujuaklsytbnhcthm/sql/new
-- ────────────────────────────────────────────────────────────────────────────
--
-- Agrega columnas que ya devolvía campaign_launcher pero no se persistían,
-- causando incoherencias en el dashboard:
--
--   - platform: para no hardcodear 'Meta' en el frontend
--   - cpl_min_usd / cpl_max_usd: rango CPL dinámico (no $8-25 fijo)
--   - is_mock: distinguir campañas reales de las simuladas


ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS platform     TEXT,
    ADD COLUMN IF NOT EXISTS cpl_min_usd  NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS cpl_max_usd  NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS is_mock      BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_campaigns_platform
    ON campaigns (platform);


-- Verificación
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='campaigns' AND column_name IN ('platform','cpl_min_usd','cpl_max_usd','is_mock');
