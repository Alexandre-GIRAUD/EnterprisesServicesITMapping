/**
 * Jira token field is visual only. It does not call the backend.
 * Run: npx --yes tsx src/features/auth/pages/jiraTokenSettings.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('./SettingsPage.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./JiraTokenSettings.tsx', import.meta.url), 'utf8');

assert.match(settings, /JiraTokenSettings/);
assert.match(panel, /aria-label="Jira token"/);
assert.match(panel, /placeholder="Jira token"/);
assert.match(panel, /Save token/);
assert.doesNotMatch(panel, /fetch\(|\/api\//);

console.log('jiraTokenSettings.check: ok');
