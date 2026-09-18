-- Comments on applications or graph edges (DEPENDS_ON / flows). Authors live in Postgres users.
CREATE TABLE entity_comments (
    id UUID PRIMARY KEY,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    author_user_id UUID NOT NULL REFERENCES users(id),
    author_username VARCHAR(64) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_entity_comments_target_type CHECK (target_type IN ('APPLICATION', 'EDGE')),
    CONSTRAINT chk_entity_comments_body_len CHECK (char_length(body) >= 1 AND char_length(body) <= 2000)
);

CREATE INDEX idx_entity_comments_target_created
    ON entity_comments (target_type, target_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_entity_comments_author ON entity_comments (author_user_id);
