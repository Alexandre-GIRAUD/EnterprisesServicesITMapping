/**
 * Default node fills are distinct pastels; default link strokes are distinct darks.
 * Run: npx --yes tsx src/features/map/components/graphPalette.check.ts
 */
import assert from 'node:assert/strict';
import {
  DARK_EDGE_PALETTE,
  EDGE_TYPE_STYLES,
  PASTEL_NODE_PALETTE,
} from './graphTheme.ts';
import {
  NODE_TYPE_COLOR_KEY,
  RELATION_TYPE_COLOR_KEY,
  nodeFillColorForValue,
  paintEdgeStrokeColor,
} from './edgeColorProperty.ts';

const SAMPLE_VALUES = ['Payments', 'Risk', 'Retail', 'Core', 'Treasury'];

function channels(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance(hex: string): number {
  const linear = channels(hex).map((channel) => {
    const scaled = channel / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function distance(left: string, right: string): number {
  const a = channels(left);
  const b = channels(right);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function assertSpread(colors: readonly string[], minDistance: number): void {
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      assert.ok(distance(colors[i], colors[j]) >= minDistance, `${colors[i]} ~ ${colors[j]}`);
    }
  }
}

for (const color of PASTEL_NODE_PALETTE) {
  assert.ok(relativeLuminance(color) >= 0.5, color);
}
for (const color of DARK_EDGE_PALETTE) {
  assert.ok(relativeLuminance(color) <= 0.2, color);
}
assertSpread(PASTEL_NODE_PALETTE, 40);
assertSpread(DARK_EDGE_PALETTE, 50);

const application = nodeFillColorForValue(NODE_TYPE_COLOR_KEY, 'Application');
const moduleFill = nodeFillColorForValue(NODE_TYPE_COLOR_KEY, 'Module');
assert.notEqual(application, moduleFill);
assert.ok(PASTEL_NODE_PALETTE.includes(application as (typeof PASTEL_NODE_PALETTE)[number]));
assert.ok(PASTEL_NODE_PALETTE.includes(moduleFill as (typeof PASTEL_NODE_PALETTE)[number]));

const fills = SAMPLE_VALUES.map((value) => nodeFillColorForValue('tier', value));
assert.equal(new Set(fills).size, SAMPLE_VALUES.length);
for (const fill of fills) {
  assert.ok(PASTEL_NODE_PALETTE.includes(fill as (typeof PASTEL_NODE_PALETTE)[number]), fill);
}
assert.equal(nodeFillColorForValue('tier', 'Payments', { Payments: '#112233' }), '#112233');

const dependency = paintEdgeStrokeColor('DEPENDS_ON', 'DEPENDS_ON', RELATION_TYPE_COLOR_KEY);
const composition = paintEdgeStrokeColor('CONTAINS', 'CONTAINS', RELATION_TYPE_COLOR_KEY);
assert.equal(dependency, EDGE_TYPE_STYLES.DEPENDS_ON.color);
assert.equal(composition, EDGE_TYPE_STYLES.CONTAINS.color);
assert.notEqual(dependency, composition);
assert.ok(relativeLuminance(dependency) <= 0.2);
assert.ok(relativeLuminance(composition) <= 0.2);
assert.ok(distance(dependency, composition) >= 80);

const strokes = SAMPLE_VALUES.map((value) => paintEdgeStrokeColor(value, 'DEPENDS_ON', 'tier'));
assert.equal(new Set(strokes).size, SAMPLE_VALUES.length);
for (const stroke of strokes) {
  assert.ok(DARK_EDGE_PALETTE.includes(stroke as (typeof DARK_EDGE_PALETTE)[number]), stroke);
}
assert.equal(
  paintEdgeStrokeColor('Payments', 'DEPENDS_ON', 'tier', { Payments: '#abcdef' }),
  '#abcdef',
);

console.log('graphPalette.check: ok');
