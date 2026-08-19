-- ────────────────────────────────────────────────────────────────────────────
-- Adkio · Migración 006: platform_assets
-- Pegar en: https://supabase.com/dashboard/project/aphrujuaklsytbnhcthm/sql/new
-- ────────────────────────────────────────────────────────────────────────────
--
-- Una credencial OAuth da acceso a N ad accounts, N páginas y N cuentas de
-- Instagram, pero hoy la conexión aplasta todo eso en un solo
-- `provider_account_id` más lo que quepa en `extra_jsonb`. El resultado es que
-- el cliente publica desde la página de Adkio (`META_PAGE_ID` del .env) y sobre
-- la primera ad account que devuelva Graph.
--
-- Esta tabla guarda cada asset como una fila y marca cuál eligió el cliente.

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

-- RLS — mismo criterio que platform_connections: el service role la bypassa, la
-- tenancy real vive en el WHERE del resolver. Acá es defensa en profundidad.
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


-- ─── Backfill de las conexiones ya existentes ───────────────────────────────
-- Sin esto, una cuenta conectada antes de esta migración queda sin ningún asset
-- y el picker le aparece vacío. Los tres INSERT son idempotentes.
-- El orden importa: el array marca como elegida la ad account que ya estaba en
-- uso, y el segundo INSERT sólo cubre a las conexiones manuales, que no tienen
-- `available_ad_accounts`.

INSERT INTO platform_assets (connection_id, asset_type, external_id, name, is_selected)
SELECT c.id,
       'ad_account',
       a->>'id',
       a->>'name',
       (a->>'id') = c.provider_account_id
FROM platform_connections c,
     LATERAL jsonb_array_elements(
         COALESCE(c.extra_jsonb->'available_ad_accounts', '[]'::jsonb)
     ) AS a
WHERE COALESCE(a->>'id', '') <> ''
ON CONFLICT (connection_id, asset_type, external_id) DO NOTHING;

INSERT INTO platform_assets (connection_id, asset_type, external_id, is_selected)
SELECT c.id, 'ad_account', c.provider_account_id, TRUE
FROM platform_connections c
WHERE COALESCE(c.provider_account_id, '') <> ''
ON CONFLICT (connection_id, asset_type, external_id) DO NOTHING;

INSERT INTO platform_assets (connection_id, asset_type, external_id, is_selected)
SELECT c.id, 'page', c.extra_jsonb->>'page_id', TRUE
FROM platform_connections c
WHERE c.platform = 'meta'
  AND COALESCE(c.extra_jsonb->>'page_id', '') <> ''
ON CONFLICT (connection_id, asset_type, external_id) DO NOTHING;


-- Verificación
-- SELECT c.platform, a.asset_type, a.external_id, a.is_selected
--   FROM platform_assets a JOIN platform_connections c ON c.id = a.connection_id
--   ORDER BY c.platform, a.asset_type;
