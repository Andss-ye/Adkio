-- ────────────────────────────────────────────────────────────────────────────
-- Adkio · Migración 006: campaign_metrics (grano diario)
-- Pegar en: https://supabase.com/dashboard/project/aphrujuaklsytbnhcthm/sql/new
-- ────────────────────────────────────────────────────────────────────────────
--
-- Problema: get_campaign() consulta impresiones/clics/gasto en las plataformas
-- y descarta el resultado. Sin persistencia no hay dashboard (ADK-15) ni
-- ingesta diaria (ADK-16).
--
-- Fix: tabla campaign_metrics con unicidad diaria por tenant + plataforma +
-- campaña. account_id es obligatorio. Sin FK a campaigns (esa tabla no está
-- en schema.sql). clicks puede quedar en 0 hasta que ADK-16 lo pida a las
-- plataformas. Reaplicar este archivo no errora (IF NOT EXISTS).

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS campaign_metrics (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    brand_id        TEXT,
    platform        TEXT          NOT NULL
                                  CHECK (platform IN ('meta', 'tiktok', 'google_ads')),
    campaign_id     TEXT          NOT NULL,
    metric_date     DATE          NOT NULL,                 -- día UTC
    impressions     INTEGER       NOT NULL DEFAULT 0,
    reach           INTEGER       NOT NULL DEFAULT 0,
    clicks          INTEGER       NOT NULL DEFAULT 0,
    spend_usd       NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT campaign_metrics_account_platform_campaign_date_key
        UNIQUE (account_id, platform, campaign_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_account_campaign_date
    ON campaign_metrics (account_id, campaign_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_account_date
    ON campaign_metrics (account_id, metric_date DESC);

DROP TRIGGER IF EXISTS campaign_metrics_updated_at ON campaign_metrics;
CREATE TRIGGER campaign_metrics_updated_at
    BEFORE UPDATE ON campaign_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Verificación
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='campaign_metrics';
-- SELECT * FROM campaign_metrics LIMIT 0;
