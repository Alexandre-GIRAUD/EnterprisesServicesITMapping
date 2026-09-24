-- Functional documentation RAG chunks (pgvector).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE functional_doc_chunks (
    id UUID PRIMARY KEY,
    application_id VARCHAR(128) NOT NULL,
    doc_id UUID NOT NULL,
    section_key VARCHAR(64) NOT NULL,
    section_title VARCHAR(255) NULL,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_functional_doc_chunks_doc_section_idx
        UNIQUE (doc_id, section_key, chunk_index)
);

CREATE INDEX idx_functional_doc_chunks_application_id
    ON functional_doc_chunks (application_id);

CREATE INDEX idx_functional_doc_chunks_doc_id
    ON functional_doc_chunks (doc_id);

-- Cosine distance index for semantic search.
CREATE INDEX idx_functional_doc_chunks_embedding_hnsw
    ON functional_doc_chunks
    USING hnsw (embedding vector_cosine_ops);
