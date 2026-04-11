-- ============================================================
-- ASM — Esquema inicial de base de datos
-- Ejecutado automáticamente al iniciar el contenedor PostgreSQL
-- ============================================================

CREATE TABLE IF NOT EXISTS app_users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(64) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    role        VARCHAR(16) NOT NULL DEFAULT 'user',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
    id              SERIAL PRIMARY KEY,
    domain          VARCHAR(255) NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'pending',
    -- pending | running | completed | failed
    user_id         INTEGER REFERENCES app_users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at    TIMESTAMP WITH TIME ZONE,
    csv_path        TEXT,
    error_message   TEXT
);

CREATE TABLE IF NOT EXISTS reports (
    id          SERIAL PRIMARY KEY,
    scan_id     INTEGER REFERENCES scans(id),
    format      VARCHAR(16) NOT NULL,   -- 'docx' | 'pdf'
    path        TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_scans_domain ON scans(domain);
CREATE INDEX IF NOT EXISTS idx_scans_user   ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
