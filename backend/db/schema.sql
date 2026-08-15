-- Schema de Adkio para Supabase
-- Copiar y pegar en el SQL Editor de Supabase → Run
-- https://supabase.com/dashboard/project/_/sql/new

CREATE TABLE IF NOT EXISTS brand_configs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         TEXT        UNIQUE,                        -- "demo-edu-latam", lookup amigable
    negocio_nombre              TEXT        NOT NULL,
    negocio_industria            TEXT        NOT NULL,
    propuesta_de_valor           TEXT        NOT NULL,
    publico_roles               TEXT[]      NOT NULL DEFAULT '{}',
    publico_paises              TEXT[]      NOT NULL DEFAULT '{}',
    publico_edad_min             INTEGER     NOT NULL DEFAULT 18,
    publico_edad_max             INTEGER     NOT NULL DEFAULT 65,
    publico_intereses            TEXT[]      NOT NULL DEFAULT '{}',
    presupuesto_min_campana_usd  NUMERIC(10,2) NOT NULL DEFAULT 0,
    presupuesto_max_campana_usd  NUMERIC(10,2) NOT NULL DEFAULT 0,
    tono_estilo                 TEXT[]      NOT NULL DEFAULT '{}',
    tono_evitar                 TEXT[]      NOT NULL DEFAULT '{}',
    ejemplos_copy_aprobado      TEXT[]      NOT NULL DEFAULT '{}',
    pixel_configurado            BOOLEAN     NOT NULL DEFAULT FALSE,
    metadata                    JSONB       DEFAULT '{}',   -- campos inferidos, notas del onboarding
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brand_configs_updated_at
    BEFORE UPDATE ON brand_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índice para búsqueda por slug (ya cubierto por UNIQUE, pero explícito por claridad)
CREATE INDEX IF NOT EXISTS idx_brand_configs_slug ON brand_configs (slug);

-- ─── Multitenant: accounts ───────────────────────────────────────────────
-- Auth propio (no Supabase Auth) — guardamos password_hash bcrypt y emitimos
-- nuestros propios JWTs con account_id en el payload.
CREATE TABLE IF NOT EXISTS accounts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT        NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    plan            TEXT        NOT NULL DEFAULT 'starter'
                                CHECK (plan IN ('starter', 'growth', 'scale')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts (LOWER(email));

-- ─── Multitenant: platform_connections ───────────────────────────────────
-- Una cuenta Adkio conecta como mucho 1 Meta + 1 TikTok + 1 Google Ads.
-- Tokens (access + refresh) viajan cifrados con Fernet — ver
-- backend/security/token_crypto.py
CREATE TABLE IF NOT EXISTS platform_connections (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    adkio_account_id            UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform                    TEXT        NOT NULL
                                            CHECK (platform IN ('meta', 'tiktok', 'google_ads')),
    provider_account_id         TEXT        NOT NULL,        -- act_XXX | advertiser_id | customer_id
    access_token_encrypted      TEXT        NOT NULL,
    refresh_token_encrypted     TEXT,
    token_expires_at            TIMESTAMPTZ,
    extra_jsonb                 JSONB       NOT NULL DEFAULT '{}',
    scopes                      TEXT[]      NOT NULL DEFAULT '{}',
    connected_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_validated_at           TIMESTAMPTZ,
    UNIQUE (adkio_account_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_platform_connections_account
    ON platform_connections (adkio_account_id);

-- RLS — solo el dueño del account_id ve sus conexiones.
-- IMPORTANTE: cuando el backend usa service_role key, RLS se bypassa. La
-- protección de tenancy real está en el WHERE de DBCredentialResolver. RLS
-- acá es defensa en profundidad para clientes que usen anon key con JWT.
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_owns_connections" ON platform_connections;
CREATE POLICY "tenant_owns_connections"
    ON platform_connections
    FOR ALL
    USING (adkio_account_id::text = (auth.jwt() ->> 'account_id'))
    WITH CHECK (adkio_account_id::text = (auth.jwt() ->> 'account_id'));

-- ─── Campaign metrics (grano diario) ─────────────────────────────────────
-- Una fila por (account_id, platform, campaign_id, metric_date).
-- Sin FK a campaigns: esa tabla no está consolidada en este schema.
-- Tenancy real: el helper filtra por account_id (service role bypassa RLS).
CREATE TABLE IF NOT EXISTS campaign_metrics (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    brand_id        TEXT,
    platform        TEXT          NOT NULL
                                  CHECK (platform IN ('meta', 'tiktok', 'google_ads')),
    campaign_id     TEXT          NOT NULL,
    metric_date     DATE          NOT NULL,
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
