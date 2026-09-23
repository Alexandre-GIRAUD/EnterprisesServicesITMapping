-- Attribute-level change history (Data Model NODE/EDGE values) + human override locks (P2 prep).
CREATE TABLE attribute_change_events (
    id UUID PRIMARY KEY,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    field_scope VARCHAR(32) NOT NULL,
    field_key VARCHAR(128) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    actor_type VARCHAR(16) NOT NULL,
    actor_user_id UUID NULL REFERENCES users(id),
    actor_username VARCHAR(64) NULL,
    ai_source VARCHAR(64) NULL,
    human_reason VARCHAR(32) NULL,
    human_reason_comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_attribute_change_events_target_type
        CHECK (target_type IN ('APPLICATION', 'EDGE')),
    CONSTRAINT chk_attribute_change_events_field_scope
        CHECK (field_scope IN ('NODE_ATTR', 'EDGE_ATTR', 'APP_FIELD', 'EDGE_LINK')),
    CONSTRAINT chk_attribute_change_events_actor
        CHECK (actor_type IN ('HUMAN', 'AI'))
);

CREATE INDEX idx_attribute_change_events_target_field_created
    ON attribute_change_events (target_type, target_id, field_key, created_at DESC);

CREATE INDEX idx_attribute_change_events_actor_created
    ON attribute_change_events (actor_type, created_at DESC);

CREATE TABLE human_field_overrides (
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    field_key VARCHAR(128) NOT NULL,
    last_human_event_id UUID NOT NULL REFERENCES attribute_change_events(id),
    protected_value TEXT NULL,
    human_reason VARCHAR(32) NULL,
    human_reason_comment TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (target_type, target_id, field_key),
    CONSTRAINT chk_human_field_overrides_target_type
        CHECK (target_type IN ('APPLICATION', 'EDGE'))
);
