CREATE TABLE shared_sandboxes (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_username VARCHAR(64) NOT NULL,
    name VARCHAR(80) NOT NULL,
    document JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shared_sandboxes_recipient ON shared_sandboxes (recipient_id);
