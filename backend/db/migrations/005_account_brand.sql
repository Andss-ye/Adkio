-- ────────────────────────────────────────────────────────────────────────────
-- Adkio · Migración 005: brand por cuenta
-- Pegar en: https://supabase.com/dashboard/project/aphrujuaklsytbnhcthm/sql/new
-- ────────────────────────────────────────────────────────────────────────────
--
-- Cada cuenta Adkio tiene su propia marca (brand_config). Antes el agente usaba
-- siempre 'demo-edu-latam', lo que sesgaba todas las campañas hacia educación
-- ejecutiva. Ahora en signup se provisiona una marca por defecto y el usuario
-- la edita en Settings → Marca.

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brand_configs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_brand_id ON accounts (brand_id);

-- Verificación
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='accounts' AND column_name='brand_id';
