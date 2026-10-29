/**
 * Flow labels never overlap each other or a node they do not belong to.
 * Run: npx --yes tsx src/features/map/components/labelPlacement.check.ts
 */
import assert from 'node:assert/strict';
import { placeEdgeLabels, type LabelRequest } from './labelPlacement.ts';

type Box = { x: number; y: number; width: number; height: number };

function boxAt(center: { x: number; y: number }, request: LabelRequest): Box {
  return {
    x: center.x - request.width / 2,
    y: center.y - request.height / 2,
    width: request.width,
    height: request.height,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function request(id: string, points: LabelRequest['points'], overrides: Partial<LabelRequest> = {}): LabelRequest {
  return { id, points, width: 80, height: 20, sourceId: 's', targetId: 't', ...overrides };
}

function assertNoLabelOverlap(requests: LabelRequest[], positions: Map<string, { x: number; y: number }>): void {
  assert.equal(positions.size, requests.length);
  for (let i = 0; i < requests.length; i++) {
    for (let j = i + 1; j < requests.length; j++) {
      const a = boxAt(positions.get(requests[i].id)!, requests[i]);
      const b = boxAt(positions.get(requests[j].id)!, requests[j]);
      assert.ok(!overlaps(a, b), `${requests[i].id} overlaps ${requests[j].id}`);
    }
  }
}

// A lone label sits on the middle of its route.
const lone = request('a', [{ x: 0, y: 0 }, { x: 200, y: 0 }]);
assert.deepEqual(placeEdgeLabels([lone], []).get('a'), { x: 100, y: 0 });

// Two flows with the very same route get separate labels.
const twins = [
  request('a', [{ x: 0, y: 0 }, { x: 200, y: 0 }]),
  request('b', [{ x: 0, y: 0 }, { x: 200, y: 0 }]),
];
assertNoLabelOverlap(twins, placeEdgeLabels(twins, []));

// Many flows crossing at one spot still never overlap.
const crowd = Array.from({ length: 12 }, (_, index) =>
  request(`e${index}`, [{ x: 100, y: -100 }, { x: 100, y: 100 }]),
);
assertNoLabelOverlap(crowd, placeEdgeLabels(crowd, []));

// A label stays out of a node that is not its own source or target...
const blocker = { id: 'other', x: 60, y: -30, width: 80, height: 60 };
const avoider = request('a', [{ x: 0, y: 0 }, { x: 200, y: 0 }]);
const avoided = placeEdgeLabels([avoider], [blocker]).get('a')!;
assert.ok(!overlaps(boxAt(avoided, avoider), blocker));

// ...but may sit on its own endpoint node.
const own = { id: 's', x: 60, y: -30, width: 80, height: 60 };
assert.deepEqual(placeEdgeLabels([avoider], [own]).get('a'), { x: 100, y: 0 });

// The result does not depend on the order the flows are given in.
const forward = placeEdgeLabels(twins, []);
const backward = placeEdgeLabels([...twins].reverse(), []);
assert.deepEqual(forward.get('a'), backward.get('a'));
assert.deepEqual(forward.get('b'), backward.get('b'));

console.log('labelPlacement.check: ok');
