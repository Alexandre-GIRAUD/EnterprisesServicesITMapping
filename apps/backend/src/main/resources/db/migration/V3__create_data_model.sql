CREATE TABLE data_model (
    id VARCHAR(32) PRIMARY KEY,
    fields JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO data_model (id, fields) VALUES ('default', '[]');
