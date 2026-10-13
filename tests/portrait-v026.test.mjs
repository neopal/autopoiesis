import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const {
  MEMORY_LIMIT,
  buildFrame,
  armWitness,
  commitWitness,
  liftLatestWitness,
  releaseAttention,
  geometrySignature,
  buildTimeline
} = await import('../studies/self-portrait/v026/engine.mjs');

test('portrait v026 turns situated witnessing into a non-local absence election', () => {
  const baseline = buildFrame(0);
  const armed = armWitness(baseline, 4);
  const changed = commitWitness(armed);
  const event = changed.memory.at(-1);
  const restored = liftLatestWitness(changed);

  assert.equal(geometrySignature(armed), geometrySignature(baseline), 'watching must not directly alter the portrait geometry');
  assert.equal(armed.memory.length, 0, 'a witness must arm without writing history');
  assert.equal(changed.memory.length, 1);
  assert.equal(event.source, 'visitor-witness');
  assert.equal(event.kind, 'absence-election');
  assert.notEqual(event.absenceIndex, event.witnessIndex, 'the witnessed mark cannot be the elected absence');
  assert.notEqual(event.replyIndex, event.absenceIndex);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.equal(changed.marks[event.absenceIndex].state, 'absent');
  assert.equal(changed.marks[event.replyIndex].state, 'reply');
  assert.equal(changed.marks[event.counterIndex].state, 'counter');
  assert.equal(geometrySignature(restored), geometrySignature(baseline), 'lifting the latest election must restore the exact prior field');
});

test('portrait v026 remembers local witnessing and changes its next election', () => {
  const baseline = buildFrame(2);
  const first = commitWitness(armWitness(baseline, 3));
  const second = commitWitness(armWitness(first, 3));
  const firstEvent = first.memory.at(-1);
  const secondEvent = second.memory.at(-1);

  assert.ok(secondEvent.exposureBefore[3] > firstEvent.exposureBefore[3]);
  assert.notEqual(secondEvent.absenceIndex, firstEvent.absenceIndex, 'a remembered witness must alter the next absent mark');
  assert.notEqual(secondEvent.signature, firstEvent.signature);
  assert.equal(second.memory.length, 2);
});

test('portrait v026 bounds witness memory and settles into four elected absences', () => {
  let frame = buildFrame(1);
  for (let index = 0; index < 8; index += 1) frame = commitWitness(armWitness(frame, (index * 3) % 15));

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.elections.length, MEMORY_LIMIT);
  assert.ok(frame.marks.some((mark) => mark.state === 'absent'));
  assert.ok(frame.marks.some((mark) => mark.state === 'reply'));
  assert.ok(frame.marks.some((mark) => mark.state === 'counter'));
});

test('portrait v026 timeline settles into four remembered DOM witness decisions', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, 17);
  assert.equal(settled.stage, 16);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.elections.length, MEMORY_LIMIT);
});

test('portrait v026 exposes a caption-free semantic witness field with reversible keyboard controls', async () => {
  const html = await read('studies/self-portrait/v026/index.html');
  const sketch = await read('studies/self-portrait/v026/sketch.js');
  const style = await read('studies/self-portrait/v026/style.css');
  const readme = await read('studies/self-portrait/v026/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v026/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v026/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-10-13"/);
  assert.match(html, /data-witness-field/);
  assert.match(html, /data-action="witness"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /armWitness/);
  assert.match(sketch, /commitWitness/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /absence-election/);
  assert.match(sketch, /querySelector\(`\[data-mark="\$\{index\}"\]`\)\?\.focus\(\)/);
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
  assert.equal(metrics.renderer, 'deterministic semantic DOM witness field');
  assert.match(metrics.memoryRule, /absence|witness/i);
  assert.equal(critiques.length, 6);
});

test('portrait v026 is the unique 2026-10-13 daily work with a canonical page', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-10-13');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-10-13');
  assert.equal(work.rawPath, '/studies/self-portrait/v026/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-10-13');
  assert.equal(work.decision.lineage, 'portrait-2026-10-09');
  assert.equal(work.source.referenceId, 'little-critters');

  const canonical = await read('works/portrait-2026-10-13/index.html');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-13"/);
});

test('portrait v026 reduced-motion and blind preview render the settled witness field', async () => {
  const sketch = await read('studies/self-portrait/v026/sketch.js');

  assert.match(sketch, /if \(frozen\) \{\s*render\(frame, 'sequence'\);\s*return;/);
  assert.match(sketch, /staticPreview \|\| blindMode/);
});
