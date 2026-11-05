/**
 * The legend keeps its frame while the graph screen is replaced (module view and back).
 * Run: npx --yes tsx src/features/map/components/legendMemory.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recallLegend, rememberLegend } from './legendMemory.ts';

assert.equal(recallLegend(), null);
const frame = { offset: { left: 12, top: 30 }, size: { width: 300, height: 210 }, isUserSized: true, isConcealed: true };
rememberLegend(frame);
assert.deepEqual(recallLegend(), frame);

// Folded or open, the legend comes back the way the user left it in the next view.
const frameHook = readFileSync(new URL('./useLegendFrame.ts', import.meta.url), 'utf8');
assert.match(frameHook, /\[isFoldedByUser, setIsFoldedByUser\] = useState\(remembered\?\.isConcealed \?\? false\)/);
// Only the user's own fold is remembered: the automatic fold when a drawer opens is not.
assert.match(frameHook, /rememberLegend\(\{ offset, size, isUserSized, isConcealed: isFoldedByUser \}\)/);
assert.match(frameHook, /setIsFoldedByUser\(!input\.concealedRef\.current\)/);

console.log('legendMemory.check: ok');
