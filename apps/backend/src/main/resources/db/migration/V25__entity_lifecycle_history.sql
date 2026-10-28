-- Entity lifecycle history: applications and modules join edges in the audit log, and every event
-- names the applications it belongs to so one application's history survives its deletion.
ALTER TABLE attribute_change_events DROP CONSTRAINT chk_attribute_change_events_target_type;
ALTER TABLE attribute_change_events ADD CONSTRAINT chk_attribute_change_events_target_type
    CHECK (target_type IN ('APPLICATION', 'EDGE', 'MODULE'));

ALTER TABLE attribute_change_events DROP CONSTRAINT chk_attribute_change_events_field_scope;
ALTER TABLE attribute_change_events ADD CONSTRAINT chk_attribute_change_events_field_scope
    CHECK (field_scope IN ('NODE_ATTR', 'EDGE_ATTR', 'APP_FIELD', 'EDGE_LINK', 'APP_LINK', 'MODULE_LINK'));

ALTER TABLE attribute_change_events
    ADD COLUMN application_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE attribute_change_events
SET application_ids = jsonb_build_array(target_id)
WHERE target_type = 'APPLICATION';

-- Edge endpoints come from the oldest link snapshot of each edge.
WITH edge_endpoints AS (
    SELECT DISTINCT ON (target_id)
        target_id,
        COALESCE(new_value, old_value)::jsonb AS snapshot
    FROM attribute_change_events
    WHERE field_scope = 'EDGE_LINK'
      AND COALESCE(new_value, old_value) LIKE '{%'
    ORDER BY target_id, created_at
)
UPDATE attribute_change_events event
SET application_ids = jsonb_build_array(endpoint.snapshot ->> 'sourceId', endpoint.snapshot ->> 'targetId')
FROM edge_endpoints endpoint
WHERE event.target_type = 'EDGE'
  AND event.target_id = endpoint.target_id;

CREATE INDEX idx_attribute_change_events_application_ids
    ON attribute_change_events USING GIN (application_ids jsonb_path_ops);

CREATE INDEX idx_attribute_change_events_created
    ON attribute_change_events (created_at DESC);
