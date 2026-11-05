/**
 * Runnable self-check: a sandbox refits once its pane width has settled after the side menu moved,
 * and never once the user has zoomed or panned.
 * Run: npx --yes tsx src/features/map/components/sandboxRefit.check.ts
 */
import assert from 'node:assert/strict';
import {
  WIDTH_STABLE_MS,
  isUserMove,
  markFitted,
  observeWidth,
  shouldRefit,
  startRefitTracking,
  takeOver,
} from './sandboxRefit.ts';

const fitted = startRefitTracking(900, 0);

// Nothing moved: no refit.
assert.equal(shouldRefit(fitted, 10_000), false);

// The menu starts sliding: the width changes, but it is not stable yet.
let state = observeWidth(fitted, 800, 100);
assert.equal(shouldRefit(state, 100), false);
state = observeWidth(state, 700, 180);
assert.equal(shouldRefit(state, 180 + WIDTH_STABLE_MS - 1), false, 'still moving: the clock restarts at each change');
assert.equal(shouldRefit(state, 180 + WIDTH_STABLE_MS), true, 'stable long enough');

// A sub-pixel wobble does not restart the clock.
const wobbled = observeWidth(state, 700.4, 200);
assert.equal(shouldRefit(wobbled, 180 + WIDTH_STABLE_MS), true);

// Once refitted, the same width never refits again.
const refitted = markFitted(state, 500);
assert.equal(shouldRefit(refitted, 10_000), false);

// The menu closing brings a new width: it refits again.
const closed = observeWidth(refitted, 900, 600);
assert.equal(shouldRefit(closed, 600 + WIDTH_STABLE_MS), true);

// Back to the fitted width before the pause ends: nothing to refit.
assert.equal(shouldRefit(observeWidth(state, 900, 190), 10_000), false);

// A zoom or pan by the user cancels the pending refit, whatever the width does next.
const taken = takeOver(state);
assert.equal(shouldRefit(taken, 10_000), false);
assert.equal(shouldRefit(observeWidth(taken, 650, 300), 300 + WIDTH_STABLE_MS), false, 'the same slide stays cancelled');
// A later menu move after the cancelled one is a new intent and refits.
assert.equal(shouldRefit(observeWidth(markFitted(taken, 700), 900, 2_000), 2_000 + WIDTH_STABLE_MS), true);

// React Flow passes the DOM event for a user gesture and null for its own fitView.
assert.equal(isUserMove(new Event('wheel')), true);
assert.equal(isUserMove(null), false);

console.log('sandboxRefit.check: ok');
