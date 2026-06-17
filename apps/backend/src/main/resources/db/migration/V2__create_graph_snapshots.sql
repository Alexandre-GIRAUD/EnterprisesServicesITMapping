CREATE TABLE graph_snapshots (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    year INTEGER NULL,
    application_ids JSONB NOT NULL DEFAULT '[]',
    business_unit_ids JSONB NOT NULL DEFAULT '[]',
    region_codes JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_graph_snapshots_user_name UNIQUE (user_id, name)
);

CREATE INDEX idx_graph_snapshots_user_id ON graph_snapshots (user_id);
CREATE INDEX idx_graph_snapshots_user_created ON graph_snapshots (user_id, created_at DESC);
