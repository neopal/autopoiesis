import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

function strandDelta(a, b) {
  return Math.abs(a.x - b.x)
    + Math.abs(a.length - b.length)
    + Math.abs(a.thickness - b.thickness)
    + Math.abs(a.angle - b.angle)
    + Math.abs(a.gap - b.gap)
    + Math.abs(a.leftSpan - b.leftSpan)
    + Math.abs(a.rightSpan - b.rightSpan);
}

test('portrait v018 translates material pressure into a real cut and a remote self-response', async () => {
  const {
    PRESSURE_THRESHOLD,
    buildFrame,
    registerPressure,
    liftLatestPressure,
    geometrySignature
  } = await import('../studies/self-portrait/v018/engine.mjs');
  const baseline = buildFrame(3, []);
  const changed = registerPressure(baseline, { strandIndex: 5, force: 0.88 });
  const restored = liftLatestPressure(changed);
  const event = changed.memory.at(-1);

  assert.equal(changed.memory.length, 1);
  assert.equal(event.source, 'visitor-pressure');
  assert.equal(event.kind, 'material-cut');
  assert.ok(event.force >= PRESSURE_THRESHOLD);
  assert.notEqual(event.replyStrand, event.strandIndex);
  assert.ok(changed.strands[event.strandIndex].gap > baseline.strands[event.strandIndex].gap);
  assert.ok(changed.strands[event.strandIndex].leftSpan < baseline.strands[event.strandIndex].leftSpan);
  assert.ok(changed.strands[event.replyStrand].thickness > baseline.strands[event.replyStrand].thickness);
  assert.ok(changed.strands.some((strand, index) => strandDelta(strand, baseline.strands[index]) > 0.08));
  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(geometrySignature(restored), geometrySignature(baseline), 'lifting the latest pressure must restore the exact prior register');
});

test('portrait v018 remembers resistance so a repeated pressure changes the next reply', async () => {
  const { buildFrame, registerPressure } = await import('../studies/self-portrait/v018/engine.mjs');
  const baseline = buildFrame(1, []);
  const first = registerPressure(baseline, { strandIndex: 7, force: 0.9 });
  const second = registerPressure(first, { strandIndex: 7, force: 0.9 });
  const firstEvent = first.memory.at(-1);
  const secondEvent = second.memory.at(-1);

  assert.ok(secondEvent.resistanceBefore > firstEvent.resistanceBefore);
  assert.notEqual(secondEvent.replyStrand, firstEvent.replyStrand);
  assert.ok(second.strands[firstEvent.strandIndex].gap >= first.strands[firstEvent.strandIndex].gap);
  assert.notEqual(secondEvent.signature, firstEvent.signature);
});

test('portrait v018 bounds pressure memory and settles into four remembered cuts', async () => {
  const { MEMORY_LIMIT, buildFrame, buildTimeline, registerPressure } = await import('../studies/self-portrait/v018/engine.mjs');
  let frame = buildFrame(0, []);
  for (let index = 0; index < 8; index += 1) {
    frame = registerPressure(frame, { strandIndex: (index * 3 + 2) % 17, force: 0.72 + (index % 3) * 0.08 });
  }
  const settled = buildTimeline().at(-1);

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.cuts.length, MEMORY_LIMIT);
  assert.equal(frame.replies.length, MEMORY_LIMIT);
  assert.equal(settled.stage, 14);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.cuts.length, MEMORY_LIMIT);
  assert.equal(settled.replies.length, MEMORY_LIMIT);
});

test('portrait v018 keeps pointer taps inert while keyboard and controls share the pressure event', async () => {
  const html = await read('studies/self-portrait/v018/index.html');
  const sketch = await read('studies/self-portrait/v018/sketch.js');

  assert.match(html, /<div[^>]+id="pressure-field"/);
  assert.match(html, /data-gesture="press"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /registerPressure/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /pointer-tap-refused/);
  assert.match(sketch, /event\.key === 'Enter'/);
  assert.match(sketch, /__mutinePortraitV018/);
});

test('portrait v018 exposes a caption-free pressure register and honest daily record', async () => {
  for (const path of [
    'studies/self-portrait/v018/index.html',
    'studies/self-portrait/v018/engine.mjs',
    'studies/self-portrait/v018/sketch.js',
    'studies/self-portrait/v018/style.css',
    'studies/self-portrait/v018/README.md',
    'studies/self-portrait/v018/metrics.json',
    'studies/self-portrait/v018/critiques.json',
    'works/portrait-2026-10-02/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const readme = await read('studies/self-portrait/v018/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v018/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v018/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'portrait' && work.date === '2026-10-02');
  const record = matches[0];

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.seed, '0x53504638');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic HTML pressure register');
  assert.match(metrics.memoryRule, /resistance|cut|reply/i);
  assert.match(metrics.interactionRule, /pressure|pointer|keyboard/i);
  assert.match(metrics.representationRupture, /register|wave|aperture/i);
  assert.equal(critiques.length, 5);
  assert.equal(matches.length, 1);
  assert.equal(record.id, 'portrait-2026-10-02');
  assert.equal(record.rawPath, '/studies/self-portrait/v018/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-portrait-2026-10-02');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /pressure|register|cut/i);
  assert.ok(record.critiques.length >= 5);
});
