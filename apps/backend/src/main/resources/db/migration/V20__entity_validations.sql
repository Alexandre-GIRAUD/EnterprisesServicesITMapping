-- Latest human sign-off of an application or an edge, one row per target.
CREATE TABLE entity_validations (
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    validated_by_user_id UUID NOT NULL REFERENCES users(id),
    validated_by_username VARCHAR(64) NOT NULL,
    validated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (target_type, target_id),
    CONSTRAINT chk_entity_validations_target_type
        CHECK (target_type IN ('APPLICATION', 'EDGE'))
);
