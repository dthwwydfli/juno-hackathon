-- App database schema (mirrors backend/app/db/models.py).
-- FastAPI connects with the Postgres role (bypasses RLS). No anon/authenticated policies.

CREATE TABLE medications (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    display_name VARCHAR(512) NOT NULL,
    dmd_code VARCHAR(64),
    dmd_code_type VARCHAR(32),
    gtin VARCHAR(32),
    category VARCHAR(32) NOT NULL,
    dosage VARCHAR(256) NOT NULL,
    schedule TEXT NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX ix_medications_user_id ON medications (user_id);

CREATE TABLE interaction_records (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    med_a_id BIGINT NOT NULL REFERENCES medications (id) ON DELETE CASCADE,
    med_b_id BIGINT NOT NULL REFERENCES medications (id) ON DELETE CASCADE,
    severity VARCHAR(32) NOT NULL,
    summary TEXT NOT NULL,
    full_text TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX ix_interaction_records_user_id ON interaction_records (user_id);

CREATE TABLE api_cache_entries (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(32) NOT NULL,
    cache_key VARCHAR(128) NOT NULL,
    payload TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    CONSTRAINT uq_api_cache_entries_cache_key UNIQUE (cache_key)
);

CREATE INDEX ix_api_cache_entries_provider ON api_cache_entries (provider);
CREATE INDEX ix_api_cache_entries_cache_key ON api_cache_entries (cache_key);

CREATE TABLE provider_state (
    provider VARCHAR(32) PRIMARY KEY,
    status VARCHAR(32) NOT NULL DEFAULT 'ok',
    blocked_until TIMESTAMPTZ,
    detail TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE TABLE gp_share_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    patient_label VARCHAR(256),
    snapshot_json TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    CONSTRAINT uq_gp_share_tokens_token UNIQUE (token)
);

CREATE INDEX ix_gp_share_tokens_token ON gp_share_tokens (token);
CREATE INDEX ix_gp_share_tokens_user_id ON gp_share_tokens (user_id);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE gp_share_tokens ENABLE ROW LEVEL SECURITY;
