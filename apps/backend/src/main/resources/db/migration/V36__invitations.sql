-- An admin's emailed invitation to join their workspace.
CREATE TABLE invitations (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    invited_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_workspace ON invitations (workspace_id);
CREATE UNIQUE INDEX uq_invitations_pending_email
    ON invitations (workspace_id, LOWER(email)) WHERE accepted_at IS NULL;
