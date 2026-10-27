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

const belowOldCutoff = 0.2;
const aboveOldCutoff = 1.2;
const labelX = 40;
const labelY = 80;
const applicationTitleFontSizePx = 12;

assert.equal(
  isFlowLabelVisible({
    text: 'Billing',
    zoom: belowOldCutoff,
    shouldHideLabels: false,
    isIndirect: false,
    isHovered: false,
  }),
  true,
);

assert.equal(
  isFlowLabelVisible({
    text: 'Billing',
    zoom: aboveOldCutoff,
    shouldHideLabels: false,
    isIndirect: false,
    isHovered: false,
  }),
  true,
);

assert.equal(APPLICATION_TITLE_FONT_SIZE_PX, applicationTitleFontSizePx);

assert.equal(
  buildFlowLabelMapTransform(labelX, labelY),
  `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
);

assert.equal(
  isFlowLabelVisible({
    text: 'Billing',
    zoom: belowOldCutoff,
    shouldHideLabels: true,
    isIndirect: false,
    isHovered: true,
  }),
  false,
);

assert.equal(
  isFlowLabelVisible({
    text: 'Billing',
    zoom: aboveOldCutoff,
    shouldHideLabels: false,
    isIndirect: true,
    isHovered: false,
  }),
  false,
);

assert.equal(
  isFlowLabelVisible({
    text: '   ',
    zoom: aboveOldCutoff,
    shouldHideLabels: false,
    isIndirect: false,
    isHovered: false,
  }),
  false,
);

console.log('flowLabel.check: ok');
