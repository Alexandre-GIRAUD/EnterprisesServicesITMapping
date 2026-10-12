/**
 * Runnable self-check for the sandbox canvas menu.
 * Run: npx --yes tsx src/features/map/components/SandboxCanvasMenu.check.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SandboxCanvasMenu } from './SandboxCanvasMenu.tsx';

const noop = () => undefined;

function labels(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, '').trim(),
  );
}

const actions = labels(
  renderToStaticMarkup(
    createElement(SandboxCanvasMenu, {
      sharing: false,
      username: '',
      onUsernameChange: noop,
      onSubmitShare: noop,
      onCancelShare: noop,
      onDuplicate: noop,
      onRename: noop,
      onSave: noop,
      onStartShare: noop,
      onClose: noop,
      onNewSandbox: noop,
      onAddNode: noop,
      onAddEdge: noop,
      onAddText: null,
      recentIcons: [],
      onPickRecentIcon: noop,
    }),
  ),
);

const saveIndex = actions.indexOf('Save');
assert.equal(actions[saveIndex + 1], 'Share');

const shareForm = renderToStaticMarkup(
  createElement(SandboxCanvasMenu, {
    sharing: true,
    username: '',
    onUsernameChange: noop,
    onSubmitShare: noop,
    onCancelShare: noop,
    onDuplicate: noop,
    onRename: noop,
    onSave: noop,
    onStartShare: noop,
    onClose: noop,
    onNewSandbox: noop,
    onAddNode: noop,
    onAddEdge: noop,
    onAddText: null,
    recentIcons: [],
    onPickRecentIcon: noop,
  }),
);

assert.match(shareForm, /aria-label="Username"/);
assert.deepEqual(labels(shareForm), ['Send']);
assert.doesNotMatch(shareForm, />Save</);

console.log('SandboxCanvasMenu.check: ok');
