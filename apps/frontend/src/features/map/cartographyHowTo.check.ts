/**
 * The cartography chrome no longer prints how-to sentences.
 * Run: npx --yes tsx src/features/map/cartographyHowTo.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const howToSentences = [
  'Tip: double-click an application to open its module graph. Single-click for details.',
  'Narrow the graph. Each dimension combines with AND (all conditions must match).',
  'Saved views (filters, hidden apps, layout). Select a view to apply it to the graph.',
  'Sandbox — customize your graph, no changes saved.',
];

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const filterDrawer = readSource('./components/FilterDrawer.tsx');
const graphCanvas = readSource('./components/GraphCanvas.tsx');
const graphData = readSource('./hooks/useGraphData.ts');

for (const sentence of howToSentences) {
  assert.equal(filterDrawer.includes(sentence), false, sentence);
  assert.equal(graphCanvas.includes(sentence), false, sentence);
  assert.equal(graphData.includes(sentence), false, sentence);
}

assert.match(graphData, /No applications match these filters\. Change criteria or reset\./);
assert.match(graphData, /No nodes\. Start the backend with Neo4j to load demo data\./);
assert.match(graphData, /Filters applied — sandbox draft reset\./);
assert.match(graphCanvas, /Loading graph…/);
assert.match(graphCanvas, /Module dependency tree for this application\. Double-click a module to explore further\./);
assert.match(graphCanvas, /View "\$\{name\}" saved\./);

console.log('cartographyHowTo.check: ok');
