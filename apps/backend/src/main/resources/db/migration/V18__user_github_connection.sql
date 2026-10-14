ALTER TABLE users
    ADD COLUMN github_login VARCHAR(255),
    ADD COLUMN github_access_token TEXT,
    ADD COLUMN github_oauth_state VARCHAR(80),
    ADD COLUMN github_oauth_state_expires TIMESTAMPTZ;

ALTER TABLE users
    ADD CONSTRAINT users_github_oauth_state_key UNIQUE (github_oauth_state);
