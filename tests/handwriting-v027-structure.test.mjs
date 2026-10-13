import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('handwriting v027 ships a pressure loom tableau before explanation', async () => {
  const html = await read('studies/handwriting/v027/index.html');
  const sketch = await read('studies/handwriting/v027/sketch.js');
  const style = await read('studies/handwriting/v027/style.css');

  assert.match(html, /id="pressure-loom"/);
  assert.match(html, /id="canvas-mount"/);
  assert.match(html, /id="press-to-yield"/);
  assert.match(html, /id="lift-pressure"/);
  assert.match(html, /id="release-pressure"/);
  assert.match(html, /data-raw-work-id="typography-2026-10-13"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /commitPressure/);
  assert.match(sketch, /__mutineHandwritingV027/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /min-height: 44px/);
});

test('handwriting v027 records its art gate, cultural translation, and daily route', async () => {
  const readme = await read('studies/handwriting/v027/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v027/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v027/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/typography-2026-10-13/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x48574927');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /pressure|space|relief/i);
  assert.match(metrics.interactionRule, /hold|release|pressure/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-10-13');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'typography-2026-10-13');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/handwriting/v027/');
  assert.equal(work.source.referenceId, 'p5-brush');
  assert.match(work.source.translatedRule, /pressure|space|relief/i);
  assert.equal(work.journal.anchor, 'journal-typography-2026-10-13');
  assert.equal(work.decision.lineage, 'typography-2026-10-10');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-13"/);
});
