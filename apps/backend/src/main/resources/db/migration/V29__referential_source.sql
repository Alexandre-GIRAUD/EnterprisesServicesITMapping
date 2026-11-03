CREATE TABLE referential_source (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    url_template VARCHAR(2000) NOT NULL,
    header_name VARCHAR(120),
    secret TEXT,
    sample_body TEXT,
    identities JSONB NOT NULL DEFAULT '[]',
    mappings JSONB NOT NULL DEFAULT '[]'
);
