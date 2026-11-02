/**
 * Runnable self-check for hiddenEdgeAttributes (no test runner in frontend).
 * Run: npx --yes tsx src/features/map/utils/hiddenEdgeAttributes.check.ts
 */
import assert from 'node:assert/strict';
import { isHiddenEdgeAttribute, withoutHiddenEdgeAttributes } from './hiddenEdgeAttributes.ts';
import { buildFlowsColumnCatalog } from './tableColumns.ts';
import { colorPropertyOptions } from '../components/edgeColorProperty.ts';
import type { GraphEdgeDto, GraphNodeFilterDto } from '../../../types/api.ts';

for (const key of ['depends-on', 'depends_on', 'dependsOn', 'Depends On', 'DEPENDS_ON']) {
  assert.equal(isHiddenEdgeAttribute(key), true, key);
}
for (const key of ['frequency', 'depends', 'dependsOnTeam']) {
  assert.equal(isHiddenEdgeAttribute(key), false, key);
}

assert.deepEqual(
  withoutHiddenEdgeAttributes([{ key: 'depends-on' }, { key: 'frequency' }]),
  [{ key: 'frequency' }]
);

const filters: GraphNodeFilterDto[] = ['depends-on', 'frequency'].map((key) => ({
  key,
  label: key,
  values: ['x'],
  fromAllowedValues: true,
  kind: 'EDGE',
}));
assert.deepEqual(
  buildFlowsColumnCatalog(filters).map((c) => c.key),
  ['source', 'target', 'id', 'type', 'frequency']
);

const edge = {
  id: 'e',
  sourceId: 'a',
  targetId: 'b',
  type: 'DEPENDS_ON',
  properties: { 'depends-on': 'x', frequency: 'daily' },
} as GraphEdgeDto;
assert.deepEqual(
  colorPropertyOptions([edge]).map((o) => o.key),
  ['frequency', '__relation__']
);

console.log('hiddenEdgeAttributes.check: ok');
