/**
 * Runnable self-check for the diagram full-screen toggle.
 * Run: npx --yes tsx src/features/map/components/fullscreen.check.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { portalTarget, toggleFullscreen } from './fullscreen.ts';

function fakeDocument(fullscreenElement: unknown = null) {
  const calls: string[] = [];
  const doc = {
    fullscreenElement,
    body: { tag: 'body' },
    exitFullscreen: async () => {
      calls.push('exit');
    },
  };
  return { doc, calls };
}

function fakeElement(calls: string[]) {
  return {
    requestFullscreen: async () => {
      calls.push('enter');
    },
  };
}

const run = async () => {
  const idle = fakeDocument();
  await toggleFullscreen(fakeElement(idle.calls) as never, idle.doc as never);
  assert.deepEqual(idle.calls, ['enter']);

  const element = {} as { requestFullscreen: () => Promise<void> };
  const active = fakeDocument(element);
  element.requestFullscreen = async () => {
    active.calls.push('enter');
  };
  await toggleFullscreen(element as never, active.doc as never);
  assert.deepEqual(active.calls, ['exit']);

  const other = fakeDocument({ other: true });
  await toggleFullscreen(fakeElement(other.calls) as never, other.doc as never);
  assert.deepEqual(other.calls, ['enter']);

  assert.equal(portalTarget(idle.doc as never), idle.doc.body);
  assert.equal(portalTarget(active.doc as never), element);

  const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
  assert.match(css, /\.graph-stage:fullscreen/);
  assert.match(css, /\.module-graph-wrap:fullscreen/);

  console.log('fullscreen.check: ok');
};

void run();
