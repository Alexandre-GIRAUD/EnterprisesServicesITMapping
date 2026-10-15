/**
 * The GitHub token field lives on Settings, not on Sources.
 * Run: npx --yes tsx src/features/auth/pages/settingsGitHubToken.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('./SettingsPage.tsx', import.meta.url), 'utf8');
const tokenPanel = readFileSync(new URL('./GitHubTokenSettings.tsx', import.meta.url), 'utf8');
const sources = readFileSync(
  new URL('../../map/pages/GitHubImportPage.tsx', import.meta.url),
  'utf8',
);

assert.match(settings, /GitHubTokenSettings/);
assert.match(tokenPanel, /aria-label="GitHub token"/);
assert.match(tokenPanel, /Save token/);
assert.doesNotMatch(sources, /Save token/);
assert.doesNotMatch(sources, /name="github-token"/);

console.log('settingsGitHubToken.check: ok');
