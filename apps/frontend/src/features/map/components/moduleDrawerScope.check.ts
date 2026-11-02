/**
 * The module drawer shows one module when a module is selected, else the whole application.
 * Run: npx --yes tsx src/features/map/components/moduleDrawerScope.check.ts
 */
import assert from 'node:assert/strict';
import { scopedModule } from './moduleDrawerScope.ts';

const modules = [{ id: 'm1' }, { id: 'm2' }];
assert.deepEqual(scopedModule(modules, 'm2'), { id: 'm2' });
assert.equal(scopedModule(modules, 'app'), null);
assert.equal(scopedModule(modules, null), null);

console.log('moduleDrawerScope.check: ok');
