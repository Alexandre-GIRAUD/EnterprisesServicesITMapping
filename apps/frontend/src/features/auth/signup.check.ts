/**
 * Self-service signup screens: routes, login link, inbox state, workspace name in the profile.
 * Run: npx --yes tsx src/features/auth/signup.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const app = read('../../App.tsx');
const login = read('./pages/LoginPage.tsx');
const signup = read('./pages/SignupPage.tsx');
const verify = read('./pages/VerifyEmailPage.tsx');
const inbox = read('./components/CheckInbox.tsx');
const authApi = read('./api/authApi.ts');
const api = read('../../config/api.ts');
const profile = read('../../layouts/SidebarProfile.tsx');

assert.match(app, /path="\/signup"/);
assert.match(app, /path="\/verify-email"/);

assert.match(login, /signupEnabled/);
assert.match(login, /to="\/signup"/);
assert.match(login, /Email or username/);
assert.match(login, /EmailNotVerifiedError/);

assert.match(signup, /Create your workspace/);
assert.match(signup, /workspaceName/);
assert.match(signup, /<CheckInbox/);

assert.match(verify, /searchParams\.get\('token'\)/);
assert.match(verify, /verifyEmailRequest/);

assert.match(inbox, /Check your inbox/);
assert.match(inbox, /Resend email/);
assert.match(inbox, /resendVerificationRequest/);

assert.match(authApi, /\/api\/config/);
assert.match(authApi, /\/api\/auth\/signup/);
assert.match(authApi, /\/api\/auth\/verify-email/);
assert.match(authApi, /\/api\/auth\/resend-verification/);
assert.match(authApi, /status === 403/);

assert.match(api, /workspaceName: string/);
assert.match(profile, /workspaceName/);

console.log('signup.check: ok');
