/**
 * Runnable self-check: the graph is fitted beside the module drawer, not under it.
 * Run: npx --yes tsx src/features/map/components/moduleFitPadding.check.ts
 */
import assert from 'node:assert/strict';
import { DRAWER_FIT_INSET_PX, moduleFitPadding } from './moduleFitPadding.ts';

assert.equal(typeof moduleFitPadding(false), 'number');
const open = moduleFitPadding(true);
assert.equal(typeof open, 'object');
assert.equal((open as { right: string }).right, `${DRAWER_FIT_INSET_PX}px`);
assert.ok(DRAWER_FIT_INSET_PX >= 452, 'wider than the 440px drawer plus its margin');

console.log('moduleFitPadding.check: ok');
