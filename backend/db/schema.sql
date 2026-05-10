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
