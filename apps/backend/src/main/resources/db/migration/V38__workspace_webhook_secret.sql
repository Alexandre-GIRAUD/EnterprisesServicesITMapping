-- Each workspace receives GitHub pushes on its own URL, signed with its own secret (ciphertext).
ALTER TABLE workspaces ADD COLUMN github_webhook_secret TEXT;
