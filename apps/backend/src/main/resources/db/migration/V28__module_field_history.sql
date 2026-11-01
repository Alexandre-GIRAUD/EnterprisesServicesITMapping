-- Module details (description, owner, actors, trigger, consumed and produced data) are editable and audited.
ALTER TABLE attribute_change_events DROP CONSTRAINT chk_attribute_change_events_field_scope;
ALTER TABLE attribute_change_events ADD CONSTRAINT chk_attribute_change_events_field_scope
    CHECK (field_scope IN ('NODE_ATTR', 'EDGE_ATTR', 'APP_FIELD', 'EDGE_LINK', 'APP_LINK', 'MODULE_LINK', 'MODULE_FIELD'));

ALTER TABLE human_field_overrides DROP CONSTRAINT chk_human_field_overrides_target_type;
ALTER TABLE human_field_overrides ADD CONSTRAINT chk_human_field_overrides_target_type
    CHECK (target_type IN ('APPLICATION', 'EDGE', 'MODULE'));
