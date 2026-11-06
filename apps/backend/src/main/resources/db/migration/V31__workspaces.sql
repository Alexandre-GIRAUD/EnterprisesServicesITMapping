CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Holds every user and every piece of data that existed before workspaces.
INSERT INTO workspaces (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Default');

ALTER TABLE users ADD COLUMN workspace_id UUID REFERENCES workspaces(id);
UPDATE users SET workspace_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE users ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX idx_users_workspace ON users (workspace_id);
