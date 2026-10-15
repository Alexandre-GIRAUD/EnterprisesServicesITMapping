-- Files that justified an AI finding on a node, an edge, or a property.
CREATE TABLE ai_decision_sources (
    id UUID PRIMARY KEY,
    pipeline VARCHAR(64) NOT NULL,
    decision_kind VARCHAR(32) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    field_key VARCHAR(128) NULL,
    repository VARCHAR(255) NOT NULL,
    source_files JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ai_decision_sources_pipeline
        CHECK (pipeline IN ('CONNECTION_SUGGESTION', 'MODULE_SUGGESTION')),
    CONSTRAINT chk_ai_decision_sources_kind
        CHECK (decision_kind IN ('NODE', 'EDGE', 'NODE_PROPERTY', 'EDGE_PROPERTY')),
    CONSTRAINT chk_ai_decision_sources_target
        CHECK (target_type IN ('APPLICATION', 'MODULE', 'EDGE'))
);

CREATE INDEX idx_ai_decision_sources_target_created
    ON ai_decision_sources (target_type, target_id, created_at DESC);
