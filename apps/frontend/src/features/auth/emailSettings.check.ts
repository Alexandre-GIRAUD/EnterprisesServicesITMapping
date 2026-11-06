/**
 * Email in Settings: panel with the current address and a change form, confirmation page.
 * Run: npx --yes tsx src/features/auth/emailSettings.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const app = read('../../App.tsx');
const settings = read('./pages/SettingsPage.tsx');
const panel = read('./pages/EmailSettings.tsx');
const confirm = read('./pages/ConfirmEmailPage.tsx');
const api = read('./api/accountApi.ts');

assert.match(app, /path="\/confirm-email"/);

assert.match(settings, /<EmailSettings/);

assert.match(panel, /aria-label="Email"/);
assert.match(panel, /Check your inbox/);
assert.match(panel, /requestEmailChange/);

assert.match(confirm, /searchParams\.get\(TOKEN_SEARCH_PARAM\)/);
assert.match(confirm, /confirmEmailChangeRequest/);

assert.match(api, /\/api\/account/);
assert.match(api, /\/api\/account\/email/);
assert.match(api, /\/api\/auth\/confirm-email-change/);

console.log('emailSettings.check: ok');
