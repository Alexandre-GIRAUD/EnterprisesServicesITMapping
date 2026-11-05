/**
 * Runnable self-check for the Breaches filter of a sandbox, and for the filter menu both maps share.
 * Run: npx --yes tsx src/features/map/utils/sandboxBreach.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { GraphEdgeDto, GraphNodeDto } from '@/types/api';
import { sandboxFilterScope, sandboxFiltersActive, type SandboxDocFilters } from './sandboxDocuments.ts';

const node = (id: string) => ({ id, type: 'Application', properties: {} }) as unknown as GraphNodeDto;
const graphNodes = ['a', 'b', 'c'].map(node);
const graphEdges: GraphEdgeDto[] = [];
const filters = (breach: string[]): SandboxDocFilters => ({ applicationIds: [], nodeAttributes: {}, nodeRefs: {}, breach });

assert.equal(sandboxFiltersActive(filters([])), false);
assert.equal(sandboxFiltersActive(filters(['any'])), true);

// Only the applications in breach stay; until the breach list is known nothing is hidden.
const scoped = sandboxFilterScope({ graphNodes, graphEdges, filters: filters(['any']) }, new Set(['b']))!;
assert.deepEqual([...scoped.nodeIds], ['b']);
const loading = sandboxFilterScope({ graphNodes, graphEdges, filters: filters(['any']) })!;
assert.deepEqual([...loading.nodeIds].sort(), ['a', 'b', 'c']);

// One filter menu: the sandbox has no application search bar and offers the Breaches row like Cartography.
const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const sideTools = read('../components/graphCanvasSideTools.tsx');
assert.doesNotMatch(sideTools, /ApplicationSearchBar/);
assert.match(sideTools, /showBreach=\{!isReadOnly\}/);
assert.match(sideTools, /showPinView=\{isExplorer && !isReadOnly\}/);

console.log('sandboxBreach.check: ok');
