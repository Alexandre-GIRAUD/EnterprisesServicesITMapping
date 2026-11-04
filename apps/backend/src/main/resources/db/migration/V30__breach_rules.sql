CREATE TABLE breach_rules (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    subject VARCHAR(16) NOT NULL,
    definition JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX breach_rules_name_unique ON breach_rules (LOWER(name));
