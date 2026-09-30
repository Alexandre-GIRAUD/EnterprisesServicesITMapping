CREATE TABLE graph_view_folders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID NULL REFERENCES graph_view_folders(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_graph_view_folders_user ON graph_view_folders (user_id);

ALTER TABLE graph_snapshots DROP CONSTRAINT uq_graph_snapshots_user_name;

ALTER TABLE graph_snapshots
    ADD COLUMN folder_id UUID NULL REFERENCES graph_view_folders(id) ON DELETE CASCADE;

CREATE INDEX idx_graph_snapshots_folder ON graph_snapshots (folder_id);

CREATE UNIQUE INDEX uq_graph_snapshots_root_name
    ON graph_snapshots (user_id, lower(name))
    WHERE folder_id IS NULL;

CREATE UNIQUE INDEX uq_graph_snapshots_folder_name
    ON graph_snapshots (user_id, folder_id, lower(name))
    WHERE folder_id IS NOT NULL;

CREATE UNIQUE INDEX uq_graph_view_folders_root_name
    ON graph_view_folders (user_id, lower(name))
    WHERE parent_id IS NULL;

CREATE UNIQUE INDEX uq_graph_view_folders_parent_name
    ON graph_view_folders (user_id, parent_id, lower(name))
    WHERE parent_id IS NOT NULL;
