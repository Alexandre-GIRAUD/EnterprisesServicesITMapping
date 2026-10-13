/**
 * Runnable self-check for sandbox save/share layout.
 * Run: npx --yes tsx src/features/map/components/SandboxesPanel.check.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SandboxesPanel } from './SandboxesPanel.tsx';
import type { SavedSandboxMeta } from '../utils/sandboxDocuments.ts';

const saved = {
  id: 'saved-1',
  name: 'Payroll',
  updatedAt: '2026-01-01T00:00:00.000Z',
  document: { id: 'saved-1', name: 'Payroll' },
} as SavedSandboxMeta;

const html = renderToStaticMarkup(
  createElement(SandboxesPanel, {
    openSandboxes: [{ id: 'open-1', name: 'Draft', dirty: true }],
    activeSandboxId: 'open-1',
    onFocusOpen: () => undefined,
    layoutMode: 'horizontal',
    onLayoutModeChange: () => undefined,
    onNewSandbox: () => undefined,
    onSaveActive: () => undefined,
    canSave: true,
    savedSandboxes: [saved],
    sandboxFolders: [],
    onLoadSandbox: () => undefined,
    onDeleteSavedSandbox: () => undefined,
    onCreateSandboxFolder: () => undefined,
    onRenameSandboxFolder: () => undefined,
    onDeleteSandboxFolder: () => undefined,
    onMoveSandboxFolder: () => undefined,
    onRenameSavedSandbox: () => undefined,
    onMoveSavedSandbox: () => undefined,
    onShareActive: async () => undefined,
  }),
);

const [beforeSaved, afterSaved] = html.split('>Saved<');
assert.ok(beforeSaved && afterSaved, 'Saved section missing');
assert.match(beforeSaved, />Save</);
assert.match(beforeSaved, />Share</);
assert.match(beforeSaved, /Draft/);
assert.match(html, />New folder</);
assert.doesNotMatch(html, />Payroll</);
assert.doesNotMatch(html, />Load</);
assert.doesNotMatch(afterSaved, />Share</);

console.log('SandboxesPanel.check: ok');
