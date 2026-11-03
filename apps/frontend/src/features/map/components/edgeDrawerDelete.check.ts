/**
 * Connection delete sits in the edit form, same place as application delete.
 * Run: node --experimental-strip-types src/features/map/components/edgeDrawerDelete.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const drawer = readFileSync(new URL('./EdgeDetailsDrawer.tsx', import.meta.url), 'utf8');
const formStart = drawer.indexOf('className="graph-drawer-form"');
const actionsStart = drawer.indexOf('className="graph-details-actions"');
const form = drawer.slice(formStart, actionsStart);
const actions = drawer.slice(actionsStart);

assert.ok(formStart >= 0 && actionsStart > formStart);
assert.match(form, />\s*Delete\s*</);
assert.match(actions, />\s*Edit\s*</);
assert.doesNotMatch(actions, />\s*Delete\s*</);
