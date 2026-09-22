import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyMisread,
  buildTimeline,
  deleteLatestMisread,
  misreadSignature
} = await import('../studies/naive-art/v015/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v015 turns a remembered mistake into a reciprocal copy error with a real blank slot', () => {
  const frame = buildTimeline()[7];
  const changed = applyMisread(frame, { x: 0.21, y: 0.24 });
  const local = changed.scene.panels[changed.scene.misreadRecords.at(-1).localIndex];
  const answer = changed.scene.panels[changed.scene.misreadRecords.at(-1).answerIndex];
  const vacancy = changed.scene.panels[changed.scene.misreadRecords.at(-1).vacancyIndex];

  assert.equal(changed.memory.at(-1).source, 'visitor-misread');
  assert.equal(changed.scene.misreadRecords.at(-1).source, 'visitor-misread');
  assert.notEqual(changed.scene.misreadRecords.at(-1).localIndex, changed.scene.misreadRecords.at(-1).answerIndex);
  assert.notEqual(changed.scene.misreadRecords.at(-1).answerIndex, changed.scene.misreadRecords.at(-1).vacancyIndex);
  assert.ok(Math.abs(local.turn) > 0.01, 'the local picture must materially lean toward the visitor');
  assert.ok(answer.replies.length > 0, 'a distant picture must carry a wrong copied motif');
  assert.ok(vacancy.missing.length > 0, 'a third picture must lose an actual pictorial component');
  assert.notEqual(misreadSignature(changed), misreadSignature(frame));

  const restored = deleteLatestMisread(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(misreadSignature(restored), misreadSignature(frame));
});

test('Naive v015 exposes a caption-free copy-error tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v015/index.html',
    'studies/naive-art/v015/sketch.js',
    'studies/naive-art/v015/style.css',
    'studies/naive-art/v015/README.md',
    'studies/naive-art/v015/metrics.json',
    'studies/naive-art/v015/critiques.json',
    'works/naive-2026-09-22/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v015/index.html');
  const sketch = await read('studies/naive-art/v015/sketch.js');
  const style = await read('studies/naive-art/v015/style.css');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-22');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="misread-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<canvas[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyMisread/);
  assert.match(sketch, /deleteLatestMisread/);
  assert.match(sketch, /event\.key === 'Delete'/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /copy-error/);
  assert.match(sketch, /window\.__mutineNaiveV015/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-22');
  assert.equal(record.rawPath, '/studies/naive-art/v015/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-22');
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.memoryRule, /misread|copy|blank/);
  assert.match(record.browserEvidence.status, /^(?:local headless browser matrices passed|local and production headless browser matrices passed)/);
});
