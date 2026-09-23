import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  registerWitness,
  buildFrame,
  buildTimeline,
  liftLatestWitness,
  geometrySignature
} = await import('../studies/self-portrait/v014/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function changedPointCount(a, b) {
  return a.reduce((count, point, index) => {
    const other = b[index];
    return count + (point.x !== other.x || point.y !== other.y ? 1 : 0);
  }, 0);
}

test('portrait v014 turns a remembered look into a reversible plate decision', () => {
  const baseline = buildFrame(8);
  const changed = registerWitness(baseline, { x: 0.78, y: 0.4 });
  const restored = liftLatestWitness(changed);
  const witness = changed.witnesses[0];
  const target = changed.plates.find((plate) => plate.id === witness.targetId);
  const reply = changed.plates.find((plate) => plate.id === witness.replyId);
  const vacancy = changed.plates.find((plate) => plate.id === witness.vacancyId);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory.at(-1).source, 'visitor-witness');
  assert.equal(witness.kind, 'reciprocal-plate');
  assert.equal(target.state, 'looking');
  assert.equal(reply.state, 'answering');
  assert.equal(vacancy.occupancy, 0);
  assert.ok(changedPointCount(target.points, target.basePoints) >= 4);
  assert.ok(changedPointCount(reply.points, reply.basePoints) >= 4);
  assert.ok(target.lookAngle !== target.baseAngle);
  assert.ok(reply.answerAngle !== reply.baseAngle);
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'lifting the latest witness must restore the exact prior plate field');
});

test('portrait v014 bounds witness memory and keeps a real absence in the mosaic', () => {
  let frame = buildFrame(5);
  for (let index = 0; index < 8; index += 1) {
    frame = registerWitness(frame, { x: 0.18 + index * 0.09, y: 0.24 + (index % 4) * 0.16 });
  }
  const active = frame.plates.filter((plate) => plate.occupancy === 1);

  assert.equal(frame.memory.length, 5);
  assert.equal(frame.witnesses.length, 5);
  assert.equal(frame.vacancies.length, 5);
  assert.equal(active.length, frame.plates.length - 5);
  assert.ok(frame.witnesses.every((event) => event.kind === 'reciprocal-plate'));
  assert.ok(frame.responses.length >= 3);
});

test('portrait v014 timeline settles into five remembered reciprocal plate decisions', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, 16);
  assert.equal(settled.stage, 15);
  assert.equal(settled.memory.length, 5);
  assert.equal(settled.witnesses.length, 5);
  assert.equal(settled.vacancies.length, 5);
  assert.ok(settled.plates.some((plate) => plate.state === 'looking'));
  assert.ok(settled.plates.some((plate) => plate.state === 'answering'));
});

test('portrait v014 tableau exposes self-modification as an isolated reversible encounter', async () => {
  const html = await read('studies/self-portrait/v014/index.html');
  const sketch = await read('studies/self-portrait/v014/sketch.js');
  const style = await read('studies/self-portrait/v014/style.css');
  const readme = await read('studies/self-portrait/v014/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v014/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v014/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-09-23"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="witness"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /registerWitness/);
  assert.match(sketch, /liftLatestWitness/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /reciprocal-plate/);
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
  assert.doesNotMatch(metrics.promotion, /pending browser matrix/);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.equal(metrics.memoryRule.includes('plate'), true);
  assert.equal(critiques.length, 5);
});

test('portrait v014 is the unique 2026-09-23 daily work with a canonical page', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-23');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-23');
  assert.equal(work.rawPath, '/studies/self-portrait/v014/');
  assert.equal(work.status, 'candidate / held');
  assert.match(work.browserEvidence.status, /^local headless browser matrix passed/);
  assert.equal(work.browserEvidence.observedRoute, 'http://127.0.0.1:51334/works/portrait-2026-09-23/');
  assert.match(work.browserEvidence.tableauFirst, /^10\/10 local canonical runs placed/);
  assert.match(work.browserEvidence.viewportMatrix, /10\/10 local canonical/);
  assert.match(work.browserEvidence.touchTargets, /44px high/);
  assert.ok(!work.browserEvidence.unresolved.includes('canonical route and Journal browser readback'));
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-23');
  assert.equal(work.decision.lineage, 'portrait-2026-09-18');

  const canonical = await read('works/portrait-2026-09-23/index.html');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-23"/);
});

test('portrait v014 reduced-motion and static preview render a settled plate field', async () => {
  const sketch = await read('studies/self-portrait/v014/sketch.js');

  assert.match(sketch, /if \(frozen\) \{\s*render\(frame, 'sequence'\);\s*return;/);
  assert.match(sketch, /staticPreview \|\| blindMode/);
});
