-- Persist EDGE filter selections on graph snapshots (DEPENDS_ON prop values per field key).
ALTER TABLE graph_snapshots
    ADD COLUMN edge_attributes JSONB NOT NULL DEFAULT '{}';
