import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecomposedPair } from './recomposition.mjs';

test('the disposable study amplifies only the memory consequence and keeps the door attached', () => {
  const { intact, deleted } = buildRecomposedPair();
  const doorDelta = Math.abs(deleted.scene.door.x - intact.scene.door.x);
  const pathDelta = Math.abs(deleted.scene.pathBend - intact.scene.pathBend);

  assert.ok(doorDelta >= 0.01, `door delta should be legible, received ${doorDelta}`);
  assert.ok(pathDelta >= 0.07, `path delta should be legible, received ${pathDelta}`);
  for (const frame of [intact, deleted]) {
    const left = frame.scene.houseX - frame.scene.houseWidth / 2;
    const right = frame.scene.houseX + frame.scene.houseWidth / 2;
    assert.ok(frame.scene.door.x >= left + 0.042, 'door must stay attached inside the house');
    assert.ok(frame.scene.door.x <= right - 0.042, 'door must stay attached inside the house');
  }
  assert.equal(intact.scene.houseX, deleted.scene.houseX, 'house position must remain fixed');
  assert.equal(intact.scene.houseWidth, deleted.scene.houseWidth, 'house scale must remain fixed');
  assert.equal(intact.scene.sun.x, deleted.scene.sun.x, 'sun position must remain fixed');
  assert.equal(intact.scene.tree.x, deleted.scene.tree.x, 'tree position must remain fixed');
});
