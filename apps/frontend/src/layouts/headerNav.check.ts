/**
 * Runnable self-check for the active header link mark.
 * Run: npx --yes tsx src/layouts/headerNav.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const activeLink = css.match(/\.layout-header-link\.is-active\s*\{[^}]*\}/);
assert.ok(activeLink, 'active header link rule missing');
assert.match(activeLink[0], /text-decoration:\s*underline/);
assert.doesNotMatch(activeLink[0], /box-shadow/);

console.log('headerNav.check: ok');
