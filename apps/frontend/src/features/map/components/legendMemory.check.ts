/**
 * The legend keeps its frame while the graph screen is replaced (module view and back).
 * Run: npx --yes tsx src/features/map/components/legendMemory.check.ts
 */
import assert from 'node:assert/strict';
import { recallLegend, rememberLegend } from './legendMemory.ts';

assert.equal(recallLegend(), null);
const frame = { offset: { left: 12, top: 30 }, size: { width: 300, height: 210 }, isUserSized: true };
rememberLegend(frame);
assert.deepEqual(recallLegend(), frame);

console.log('legendMemory.check: ok');
