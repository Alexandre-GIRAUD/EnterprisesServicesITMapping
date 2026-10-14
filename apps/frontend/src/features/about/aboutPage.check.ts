/**
 * Runnable self-check for the about-page contact link.
 * Run: npx --yes tsx src/features/about/aboutPage.check.ts
 */
import assert from 'node:assert/strict';
import { contactMailHref, FLOWRA_CONTACT_EMAIL, FLOWRA_SITE_URL } from './aboutContact.ts';

assert.equal(FLOWRA_SITE_URL, 'http://92.222.78.26:3000/login');
const href = contactMailHref('Hello', 'A question');
assert.ok(href.startsWith(`mailto:${FLOWRA_CONTACT_EMAIL}?`));
assert.ok(href.includes('subject=Hello'));
assert.ok(href.includes('body=A+question') || href.includes('body=A%20question'));
console.log('aboutPage.check ok');
