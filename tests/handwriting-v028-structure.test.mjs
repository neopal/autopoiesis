import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('handwriting v028 ships a counter-field tableau before explanation', async () => {
  const html = await read('studies/handwriting/v028/index.html');
  const sketch = await read('studies/handwriting/v028/sketch.js');
  const style = await read('studies/handwriting/v028/style.css');

  assert.match(html, /id="counter-field"/);
  assert.match(html, /id="counter-svg"/);
  assert.match(html, /id="offer-counter"/);
  assert.match(html, /id="lift-counter"/);
  assert.match(html, /id="release-counter"/);
  assert.match(html, /data-raw-work-id="typography-2026-10-14"/);
  assert.match(sketch, /commitReply/);
  assert.match(sketch, /__mutineHandwritingV028/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /min-height: 44px/);
});

test('handwriting v028 records its art gate, cultural translation, and daily route', async () => {
  const readme = await read('studies/handwriting/v028/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v028/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v028/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/typography-2026-10-14/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x48574928');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /counter|reply|hollow/i);
  assert.match(metrics.interactionRule, /arm|reply|counter/i);
  assert.equal(critiques.length, 6);
  const matches = data.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-10-14');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'typography-2026-10-14');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/handwriting/v028/');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(work.source.translatedRule, /counter|reply|hollow/i);
  assert.equal(work.journal.anchor, 'journal-typography-2026-10-14');
  assert.equal(work.decision.lineage, 'typography-2026-10-13');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-14"/);
});
