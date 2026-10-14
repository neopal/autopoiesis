import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const {
  MEMORY_LIMIT,
  REGISTER_COUNT,
  buildFrame,
  selectRegister,
  commitPair,
  liftLatest,
  releaseRegisters,
  geometrySignature,
  buildTimeline
} = await import('../studies/self-portrait/v027/engine.mjs');

test('portrait v027 refuses a solitary input and commits only a pair', () => {
  const baseline = buildFrame(0);
  const first = selectRegister(baseline, 1);
  const second = selectRegister(first, 4);

  assert.equal(geometrySignature(first), geometrySignature(baseline), 'a single register must not alter the raster portrait');
  assert.deepEqual(first.pendingRegisters, [1]);
  assert.equal(first.memory.length, 0);
  assert.equal(second.memory.length, 0);
  assert.deepEqual(second.pendingRegisters, [1, 4]);
  assert.equal(geometrySignature(second), geometrySignature(baseline));
});

test('portrait v027 makes its own counter-reading from the chosen pair', () => {
  const baseline = buildFrame(2);
  const armed = selectRegister(selectRegister(baseline, 1), 4);
  const committed = commitPair(armed);
  const event = committed.memory.at(-1);

  assert.equal(event.source, 'visitor-pair');
  assert.equal(event.kind, 'counter-reading');
  assert.deepEqual(event.pair, [1, 4]);
  assert.ok(Number.isInteger(event.counterIndex));
  assert.ok(!event.pair.includes(event.counterIndex), 'the portrait must answer from an unchosen register');
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
  assert.equal(committed.registers[event.counterIndex].state, 'counter');
  assert.ok(committed.registers.some((register) => register.state === 'selected'));
  assert.ok(committed.registers.some((register) => register.state === 'residue'));
});

test('portrait v027 remembers the pair and changes the next counter-reading', () => {
  const baseline = buildFrame(3);
  const first = commitPair(selectRegister(selectRegister(baseline, 0), 3));
  const second = commitPair(selectRegister(selectRegister(first, 0), 3));

  assert.ok(second.memory.at(-1).historyBefore >= 1);
  assert.notEqual(second.memory.at(-1).counterIndex, first.memory.at(-1).counterIndex);
  assert.equal(second.memory.length, 2);
});

test('portrait v027 bounds memory and lifts the exact preceding raster state', () => {
  let frame = buildFrame(1);
  const signatures = [geometrySignature(frame)];
  for (let index = 0; index < 8; index += 1) {
    frame = commitPair(selectRegister(selectRegister(frame, index % REGISTER_COUNT), (index + 3) % REGISTER_COUNT));
    signatures.push(geometrySignature(frame));
  }

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.commits.length, MEMORY_LIMIT);
  assert.ok(frame.registers.some((register) => register.state === 'counter'));
  assert.ok(frame.registers.some((register) => register.state === 'residue'));
  const restored = liftLatest(frame);
  assert.equal(geometrySignature(restored), signatures.at(-2), 'lifting must reconstruct the exact previous raster state');
});

test('portrait v027 timeline settles into a deterministic counterportrait', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, 15);
  assert.equal(settled.stage, 14);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.commits.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(buildTimeline().at(-1)), geometrySignature(settled));
});

test('portrait v027 exposes a canvas counterportrait with pair controls and reduced-motion support', async () => {
  const html = await read('studies/self-portrait/v027/index.html');
  const sketch = await read('studies/self-portrait/v027/sketch.js');
  const style = await read('studies/self-portrait/v027/style.css');
  const readme = await read('studies/self-portrait/v027/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v027/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v027/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-10-14"/);
  assert.match(html, /id="counterportrait-canvas"/);
  assert.match(html, /data-register="0"/);
  assert.match(html, /data-action="commit"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /selectRegister/);
  assert.match(sketch, /commitPair/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /counter-reading/);
  assert.match(sketch, /prefers-reduced-motion/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.measured, true);
  assert.equal(metrics.renderer, 'deterministic raster counterportrait');
  assert.match(metrics.memoryRule, /pair|counter/i);
  assert.equal(critiques.length, 6);
});

test('portrait v027 is the unique 2026-10-14 daily work with a canonical page', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-10-14');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-10-14');
  assert.equal(work.rawPath, '/studies/self-portrait/v027/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-10-14');
  assert.equal(work.decision.lineage, 'portrait-2026-10-13');
  assert.equal(work.source.referenceId, 'little-critters');

  const canonical = await read('works/portrait-2026-10-14/index.html');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-14"/);
});

test('portrait v027 static and blind modes preserve the settled canvas without furniture', async () => {
  const html = await read('studies/self-portrait/v027/index.html');
  const sketch = await read('studies/self-portrait/v027/sketch.js');
  assert.match(html, /blind-mode/);
  assert.match(sketch, /staticPreview/);
  assert.match(sketch, /window\.__mutinePortraitV027/);
});
