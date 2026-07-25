ALTER TABLE graph_snapshots
    ADD COLUMN IF NOT EXISTS hidden_application_ids JSONB NOT NULL DEFAULT '[]';

