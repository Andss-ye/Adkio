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

-- ─── Multitenant: platform_assets ────────────────────────────────────────
-- Una credencial da acceso a N ad accounts, N páginas y N cuentas de
-- Instagram. Sin esto el cliente publica desde la página de Adkio y sobre la
-- primera ad account que devuelva Graph. Ver migración 006.
CREATE TABLE IF NOT EXISTS platform_assets (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id       UUID        NOT NULL REFERENCES platform_connections(id) ON DELETE CASCADE,
    asset_type          TEXT        NOT NULL
                                    CHECK (asset_type IN ('ad_account', 'page', 'instagram')),
    external_id         TEXT        NOT NULL,       -- act_XXX | advertiser_id | customer_id | page id | ig user id
    name                TEXT,
    parent_external_id  TEXT,                       -- la cuenta IG cuelga de una página
    is_selected         BOOLEAN     NOT NULL DEFAULT FALSE,
    extra_jsonb         JSONB       NOT NULL DEFAULT '{}',
    discovered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (connection_id, asset_type, external_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_assets_connection
    ON platform_assets (connection_id);

-- Un solo asset elegido por tipo y conexión: el launcher no puede quedar entre
-- dos ad accounts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_assets_selected
    ON platform_assets (connection_id, asset_type)
    WHERE is_selected;

ALTER TABLE platform_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_owns_assets" ON platform_assets;
CREATE POLICY "tenant_owns_assets"
    ON platform_assets
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM platform_connections c
        WHERE c.id = platform_assets.connection_id
          AND c.adkio_account_id::text = (auth.jwt() ->> 'account_id')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM platform_connections c
        WHERE c.id = platform_assets.connection_id
          AND c.adkio_account_id::text = (auth.jwt() ->> 'account_id')
    ));
