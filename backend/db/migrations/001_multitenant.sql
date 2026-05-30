-- ────────────────────────────────────────────────────────────────────────────
-- Adkio · Migración multi-tenant (T1 + T2 del HANDOFF_MULTITENANT.md)
-- Pegar en: https://supabase.com/dashboard/project/aphrujuaklsytbnhcthm/sql/new
-- Después correr "Run" (Ctrl+Enter)
-- ────────────────────────────────────────────────────────────────────────────


-- ─── T1: accounts ───────────────────────────────────────────────────────────
-- Auth propio (no Supabase Auth). Guardamos password_hash bcrypt y emitimos
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


-- ─── T2: platform_connections ───────────────────────────────────────────────
-- Una cuenta Adkio conecta como mucho 1 Meta + 1 TikTok + 1 Google Ads.
-- Tokens cifrados con Fernet — ver backend/security/token_crypto.py.

CREATE TABLE IF NOT EXISTS platform_connections (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    adkio_account_id            UUID        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform                    TEXT        NOT NULL
                                            CHECK (platform IN ('meta', 'tiktok', 'google_ads')),
    provider_account_id         TEXT        NOT NULL,
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


-- ─── RLS — defensa en profundidad ────────────────────────────────────────
-- Cuando el backend usa service_role key, RLS se bypassa. La protección de
-- tenancy real vive en el WHERE clause de DBCredentialResolver.
-- Esta policy aplica si en el futuro algún cliente usa anon key + JWT directo.

ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_owns_connections" ON platform_connections;

CREATE POLICY "tenant_owns_connections"
    ON platform_connections
    FOR ALL
    USING (adkio_account_id::text = (auth.jwt() ->> 'account_id'))
    WITH CHECK (adkio_account_id::text = (auth.jwt() ->> 'account_id'));


-- ────────────────────────────────────────────────────────────────────────────
-- Verificación rápida — después del Run, esta query debería devolver 2 filas
-- ────────────────────────────────────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name IN ('accounts','platform_connections');
