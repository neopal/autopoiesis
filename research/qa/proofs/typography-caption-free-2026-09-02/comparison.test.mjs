import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCaptionFreeComparison } from './comparison.mjs';

test('caption-free comparison removes one scar while preserving a repeatable late route difference', () => {
  const comparison = buildCaptionFreeComparison();
  const replay = buildCaptionFreeComparison();

  assert.equal(comparison.stage, 3);
  assert.equal(comparison.intactMemoryCount, 9);
  assert.equal(comparison.deletedMemoryCount, 8);
  assert.equal(comparison.changedPointCount, 5);
  assert.deepEqual(comparison.changedPointIndices, [
    { routeIndex: 3, pointIndex: 2 },
    { routeIndex: 3, pointIndex: 3 },
    { routeIndex: 3, pointIndex: 4 },
    { routeIndex: 3, pointIndex: 5 },
    { routeIndex: 3, pointIndex: 6 }
  ]);
  assert.deepEqual(comparison.panels[0].routes.slice(0, 3), comparison.panels[1].routes.slice(0, 3));
  assert.deepEqual(comparison.panels[0].routes[3].points.slice(0, 2), comparison.panels[1].routes[3].points.slice(0, 2));
  assert.ok(comparison.changedPointIndices.every(({ routeIndex, pointIndex }) => routeIndex === 3 && pointIndex >= 2));
  assert.deepEqual(comparison.panels, replay.panels);
  assert.ok(comparison.panels.every((panel) => panel.routes.length === 11));
  assert.ok(comparison.panels.every((panel) => panel.routes.every((route) => route.points.length === 7)));
});
