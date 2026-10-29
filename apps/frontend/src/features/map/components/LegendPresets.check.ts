/**
 * Legend presets bar, value chips and the reusable name dialog.
 * Run: npx --yes tsx src/features/map/components/LegendPresets.check.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegendPresetBar } from './LegendPresetBar.tsx';
import { LegendValueChips } from './LegendValueChips.tsx';
import { SaveSnapshotDialog } from './SaveSnapshotDialog.tsx';

const noop = () => undefined;
const setup = (id: string, name: string) => ({
  id,
  name,
  colors: {},
  appFillKey: 'a',
  appBorderKey: 'a',
  appTextKey: 'a',
  edgeColorKey: 'a',
  edgeLabelKey: 'a',
});

const bar = renderToStaticMarkup(
  createElement(LegendPresetBar, {
    setups: [setup('1', 'Risk view'), setup('2', 'Owners')],
    onApply: noop,
    onDelete: noop,
    onSave: noop,
  }),
);
assert.match(bar, /aria-label="Legend presets"/);
assert.match(bar, />Risk view</);
assert.match(bar, />Owners</);
assert.match(bar, /aria-label="Save legend preset"/);
assert.doesNotMatch(bar, /<input/);
assert.doesNotMatch(bar, /Save legend</);
assert.match(bar, />Save as new preset…</);

const emptyBar = renderToStaticMarkup(
  createElement(LegendPresetBar, { setups: [], onApply: noop, onDelete: noop, onSave: noop }),
);
assert.match(emptyBar, /<select[^>]*disabled/);

const chips = renderToStaticMarkup(
  createElement(LegendValueChips, {
    chips: [
      { value: 'High', label: 'High', color: '#ff0000' },
      { value: 'Low', label: 'Low', color: '#00ff00' },
    ],
    onChange: noop,
  }),
);
assert.match(chips, /aria-label="Color for High"/);
assert.match(chips, /aria-label="Color for Low"/);
assert.equal((chips.match(/type="color"/g) ?? []).length, 2);
assert.doesNotMatch(chips, /graph-legend__swatch/);

const presetDialog = renderToStaticMarkup(
  createElement(SaveSnapshotDialog, {
    isOpen: true,
    onClose: noop,
    onSave: async () => undefined,
    title: 'Save legend preset',
  }),
);
assert.match(presetDialog, /Save legend preset/);
assert.doesNotMatch(presetDialog, /Pin view/);
const pinDialog = renderToStaticMarkup(
  createElement(SaveSnapshotDialog, { isOpen: true, onClose: noop, onSave: async () => undefined }),
);
assert.match(pinDialog, /Pin view/);

console.log('LegendPresets.check: ok');
