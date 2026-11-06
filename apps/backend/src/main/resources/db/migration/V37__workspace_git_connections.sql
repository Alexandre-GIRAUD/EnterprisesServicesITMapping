-- GitHub and Bitbucket access belongs to the workspace, set by its admins. Personal tokens go away:
-- an admin pastes the workspace token once after this migration.
ALTER TABLE workspaces ADD COLUMN github_login VARCHAR(255);
ALTER TABLE workspaces ADD COLUMN github_token TEXT;
ALTER TABLE workspaces ADD COLUMN bitbucket_username VARCHAR(255);
ALTER TABLE workspaces ADD COLUMN bitbucket_token TEXT;

ALTER TABLE users DROP COLUMN github_login;
ALTER TABLE users DROP COLUMN github_access_token;
ALTER TABLE users DROP COLUMN bitbucket_username;
ALTER TABLE users DROP COLUMN bitbucket_access_token;
