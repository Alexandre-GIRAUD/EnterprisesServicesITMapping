/**
 * Git connections belong to the workspace: admins paste the token, members only read the status.
 * Run: npx --yes tsx src/features/auth/gitConnections.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

for (const [file, provider] of [
  ['./pages/GitHubTokenSettings.tsx', 'GitHub'],
  ['./pages/BitbucketTokenSettings.tsx', 'Bitbucket'],
] as const) {
  const panel = read(file);
  assert.match(panel, /isAdmin/, `${provider}: only admins change the connection`);
  assert.match(panel, /\(workspace connection\)/, `${provider}: says the connection is shared`);
  assert.match(
    panel,
    new RegExp(`Ask an administrator to connect ${provider}`),
    `${provider}: members are told who connects`,
  );
  assert.doesNotMatch(panel, /on your account only/, `${provider}: no personal token wording`);
}

console.log('gitConnections.check: ok');
