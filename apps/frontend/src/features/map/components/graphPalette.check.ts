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
  NODE_LABEL_COLOR_KEY,
  RELATION_TYPE_COLOR_KEY,
  chooseSpreadColorKey,
  distinctColorMap,
  nodeFillColorForValue,
  borderFromFill,
  nodeBorderColorForValue,
  paintChannelColors,
  paintEdgeStrokeColor,
  resolveMirroredKey,
  resolveSpreadColorKeys,
  resolveUntouchedColorKey,
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

const orderedFills = ['Core', 'Payments', 'Retail', 'Risk', 'Treasury'];
const fillMap = distinctColorMap(orderedFills, PASTEL_NODE_PALETTE);
orderedFills.forEach((value, index) => {
  assert.equal(fillMap[value], PASTEL_NODE_PALETTE[index]);
});
assert.equal(distinctColorMap(orderedFills, PASTEL_NODE_PALETTE, { Core: '#112233' }).Core, '#112233');
const nine = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
assert.equal(distinctColorMap(nine, PASTEL_NODE_PALETTE).i, PASTEL_NODE_PALETTE[0]);

const orderedStrokes = ['cash flows', 'clearing data', 'price'];
const strokeMap = distinctColorMap(orderedStrokes, DARK_EDGE_PALETTE);
orderedStrokes.forEach((value, index) => {
  assert.equal(strokeMap[value], DARK_EDGE_PALETTE[index]);
});
assert.equal(
  distinctColorMap(orderedStrokes, DARK_EDGE_PALETTE, { price: '#abcdef' }).price,
  '#abcdef',
);

assert.equal(
  chooseSpreadColorKey(
    [
      { key: 'pillar', distinct: 3 },
      { key: 'business_function', distinct: 6 },
      { key: 'creation_date', distinct: 40 },
    ],
    PASTEL_NODE_PALETTE.length,
    NODE_TYPE_COLOR_KEY,
  ),
  'business_function',
);
assert.equal(
  chooseSpreadColorKey(
    [
      { key: 'business_function', distinct: 6, covered: 10 },
      { key: NODE_LABEL_COLOR_KEY, distinct: 112, covered: 112 },
    ],
    PASTEL_NODE_PALETTE.length,
    NODE_TYPE_COLOR_KEY,
    112,
  ),
  NODE_LABEL_COLOR_KEY,
);
assert.equal(
  chooseSpreadColorKey(
    [
      { key: 'business_function', distinct: 6, covered: 10 },
      { key: 'pillar', distinct: 4, covered: 100 },
    ],
    PASTEL_NODE_PALETTE.length,
    NODE_TYPE_COLOR_KEY,
  ),
  'pillar',
);
assert.equal(
  chooseSpreadColorKey(
    [{ key: 'data', distinct: 8 }, { key: 'creation_date', distinct: 40 }],
    DARK_EDGE_PALETTE.length,
    RELATION_TYPE_COLOR_KEY,
  ),
  'data',
);

const spreadCounts = [{ key: 'pillar', distinct: 4 }];
assert.equal(
  resolveUntouchedColorKey({
    storedKey: NODE_TYPE_COLOR_KEY,
    sentinel: NODE_TYPE_COLOR_KEY,
    userChose: false,
    hasCustomColor: false,
    counts: spreadCounts,
    paletteSize: PASTEL_NODE_PALETTE.length,
  }),
  'pillar',
);
assert.equal(
  resolveUntouchedColorKey({
    storedKey: NODE_TYPE_COLOR_KEY,
    sentinel: NODE_TYPE_COLOR_KEY,
    userChose: true,
    hasCustomColor: false,
    counts: spreadCounts,
    paletteSize: PASTEL_NODE_PALETTE.length,
  }),
  NODE_TYPE_COLOR_KEY,
);
assert.equal(
  resolveUntouchedColorKey({
    storedKey: 'business_function',
    sentinel: NODE_TYPE_COLOR_KEY,
    userChose: false,
    hasCustomColor: false,
    counts: [
      { key: 'business_function', distinct: 6, covered: 10 },
      { key: 'pillar', distinct: 4, covered: 100 },
    ],
    paletteSize: PASTEL_NODE_PALETTE.length,
  }),
  'pillar',
);
assert.equal(
  resolveUntouchedColorKey({
    storedKey: 'business_function',
    sentinel: NODE_TYPE_COLOR_KEY,
    userChose: true,
    hasCustomColor: false,
    counts: [
      { key: 'business_function', distinct: 6, covered: 10 },
      { key: 'pillar', distinct: 4, covered: 100 },
    ],
    paletteSize: PASTEL_NODE_PALETTE.length,
  }),
  'business_function',
);

const painted = paintChannelColors({
  colors: { appFill: { Retail: '#112233' } },
  fillKey: 'pillar',
  fillValues: ['Payments', 'Retail'],
  strokeKey: 'data',
  strokeValues: ['cash flows', 'price'],
});
assert.equal(painted.appFill?.Payments, PASTEL_NODE_PALETTE[0]);
assert.equal(painted.appFill?.Retail, '#112233');
assert.equal(painted.edgeStroke?.['cash flows'], DARK_EDGE_PALETTE[0]);
assert.equal(painted.edgeStroke?.price, DARK_EDGE_PALETTE[1]);
const typed = paintChannelColors({
  fillKey: NODE_TYPE_COLOR_KEY,
  fillValues: ['Application'],
  strokeKey: RELATION_TYPE_COLOR_KEY,
  strokeValues: ['DEPENDS_ON'],
});
assert.equal(typed.appFill, undefined);
assert.equal(typed.edgeStroke, undefined);

assert.equal(
  resolveMirroredKey({ storedKey: 'frequency', mirrorKey: 'data', userChose: false }),
  'data',
);
assert.equal(
  resolveMirroredKey({ storedKey: 'frequency', mirrorKey: 'data', userChose: true }),
  'frequency',
);

const fill = PASTEL_NODE_PALETTE[0];
assert.equal(nodeBorderColorForValue('pillar', 'Payments', undefined, 'pillar', { Payments: fill }), borderFromFill(fill));
assert.equal(
  nodeBorderColorForValue('pillar', 'Payments', { Payments: '#112233' }, 'pillar', { Payments: fill }),
  '#112233',
);

const mirrored = resolveSpreadColorKeys({
  nodes: [
    { id: '1', label: 'A', type: 'Application', properties: { pillar: 'Payments' } },
    { id: '2', label: 'B', type: 'Application', properties: { pillar: 'Risk' } },
  ] as never,
  edges: [
    {
      id: 'e1',
      sourceId: '1',
      targetId: '2',
      type: 'DEPENDS_ON',
      properties: { data: 'price' },
    },
  ] as never,
  fillKey: NODE_TYPE_COLOR_KEY,
  borderKey: NODE_TYPE_COLOR_KEY,
  strokeKey: RELATION_TYPE_COLOR_KEY,
  fillChosen: false,
  borderChosen: false,
  strokeChosen: false,
});
assert.equal(mirrored.borderKey, mirrored.fillKey);
assert.notEqual(mirrored.borderKey, NODE_TYPE_COLOR_KEY);

const borderSticky = resolveSpreadColorKeys({
  nodes: [
    {
      id: '1',
      label: 'A',
      type: 'Application',
      properties: { pillar: 'Payments', tier: 'gold' },
    },
    {
      id: '2',
      label: 'B',
      type: 'Application',
      properties: { pillar: 'Risk', tier: 'silver' },
    },
  ] as never,
  edges: [],
  fillKey: 'pillar',
  borderKey: 'tier',
  strokeKey: RELATION_TYPE_COLOR_KEY,
  fillChosen: true,
  borderChosen: true,
  strokeChosen: true,
});
assert.equal(borderSticky.fillKey, 'pillar');
assert.equal(borderSticky.borderKey, 'tier');

console.log('graphPalette.check: ok');
