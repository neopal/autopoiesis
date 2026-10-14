import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const engineUrl = '../studies/pure-svg/v031/engine.mjs';

test('Pure SVG v031 begins as one spare articulated line with deterministic joints', async () => {
  const { buildFrame, JOINT_COUNT, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'misheard-line');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.joints.length, JOINT_COUNT);
  assert.equal(frame.route.length, JOINT_COUNT);
  assert.match(frame.linePath, /^M/);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
  assert.equal(frame.joints.every((joint) => joint.pathSignature.startsWith('M')), true);
});

test('Pure SVG v031 keeps the first attention inert until a distant second joint is offered', async () => {
  const { attendJoint, applyMishearing, buildFrame, geometrySignature } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const attended = attendJoint(baseline, { x: 0.18, y: 0.32 });
  const refused = applyMishearing(attended, { x: 0.18, y: 0.32 });
  const misheard = applyMishearing(attended, { x: 0.79, y: 0.32 });

  assert.equal(attended.interaction, 'attention-held');
  assert.equal(attended.memory.length, 0);
  assert.equal(geometrySignature(attended), geometrySignature(baseline));
  assert.equal(refused.interaction, 'mishearing-refused-same-joint');
  assert.equal(refused.memory.length, 0);
  assert.equal(misheard.interaction, 'line-misheard');
  assert.equal(misheard.memory.length, 1);
  assert.equal(misheard.event.committed, true);
  assert.notEqual(misheard.event.observer, misheard.event.counter);
  assert.notEqual(misheard.event.witness, misheard.event.observer);
  assert.notEqual(misheard.event.witness, misheard.event.counter);
  assert.notDeepEqual(misheard.route, baseline.route);
  assert.notEqual(misheard.linePath, baseline.linePath);
});

test('Pure SVG v031 gives the unoffered witness the visible reroute', async () => {
  const { applyMishearing, attendJoint, buildFrame } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const result = applyMishearing(attendJoint(baseline, { x: 0.18, y: 0.32 }), { x: 0.79, y: 0.32 });
  const witness = result.joints[result.event.witness];
  const observer = result.joints[result.event.observer];
  const counter = result.joints[result.event.counter];

  assert.equal(witness.witnessLoad > 0, true);
  assert.equal(observer.tension > 0, true);
  assert.equal(counter.tension > 0, true);
  assert.match(result.linePath, /Q/);
});

test('Pure SVG v031 retains a bounded mishearing ledger, lifts exactly, and releases', async () => {
  const { applyMishearing, attendJoint, buildFrame, buildTimeline, geometrySignature, liftLatestMishearing, releaseLine, MEMORY_WINDOW } = await import(engineUrl);
  let frame = buildFrame(0, []);
  frame = applyMishearing(attendJoint(frame, { x: 0.18, y: 0.32 }), { x: 0.79, y: 0.32 });
  const first = frame;
  frame = applyMishearing(attendJoint(frame, { x: 0.64, y: 0.18 }), { x: 0.19, y: 0.5 });
  const second = frame;
  const lifted = liftLatestMishearing(second);
  const released = releaseLine();
  const settled = buildTimeline().at(-1);

  assert.equal(second.memory.length, 2);
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame(0, [])));
  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.route.length, settled.joints.length);
});

test('Pure SVG v031 refuses an adjacent second joint and a fifth memory event', async () => {
  const { applyMishearing, attendJoint, buildFrame, buildTimeline } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const adjacent = applyMishearing(attendJoint(baseline, { x: 0.18, y: 0.32 }), { x: 0.31, y: 0.22 });
  const full = buildTimeline();
  const settled = full.at(-1);
  const refused = applyMishearing(attendJoint(settled, { x: 0.18, y: 0.32 }), { x: 0.79, y: 0.32 });

  assert.equal(adjacent.interaction, 'mishearing-refused-adjacent');
  assert.equal(adjacent.memory.length, 0);
  assert.equal(refused.interaction, 'mishearing-memory-full');
  assert.equal(refused.event.committed, false);
});

test('Pure SVG v031 publishes a self-contained line tableau with equivalent pointer and keyboard paths', async () => {
  const tableau = await read('studies/pure-svg/v031/index.html');
  const sketch = await read('studies/pure-svg/v031/sketch.js');
  const style = await read('studies/pure-svg/v031/style.css');
  const readme = await read('studies/pure-svg/v031/README.md');
  const metrics = JSON.parse(await read('studies/pure-svg/v031/metrics.json'));
  const critiques = JSON.parse(await read('studies/pure-svg/v031/critiques.json'));

  assert.match(tableau, /<svg[^>]+id="field"/);
  assert.match(tableau, /data-gesture="attend"/);
  assert.match(tableau, /data-gesture="mishear"/);
  assert.match(tableau, /tabindex="0"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /Escape|toLowerCase\(\) === 'r'/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width:680px\)/);
  assert.match(readme, /falsifier/i);
  assert.equal(metrics.seed, '0x53564731');
  assert.equal(metrics.grammar, 'misheard-line');
  assert.equal(critiques.length, 6);
});

test('Pure SVG v031 is registered exactly once for the 2026-10-14 daily slot', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matches = register.works.filter((work) => work.id === 'svg-2026-10-14');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].currentId, 'svg');
  assert.equal(matches[0].date, '2026-10-14');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v031/');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.equal(matches[0].status, 'candidate / held');
});
