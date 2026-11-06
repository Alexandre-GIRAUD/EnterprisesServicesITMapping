/**
 * Invitations: panel on the Users page when mail is on, acceptance page.
 * Run: npx --yes tsx src/features/auth/invitations.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const app = read('../../App.tsx');
const users = read('./pages/AdminUsersPage.tsx');
const panel = read('./components/InvitationsPanel.tsx');
const accept = read('./pages/AcceptInvitationPage.tsx');
const api = read('./api/invitationsApi.ts');

assert.match(app, /path="\/accept-invitation"/);

assert.match(users, /<InvitationsPanel/);
assert.match(users, /mailEnabled/);

assert.match(panel, /Invite by email/);
assert.match(panel, /Resend/);
assert.match(panel, /Cancel/);
assert.match(panel, /EXPIRED/);

assert.match(accept, /searchParams\.get\('token'\)/);
assert.match(accept, /acceptInvitationRequest/);
assert.match(accept, /Join your workspace/);

assert.match(api, /\/api\/admin\/invitations/);
assert.match(api, /\/api\/auth\/accept-invitation/);

console.log('invitations.check: ok');
