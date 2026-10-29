/**
 * Node icons follow an attribute chosen in the legend; off by default.
 * Run: npx --yes tsx src/features/map/components/nodeIcons.check.ts
 */
import assert from 'node:assert/strict';
import type { GraphNodeDto } from '@/types/api';
import {
  EDGE_COLOR_PROPERTY_LABELS,
  NODE_TYPE_COLOR_KEY,
  RELATION_TYPE_COLOR_KEY,
  labelForColorProperty,
} from './edgeColorProperty.ts';
import {
  NODE_ICON_CATALOG,
  NODE_ICON_NONE_KEY,
  defaultIconForValue,
  nodeIconKeyFor,
} from './nodeIcons.ts';
import { NODE_ICON_GLYPHS } from './nodeIconGlyphs.ts';
import { nodeLabelScale } from './nodeIcons.ts';

function app(id: string, tier: string): GraphNodeDto {
  return { id, label: id, type: 'Application', properties: { tier } };
}

assert.ok(NODE_ICON_CATALOG.length >= 60);
assert.equal(new Set(NODE_ICON_CATALOG.map((i) => i.key)).size, NODE_ICON_CATALOG.length);
for (const { key } of NODE_ICON_CATALOG) assert.ok(NODE_ICON_GLYPHS[key], `glyph for ${key}`);

const values = ['Gold', 'Silver'];
assert.equal(nodeIconKeyFor(app('a', 'Gold'), NODE_ICON_NONE_KEY, {}, values), null);
assert.equal(nodeIconKeyFor(app('a', 'Gold'), 'tier', {}, values), NODE_ICON_CATALOG[0].key);
assert.equal(nodeIconKeyFor(app('a', 'Silver'), 'tier', {}, values), NODE_ICON_CATALOG[1].key);
assert.equal(nodeIconKeyFor(app('a', 'Silver'), 'tier', { Silver: 'rocket' }, values), 'rocket');
assert.equal(nodeIconKeyFor(app('a', ''), 'tier', {}, values), null);
assert.equal(defaultIconForValue(values, 'Gold'), NODE_ICON_CATALOG[0].key);

// Labels shrink a little when icons are shown.
assert.ok(nodeLabelScale(true) < nodeLabelScale(false));
assert.equal(nodeLabelScale(false), 1);

// "None" replaces the confusing App / Flow wording in the edit menu.
assert.equal(labelForColorProperty(NODE_TYPE_COLOR_KEY), 'None');
assert.equal(labelForColorProperty(RELATION_TYPE_COLOR_KEY), 'None');
assert.equal(EDGE_COLOR_PROPERTY_LABELS.__label__, 'Name');

console.log('nodeIcons.check: ok');
