import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the portrait daily work is registered with its canonical lineage record', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const work = data.works.find((entry) => entry.id === 'portrait-2026-09-03');

  assert.ok(work, 'the target current/date must have one recorded daily work');
  assert.equal(work.currentId, 'portrait');
  assert.equal(work.date, '2026-09-03');
  assert.equal(work.rawPath, '/studies/self-portrait/v002/');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-03');
  assert.equal(work.lifecycle, 'active');
});

test('visitor hinges are capped and lifting the latest hinge restores the prior geometry', async () => {
  const { applyHinge, buildTimeline, deleteLatestHinge, geometrySignature } = await import('../studies/self-portrait/v002/engine.mjs');
  const base = buildTimeline().at(-1);
  const changed = applyHinge(base, { x: .78, y: .42 });
  const restored = deleteLatestHinge(changed);

  assert.equal(changed.memory.length, 4, 'the portrait should keep a bounded memory');
  assert.notEqual(geometrySignature(base), geometrySignature(changed));
  assert.equal(geometrySignature(base), geometrySignature(restored), 'lifting must restore the exact prior state');
});

test('canonical detail markup places the tableau before the timeline rail', async () => {
  const source = await read('studio/catalog.js');
  const tableauPosition = source.indexOf('<div class="work-inspect">');
  const timelinePosition = source.indexOf('<nav class="work-timeline-bar"');

  assert.ok(tableauPosition >= 0, 'detail markup should contain the tableau');
  assert.ok(timelinePosition >= 0, 'detail markup should contain the timeline');
  assert.ok(tableauPosition < timelinePosition, 'the artwork must arrive before its navigation rail');
});

test('interactive preview keeps its action rail clear of duplicate canvas footer marks', async () => {
  const source = await read('studies/self-portrait/v002/sketch.js');
  assert.match(source, /const interactivePreview = params\.has\('interaction'\)/);
  assert.match(source, /function drawMarks\(frame, state\) \{[\s\S]*if \(interactivePreview\) return/);
});

test('self portrait v002 is tableau-first and offers a reversible hinge gesture', async () => {
  const html = await read('studies/self-portrait/v002/index.html');

  assert.match(html, /data-raw-work-id="portrait-2026-09-03"/);
  assert.match(html, /id="field"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /id="hinge-control"/);
  assert.match(html, /id="undo-control"/);
  assert.match(html, /id="release-control"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /work-surface[\s\S]*work-title/);
});
