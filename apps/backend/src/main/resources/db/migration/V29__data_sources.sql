CREATE TABLE data_sources (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    kind VARCHAR(16) NOT NULL,
    endpoint VARCHAR(1000) NOT NULL,
    tool_name VARCHAR(200),
    items_path VARCHAR(200),
    auth_type VARCHAR(16) NOT NULL DEFAULT 'NONE',
    auth_header_name VARCHAR(120),
    auth_username VARCHAR(200),
    secret_encrypted TEXT,
    key_column VARCHAR(200),
    column_map JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE data_source_mappings (
    id UUID PRIMARY KEY,
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    application_id VARCHAR(128) NOT NULL,
    source_key VARCHAR(500),
    no_match BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (source_id, application_id)
);
