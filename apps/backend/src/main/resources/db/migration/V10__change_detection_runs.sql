-- Change detection runs produced by GitHub push webhooks (suggestions only; no auto Neo4j write).
CREATE TABLE change_detection_runs (
    id UUID PRIMARY KEY,
    provider VARCHAR(32) NOT NULL DEFAULT 'GITHUB',
    repo_full_name VARCHAR(255) NOT NULL,
    commit_sha VARCHAR(64) NOT NULL,
    branch_ref VARCHAR(255) NOT NULL,
    application_id VARCHAR(128) NULL,
    status VARCHAR(32) NOT NULL,
    truncated BOOLEAN NOT NULL DEFAULT FALSE,
    buckets JSONB NOT NULL DEFAULT '[]',
    files JSONB NOT NULL DEFAULT '[]',
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_change_detection_runs_repo_commit UNIQUE (repo_full_name, commit_sha)
);

CREATE INDEX idx_change_detection_runs_app ON change_detection_runs (application_id);
CREATE INDEX idx_change_detection_runs_status ON change_detection_runs (status);
CREATE INDEX idx_change_detection_runs_created ON change_detection_runs (created_at DESC);

CREATE TABLE change_detection_items (
    id UUID PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES change_detection_runs(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    summary TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]',
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_detection_items_run ON change_detection_items (run_id);
CREATE INDEX idx_change_detection_items_status ON change_detection_items (status);
