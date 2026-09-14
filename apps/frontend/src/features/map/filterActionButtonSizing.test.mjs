import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const FRONTEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const STYLESHEET_PATH = join(FRONTEND_ROOT, 'src/index.css');

/**
 * Extract a CSS rule body for a selector that appears in the stylesheet.
 * Uses the first `{...}` block after the selector; good enough for this contract.
 */
function ruleBodyFor(stylesheet, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stylesheet.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected CSS rule for selector: ${selector}`);
  return match[1];
}

function declares(body, property, valueSubstring) {
  const pattern = new RegExp(
    `${property}\\s*:\\s*[^;]*${valueSubstring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'i'
  );
  return pattern.test(body);
}

test('compact action buttons share equal width and height sizing', () => {
  const stylesheet = readFileSync(STYLESHEET_PATH, 'utf8');
  const body = ruleBodyFor(stylesheet, '.graph-filter-compact-actions .graph-filter-compact-btn');

  assert.ok(
    declares(body, 'flex', '1 1 0') || declares(body, 'flex', '1 1 0%'),
    'action buttons must share equal flex basis so widths match within a row'
  );
  assert.ok(
    declares(body, 'min-height', '') || declares(body, 'height', ''),
    'action buttons must declare a shared height (min-height or height)'
  );
  assert.ok(
    declares(body, 'box-sizing', 'border-box'),
    'equal boxes require border-box so padding does not break height equality'
  );
  assert.ok(
    declares(body, 'min-width', '0'),
    'min-width:0 allows flex to equalize past content-sized minima'
  );
});

test('pin variant does not override action-row width or horizontal padding', () => {
  const stylesheet = readFileSync(STYLESHEET_PATH, 'utf8');
  const pinBodies = [
    ...stylesheet.matchAll(/\.graph-filter-compact-btn--pin[^{]*\{([^}]*)\}/g),
  ].map((match) => match[1]);

  assert.ok(pinBodies.length > 0, 'expected at least one pin button rule');

  for (const body of pinBodies) {
    assert.equal(
      /min-width\s*:/i.test(body),
      false,
      'pin variant must not set min-width (breaks equal width with Clear/Apply)'
    );
    assert.equal(
      /padding-left\s*:/i.test(body),
      false,
      'pin variant must not set padding-left (breaks equal width)'
    );
    assert.equal(
      /padding-right\s*:/i.test(body),
      false,
      'pin variant must not set padding-right (breaks equal width)'
    );
  }
});
