/**
 * Flow labels stay readable at every zoom, like the application title.
 * Run: npx --yes tsx src/features/map/components/flowLabel.check.ts
 */
import assert from 'node:assert/strict';
import {
  APPLICATION_TITLE_FONT_SIZE_PX,
  buildFlowLabelMapTransform,
  isFlowLabelVisible,
} from './flowLabel.ts';

const labelX = 40;
const labelY = 80;
const applicationTitleFontSizePx = 12;
const shownLabel = { text: 'Billing', shouldHideLabels: false, isIndirect: false, isEditing: false };

assert.equal(isFlowLabelVisible(shownLabel), true);

assert.equal(APPLICATION_TITLE_FONT_SIZE_PX, applicationTitleFontSizePx);

assert.equal(
  buildFlowLabelMapTransform(labelX, labelY),
  `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
);

assert.equal(isFlowLabelVisible({ ...shownLabel, shouldHideLabels: true }), false);

assert.equal(isFlowLabelVisible({ ...shownLabel, isIndirect: true }), false);

assert.equal(isFlowLabelVisible({ ...shownLabel, text: '   ' }), false);

assert.equal(isFlowLabelVisible({ ...shownLabel, text: '', isEditing: true }), true, 'an empty label can be given a name');

console.log('flowLabel.check: ok');
