/**
 * Runnable self-check for the side menu width limits.
 * Run: npx --yes tsx src/features/map/components/sideMenuWidth.check.ts
 */
import assert from 'node:assert/strict';
import { clampMenuWidth } from './sideMenuWidth.ts';

assert.equal(clampMenuWidth(100, 1200), 240);
assert.equal(clampMenuWidth(400, 1200), 400);
assert.equal(clampMenuWidth(700, 1200), 700);
assert.equal(clampMenuWidth(1100, 1200), 920);
assert.equal(clampMenuWidth(900, 2000), 900);
assert.equal(clampMenuWidth(300, 400), 120);

console.log('sideMenuWidth.check: ok');
