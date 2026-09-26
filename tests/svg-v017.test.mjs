import test from 'node:test';
import assert from 'node:assert/strict';

const loadEngine = () => import('../studies/pure-svg/v017/engine.mjs');

function topologyShape(frame) {
  return frame.links.map((link) => ({
    id: link.id,
    from: link.from,
    to: link.to,
    visible: link.visible,
    role: link.role
  }));
}

test('pure SVG v017 builds a deterministic irregular loop before any relay', async () => {
  const { buildFrame, ANCHOR_COUNT, PRIMITIVE_BUDGET } = await loadEngine();
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'misremembered-loop');
  assert.equal(frame.anchors.length, ANCHOR_COUNT);
  assert.equal(frame.links.length, ANCHOR_COUNT);
  assert.equal(frame.links.filter((link) => link.visible).length, ANCHOR_COUNT);
  assert.equal(frame.links.filter((link) => link.role === 'base').length, ANCHOR_COUNT);
  assert.equal(frame.cutCount, 0);
  assert.equal(frame.bridgeCount, 0);
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
  assert.equal(frame.topologySignature, buildFrame(0, []).topologySignature);
});

test('pure SVG v017 translates a two-point relay into one real cut and one distant wrong return', async () => {
  const { buildFrame, applyRelay } = await loadEngine();
  const base = buildFrame(4, []);
  const changed = applyRelay(base, { source: 1, target: 6 });

  assert.equal(changed.interaction, 'visitor-relay');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.cutCount, 1);
  assert.equal(changed.bridgeCount, 1);
  assert.equal(changed.links.filter((link) => !link.visible && link.role === 'cut').length, 1);
  assert.equal(changed.links.filter((link) => link.visible && link.role === 'wrong-return').length, 1);
  assert.equal(changed.memory[0].sourceIndex, 1);
  assert.equal(changed.memory[0].targetIndex, 6);
  assert.notEqual(changed.topologySignature, base.topologySignature);
  assert.ok(changed.links.some((link) => link.from === 1 && link.to === 6 && link.role === 'wrong-return'));
});

test('pure SVG v017 lifts the latest relay back to the exact preceding topology', async () => {
  const { buildFrame, applyRelay, removeLatestRelay } = await loadEngine();
  const base = buildFrame(7, []);
  const first = applyRelay(base, { source: 2, target: 7 });
  const second = applyRelay(first, { source: 5, target: 0 });
  const lifted = removeLatestRelay(second);

  assert.deepEqual(topologyShape(lifted), topologyShape(first));
  assert.equal(lifted.topologySignature, first.topologySignature);
  assert.equal(lifted.memory.length, 1);
});

test('pure SVG v017 bounds malformed relay points and never creates a self-return', async () => {
  const { buildFrame, applyRelay } = await loadEngine();
  const changed = applyRelay(buildFrame(2, []), { source: -99, target: 99 });

  assert.equal(changed.memory.length, 1);
  assert.ok(changed.memory[0].sourceIndex >= 0 && changed.memory[0].sourceIndex < changed.anchors.length);
  assert.ok(changed.memory[0].targetIndex >= 0 && changed.memory[0].targetIndex < changed.anchors.length);
  assert.notEqual(changed.memory[0].sourceIndex, changed.memory[0].targetIndex);
  assert.equal(changed.cutCount, 1);
  assert.equal(changed.bridgeCount, 1);
});

test('pure SVG v017 timeline remains bounded and accumulates discrete wrong returns', async () => {
  const { buildTimeline, MEMORY_LIMIT } = await loadEngine();
  const finalFrame = buildTimeline().at(-1);

  assert.equal(finalFrame.memory.length, MEMORY_LIMIT);
  assert.ok(finalFrame.cutCount >= 1);
  assert.equal(finalFrame.bridgeCount, finalFrame.cutCount);
  assert.ok(finalFrame.links.some((link) => link.role === 'wrong-return'));
});
