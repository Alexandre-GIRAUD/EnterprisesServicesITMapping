-- Production graph as it stood at the end of each day: applications, modules and their relationships.
CREATE TABLE system_daily_states (
    day DATE PRIMARY KEY,
    state JSONB NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
