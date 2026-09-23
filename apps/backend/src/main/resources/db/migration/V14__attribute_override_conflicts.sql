-- Human vs AI attribute override conflicts (P2) — queued for /admin/changes review.
CREATE TABLE attribute_override_conflicts (
    id UUID PRIMARY KEY,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    field_scope VARCHAR(32) NOT NULL,
    field_key VARCHAR(128) NOT NULL,
    protected_value TEXT NULL,
    proposed_value TEXT NULL,
    ai_source VARCHAR(64) NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ NULL,
    resolved_by_user_id UUID NULL REFERENCES users(id),
    CONSTRAINT chk_override_conflicts_target_type
        CHECK (target_type IN ('APPLICATION', 'EDGE')),
    CONSTRAINT chk_override_conflicts_field_scope
        CHECK (field_scope IN ('NODE_ATTR', 'EDGE_ATTR')),
    CONSTRAINT chk_override_conflicts_status
        CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED'))
);

CREATE INDEX idx_override_conflicts_status_created
    ON attribute_override_conflicts (status, created_at DESC);

CREATE UNIQUE INDEX uq_override_conflicts_pending_field
    ON attribute_override_conflicts (target_type, target_id, field_key)
    WHERE status = 'PENDING';
