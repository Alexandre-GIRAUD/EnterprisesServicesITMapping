CREATE TABLE shared_custom_tables (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_username VARCHAR(64) NOT NULL,
    name VARCHAR(80) NOT NULL,
    document JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shared_custom_tables_recipient ON shared_custom_tables (recipient_id);
