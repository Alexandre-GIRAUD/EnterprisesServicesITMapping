# Git credentials belong to the workspace

GitHub and Bitbucket tokens are stored on the workspace, pasted by one of its admins, instead of on each user or in server-wide settings (`GITHUB_TOKEN`, `BITBUCKET_TOKEN`). Once self-service workspaces exist, a server token would read repositories on behalf of every customer, and a personal token would stop working when its owner leaves. The migration drops the personal token columns rather than promoting one user's token to the workspace without their knowledge, so an admin pastes the workspace token once after upgrading.

GitHub pushes arrive on one URL per workspace, signed with that workspace's own secret, so a customer who knows their secret cannot send pushes into another workspace. The previous global URL keeps serving the Default workspace while `GITHUB_WEBHOOK_SECRET` is set, so on-premise installations do not break on upgrade.

Tokens and webhook secrets are encrypted with a key derived from `JWT_SECRET`; changing it means pasting them again. A dedicated encryption key and a GitHub App were left for later.
