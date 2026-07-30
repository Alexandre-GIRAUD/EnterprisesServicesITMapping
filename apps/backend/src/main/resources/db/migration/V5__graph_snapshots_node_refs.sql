-- Persist NODE_REF filter selections on graph snapshots (catalogue ref ids per field key).
ALTER TABLE graph_snapshots
    ADD COLUMN node_refs JSONB NOT NULL DEFAULT '{}';
