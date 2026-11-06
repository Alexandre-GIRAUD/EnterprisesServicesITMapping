/**
 * Each workspace has its own GitHub webhook: admins see its URL and secret and can regenerate it.
 * Run: npx --yes tsx src/features/auth/gitWebhook.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const settings = read('./pages/SettingsPage.tsx');
const panel = read('./pages/GitHubWebhookSettings.tsx');
const api = read('../map/api/integrationsGithubApi.ts');

assert.match(settings, /isAdmin \? <GitHubWebhookSettings \/> : null/);
assert.match(panel, /aria-label="GitHub webhook"/);
assert.match(panel, /Payload URL/);
assert.match(panel, /Regenerate secret/);
assert.match(panel, /window\.location\.origin/);
assert.match(api, /\/api\/integrations\/github\/webhook/);
assert.match(api, /\/api\/integrations\/github\/webhook\/secret/);

console.log('gitWebhook.check: ok');
