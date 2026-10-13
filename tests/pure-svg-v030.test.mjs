import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const engineUrl = '../studies/pure-svg/v030/engine.mjs';

test('Pure SVG v030 begins as one deterministic negative-space contour', async () => {
  const { buildFrame, GATE_COUNT, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'negative-reply');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.gates.length, GATE_COUNT);
  assert.equal(frame.gates.every((gate) => gate.pathSignature.startsWith('M') && gate.pathSignature.includes('Z')), true);
  assert.match(frame.contourPath, /M/);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Pure SVG v030 keeps a local crossing inert until a distant gate replies', async () => {
  const { armGate, applyReply, buildFrame, geometrySignature } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const armed = armGate(baseline, { x: 0.19, y: 0.26 });
  const refused = applyReply(armed, { x: 0.19, y: 0.26 });
  const replied = applyReply(armed, { x: 0.81, y: 0.73 });

  assert.equal(armed.interaction, 'crossing-armed');
  assert.equal(armed.memory.length, 0);
  assert.equal(geometrySignature(armed), geometrySignature(baseline));
  assert.equal(refused.interaction, 'reply-refused-same-gate');
  assert.equal(refused.memory.length, 0);
  assert.equal(replied.interaction, 'remote-reply');
  assert.equal(replied.memory.length, 1);
  assert.equal(replied.event.committed, true);
  assert.notEqual(replied.event.source, replied.event.target);
  assert.notEqual(replied.gates[replied.event.source].pathSignature, baseline.gates[replied.event.source].pathSignature);
  assert.notEqual(replied.gates[replied.event.target].pathSignature, baseline.gates[replied.event.target].pathSignature);
  assert.notEqual(replied.gates[replied.event.relay].pathSignature, baseline.gates[replied.event.relay].pathSignature);
  assert.notEqual(replied.contourPath, baseline.contourPath);
});

test('Pure SVG v030 carries topological reply memory, lifts exactly, and releases to seed', async () => {
  const { applyReply, armGate, buildFrame, geometrySignature, liftLatestReply, releaseContour } = await import(engineUrl);
  let frame = buildFrame(4, []);
  frame = applyReply(armGate(frame, { x: 0.19, y: 0.26 }), { x: 0.81, y: 0.73 });
  const first = frame;
  frame = applyReply(armGate(frame, { x: 0.73, y: 0.2 }), { x: 0.27, y: 0.78 });
  const second = frame;
  const lifted = liftLatestReply(second);
  const released = releaseContour();

  assert.equal(second.memory.length, 2);
  assert.notEqual(second.event.relay, undefined);
  assert.notEqual(geometrySignature(second), geometrySignature(first));
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame(0, [])));
});

test('Pure SVG v030 bounds the number of remembered replies', async () => {
  const { applyReply, buildTimeline, MEMORY_WINDOW } = await import(engineUrl);
  const settled = buildTimeline().at(-1);
  const refused = applyReply(settled, { x: 0.5, y: 0.5 });

  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(refused.interaction, 'reply-memory-full');
  assert.equal(refused.event.committed, false);
});

test('Pure SVG v030 publishes a self-contained drag tableau with equivalent keyboard paths', async () => {
  const tableau = await read('studies/pure-svg/v030/index.html');
  const sketch = await read('studies/pure-svg/v030/sketch.js');
  const style = await read('studies/pure-svg/v030/style.css');
  const readme = await read('studies/pure-svg/v030/README.md');
  const metrics = JSON.parse(await read('studies/pure-svg/v030/metrics.json'));
  const critiques = JSON.parse(await read('studies/pure-svg/v030/critiques.json'));

  assert.match(tableau, /<svg[^>]+id="field"/);
  assert.match(tableau, /data-gesture="cross"/);
  assert.match(tableau, /tabindex="0"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /Escape|toLowerCase\(\) === 'r'/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width:680px\)/);
  assert.match(readme, /falsifier/i);
  assert.equal(metrics.seed, '0x53564730');
  assert.equal(critiques.length, 6);
});

test('Pure SVG v030 is registered exactly once for the 2026-10-13 daily slot', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matches = register.works.filter((work) => work.id === 'svg-2026-10-13');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].currentId, 'svg');
  assert.equal(matches[0].date, '2026-10-13');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v030/');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.equal(matches[0].status, 'candidate / held');
});
