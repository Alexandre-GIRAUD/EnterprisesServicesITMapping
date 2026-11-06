-- Every workspace-owned table gets its workspace. Existing rows belong to the Default workspace.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'ai_decision_sources',
        'application_detection_documents',
        'application_functional_docs',
        'attribute_change_events',
        'attribute_override_conflicts',
        'breach_rules',
        'change_detection_items',
        'change_detection_runs',
        'data_model',
        'data_source_mappings',
        'data_sources',
        'entity_comments',
        'entity_validations',
        'functional_doc_chunks',
        'graph_snapshots',
        'graph_view_folders',
        'human_field_overrides',
        'shared_custom_tables',
        'shared_sandboxes',
        'system_daily_states'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN workspace_id UUID REFERENCES workspaces(id)', t);
        EXECUTE format('UPDATE %I SET workspace_id = %L', t, '00000000-0000-0000-0000-000000000001');
        EXECUTE format('ALTER TABLE %I ALTER COLUMN workspace_id SET NOT NULL', t);
        EXECUTE format('CREATE INDEX idx_%s_workspace ON %I (workspace_id)', t, t);
    END LOOP;
END $$;

-- Names and keys that were unique across the server become unique per workspace.
DROP INDEX breach_rules_name_unique;
CREATE UNIQUE INDEX breach_rules_name_unique ON breach_rules (workspace_id, LOWER(name));

ALTER TABLE change_detection_runs DROP CONSTRAINT uq_change_detection_runs_repo_commit;
ALTER TABLE change_detection_runs
    ADD CONSTRAINT uq_change_detection_runs_repo_commit UNIQUE (workspace_id, repo_full_name, commit_sha);

-- One Data Model per workspace, keyed by the workspace id.
ALTER TABLE data_model ALTER COLUMN id TYPE VARCHAR(36);
UPDATE data_model SET id = workspace_id::text;

-- One daily state per workspace and day.
ALTER TABLE system_daily_states DROP CONSTRAINT system_daily_states_pkey;
ALTER TABLE system_daily_states ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY;
ALTER TABLE system_daily_states ADD CONSTRAINT uq_system_daily_states_day UNIQUE (workspace_id, day);
