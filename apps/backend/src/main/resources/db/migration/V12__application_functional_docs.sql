-- AI-generated functional documentation for Application nodes (GitHub-linked).
CREATE TABLE application_functional_docs (
    id UUID PRIMARY KEY,
    application_id VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL,
    locale VARCHAR(16) NOT NULL DEFAULT 'en',
    payload JSONB NULL,
    markdown_cache TEXT NULL,
    source_repo VARCHAR(255) NULL,
    analyzed_files JSONB NOT NULL DEFAULT '[]',
    error_message TEXT NULL,
    generated_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_application_functional_docs_status
        CHECK (status IN ('PENDING', 'READY', 'FAILED'))
);

CREATE INDEX idx_application_functional_docs_status
    ON application_functional_docs (status);
