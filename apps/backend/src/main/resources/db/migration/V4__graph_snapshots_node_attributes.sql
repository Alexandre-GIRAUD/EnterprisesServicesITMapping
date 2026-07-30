-- Graph filters are now driven by the Data Model (target=NODE) instead of the hardcoded
-- year / business unit / region dimensions. Existing snapshots keep their application ids;
-- their legacy dimensions are dropped (documented breaking change) because there is no
-- deterministic mapping to Data Model keys.
ALTER TABLE graph_snapshots
    ADD COLUMN node_attributes JSONB NOT NULL DEFAULT '{}';

ALTER TABLE graph_snapshots
    DROP COLUMN year,
    DROP COLUMN business_unit_ids,
    DROP COLUMN region_codes;
