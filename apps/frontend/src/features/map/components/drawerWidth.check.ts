/**
 * Resizable drawer: the width stays between a readable minimum and most of the pane.
 * Run: npx --yes tsx src/features/map/components/drawerWidth.check.ts
 */
import assert from 'node:assert/strict';
import { DRAWER_MIN_WIDTH_PX, clampDrawerWidth, dragDrawerWidth } from './drawerWidth.ts';

assert.equal(clampDrawerWidth(500, 1400), 500);
assert.equal(clampDrawerWidth(100, 1400), DRAWER_MIN_WIDTH_PX);
assert.equal(clampDrawerWidth(2000, 1000), 800);
// A pane narrower than the minimum still gets a drawer that fits in it.
assert.equal(clampDrawerWidth(500, 300), 240);

// The drawer grows when its left edge is dragged to the left.
assert.equal(dragDrawerWidth({ startWidth: 440, startX: 900, x: 800, paneWidth: 1400 }), 540);
assert.equal(dragDrawerWidth({ startWidth: 440, startX: 900, x: 1000, paneWidth: 1400 }), 340);
assert.equal(dragDrawerWidth({ startWidth: 440, startX: 900, x: 3000, paneWidth: 1400 }), DRAWER_MIN_WIDTH_PX);

console.log('drawerWidth.check: ok');
