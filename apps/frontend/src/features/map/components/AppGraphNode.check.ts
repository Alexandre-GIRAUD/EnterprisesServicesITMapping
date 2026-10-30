/**
 * Box markup: icon beside a centred label, and resize handles.
 * Run: npx --yes tsx src/features/map/components/AppGraphNode.check.ts
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { AppGraphNode } from './AppGraphNode.tsx';

const render = (data: { label: string; nodeType: string; iconKey?: string }, selected = false) =>
  renderToStaticMarkup(
    createElement(
      ReactFlowProvider,
      null,
      createElement(AppGraphNode as never, { id: 'n', data, selected } as never),
    ),
  );

const withIcon = render({ label: 'Core', nodeType: 'Application', iconKey: 'server' });
assert.match(withIcon, /graph-node-card--with-icon/);

const plain = render({ label: 'Core', nodeType: 'Application' });
assert.doesNotMatch(plain, /graph-node-card--with-icon/);

// Resize handles exist on every box (invisible), so the cursor can change on any edge.
assert.match(render({ label: 'Core', nodeType: 'Application' }), /react-flow__resize-control/);

console.log('AppGraphNode.check: ok');
