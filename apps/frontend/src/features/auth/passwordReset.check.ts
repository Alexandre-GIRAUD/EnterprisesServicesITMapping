/**
 * Forgot password: link on sign-in when mail is on, request page, reset page.
 * Run: npx --yes tsx src/features/auth/passwordReset.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const app = read('../../App.tsx');
const login = read('./pages/LoginPage.tsx');
const forgot = read('./pages/ForgotPasswordPage.tsx');
const reset = read('./pages/ResetPasswordPage.tsx');
const authApi = read('./api/authApi.ts');

assert.match(app, /path="\/forgot-password"/);
assert.match(app, /path="\/reset-password"/);

assert.match(login, /isMailEnabled/);
assert.match(login, /to="\/forgot-password"/);
assert.match(login, /Forgot password\?/);

assert.match(forgot, /Reset your password/);
assert.match(forgot, /forgotPasswordRequest/);
assert.match(forgot, /If an account uses this email/);

assert.match(reset, /searchParams\.get\(TOKEN_SEARCH_PARAM\)/);
assert.match(reset, /resetPasswordRequest/);
assert.match(reset, /MIN_PASSWORD_LENGTH/);

assert.match(authApi, /mailEnabled: boolean/);
assert.match(authApi, /\/api\/auth\/forgot-password/);
assert.match(authApi, /\/api\/auth\/reset-password/);

console.log('passwordReset.check: ok');
