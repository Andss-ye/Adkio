-- ────────────────────────────────────────────────────────────────────────────
-- Adkio · Migración 002: aislamiento multitenant de campañas
-- Pegar en: https://supabase.com/dashboard/project/aphrujuaklsytbnhcthm/sql/new
-- ────────────────────────────────────────────────────────────────────────────
--
-- Problema: hasta ahora la tabla `campaigns` solo tenía `brand_id`, así que
-- todos los usuarios veían las mismas campañas (compartido por brand_id, no
-- por usuario).
--
-- Fix: agregamos `account_id` opcional (NULL = demo/single-tenant) y
-- filtramos por él en list_campaigns cuando hay JWT en la request.


ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_campaigns_account_id
    ON campaigns (account_id);


-- Verificación rápida — debería devolver 1 fila con account_id en la lista
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='campaigns' AND column_name='account_id';
