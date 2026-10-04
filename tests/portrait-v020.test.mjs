import test from 'node:test';
import assert from 'node:assert/strict';

test('portrait v020 makes measured pressure choose a real material yield and restores it exactly', async () => {
  const {
    buildFrame,
    armPressure,
    commitPressure,
    liftLatestYield,
    geometrySignature
  } = await import('../studies/self-portrait/v020/engine.mjs');

  const baseline = buildFrame(0, []);
  const armed = armPressure(baseline);
  const changed = commitPressure(armed, { pressure: 0.92 });
  const event = changed.memory.at(-1);
  const restored = liftLatestYield(changed);

  assert.equal(armed.memory.length, 0, 'pressure preview must not write history');
  assert.equal(changed.memory.length, 1);
  assert.equal(event.source, 'measured-pressure');
  assert.equal(event.kind, 'material-yield');
  assert.ok(changed.ribs[event.ribIndex].gap > baseline.ribs[event.ribIndex].gap, 'yield must open a real geometric void');
  assert.ok(changed.ribs.some((rib) => rib.load > baseline.ribs[rib.index].load), 'yield must redistribute material load');
  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(geometrySignature(restored), geometrySignature(baseline), 'lifting the latest yield must restore the exact prior relief');
});

test('portrait v020 lets resistance change the next yield while bounding material memory', async () => {
  const { MEMORY_LIMIT, buildFrame, commitPressure, buildTimeline } = await import('../studies/self-portrait/v020/engine.mjs');
  let frame = buildFrame(0, []);
  const first = commitPressure(frame, { pressure: 0.92 });
  const second = commitPressure(first, { pressure: 0.92 });
  frame = second;
  for (let index = 0; index < 6; index += 1) frame = commitPressure(frame, { pressure: 0.92 });
  const settled = buildTimeline().at(-1);

  assert.notEqual(second.memory.at(-1).ribIndex, first.memory.at(-1).ribIndex, 'resistance must redirect a repeated pressure event');
  assert.ok(second.memory.at(-1).resistanceBefore > first.memory.at(-1).resistanceBefore);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.ok(settled.ribs.filter((rib) => rib.gap > 0).length >= 3, 'bounded history should leave several visible yielded ribs');
});

test('portrait v020 ships a browser tableau with measured hold, reversible controls, and deterministic state', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const files = [
    'studies/self-portrait/v020/index.html',
    'studies/self-portrait/v020/sketch.js',
    'studies/self-portrait/v020/style.css',
    'studies/self-portrait/v020/README.md',
    'studies/self-portrait/v020/metrics.json',
    'studies/self-portrait/v020/critiques.json'
  ];
  for (const path of files) await access(new URL(`../${path}`, import.meta.url));
  const html = await readFile(new URL('../studies/self-portrait/v020/index.html', import.meta.url), 'utf8');
  const sketch = await readFile(new URL('../studies/self-portrait/v020/sketch.js', import.meta.url), 'utf8');
  assert.match(html, /<canvas[^>]+id="yield-field"/);
  assert.match(html, /data-gesture="press"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /commitPressure/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keyup/);
  assert.match(sketch, /pointer-tap-refused/);
  assert.match(sketch, /__mutinePortraitV020/);
});

test('portrait v020 has one honest daily record and a canonical work route', async () => {
  const { access, readFile } = await import('node:fs/promises');
  await access(new URL('../works/portrait-2026-10-04/index.html', import.meta.url));
  const read = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const works = await read('studio/data/works.json');
  const matches = works.works.filter((work) => work.currentId === 'portrait' && work.date === '2026-10-04');
  assert.equal(matches.length, 1);
  const record = matches[0];
  assert.equal(record.id, 'portrait-2026-10-04');
  assert.equal(record.rawPath, '/studies/self-portrait/v020/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-portrait-2026-10-04');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /pressure|resistance|yield/i);
  assert.ok(record.critiques.length >= 5);
});
