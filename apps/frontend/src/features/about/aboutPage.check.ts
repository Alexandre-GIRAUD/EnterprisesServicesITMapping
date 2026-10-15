/**
 * Runnable self-check for the about-page contact link.
 * Run: npx --yes tsx src/features/about/aboutPage.check.ts
 */
import assert from 'node:assert/strict';
import { buildContactMailHref, FLOWRA_CONTACT_EMAIL, FLOWRA_SITE_URL } from './aboutContact.ts';

assert.equal(typeof FLOWRA_SITE_URL, 'string');
assert.equal(typeof FLOWRA_CONTACT_EMAIL, 'string');
const href = buildContactMailHref('Hello', 'A question');
assert.ok(href.startsWith(`mailto:${FLOWRA_CONTACT_EMAIL}?`));
assert.ok(href.includes('subject=Hello'));
assert.ok(href.includes('body=A+question') || href.includes('body=A%20question'));
console.log('aboutPage.check ok');
