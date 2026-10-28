/**
 * Cartography can show Production as of a past day: graph and application reads carry asOf, and
 * the past view offers no way to change anything.
 * Run: npx --yes tsx src/features/map/utils/timeTravel.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pastReadUrl } from '../../../config/api.ts';

const DAY = '2026-03-01';

assert.equal(pastReadUrl('/api/graph?applicationIds=a', 'GET', DAY), `/api/graph?applicationIds=a&asOf=${DAY}`);
assert.equal(pastReadUrl('/api/applications', 'GET', DAY), `/api/applications?asOf=${DAY}`);
assert.equal(
  pastReadUrl('http://127.0.0.1:8081/api/applications/app-1/module-graph', 'GET', DAY),
  `http://127.0.0.1:8081/api/applications/app-1/module-graph?asOf=${DAY}`,
);
assert.equal(pastReadUrl('/api/graph/edges', 'POST', DAY), '/api/graph/edges');
assert.equal(pastReadUrl('/api/comments?targetId=a', 'GET', DAY), '/api/comments?targetId=a');
assert.equal(pastReadUrl('/api/history?applicationId=a', 'GET', DAY), '/api/history?applicationId=a');
assert.equal(pastReadUrl('/api/graph', 'GET', null), '/api/graph');

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const mapPage = source('../pages/MapPage.tsx');
assert.match(mapPage, /setViewingDay\(viewingDay\)/);
assert.match(mapPage, /key=\{viewingDay \?\? 'live'\}/);

const canvas = source('../components/GraphCanvas.tsx');
assert.match(canvas, /<HistoryDatePicker/);
assert.match(canvas, /Read-only\./);
assert.match(canvas, /Back to today/);
assert.equal((canvas.match(/isReadOnly=\{isReadOnly\}/g) ?? []).length, 2);
assert.match(canvas, /canCorrect=\{!isReadOnly\}/);
assert.match(canvas, /isReadOnly,/);

const toolBar = source('../components/SelfServiceToolBar.tsx');
assert.match(toolBar, /canCorrect \?/);

const sideTools = source('../components/graphCanvasSideTools.tsx');
assert.match(sideTools, /showPinView=\{isExplorer && !isReadOnly\}/);

for (const drawer of ['ApplicationDetailsDrawer', 'EdgeDetailsDrawer']) {
  assert.match(source(`../components/${drawer}.tsx`), /isReadOnly = false/);
}

console.log('timeTravel.check: ok');
