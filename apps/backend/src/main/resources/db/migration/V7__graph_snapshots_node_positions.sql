ALTER TABLE graph_snapshots
    ADD COLUMN IF NOT EXISTS node_positions JSONB NOT NULL DEFAULT '{}';

