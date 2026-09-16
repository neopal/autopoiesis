import test from 'node:test';
import assert from 'node:assert/strict';

const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('handwriting v012 turns a remembered refusal into a finite shared chorus', async () => {
  const { buildTimeline, constants } = await import('../studies/handwriting/v012/engine.mjs');
  const settled = buildTimeline(constants.finalStage).at(-1);
  const chorusRoutes = settled.routes.filter((route) => route.chorusHistory.length > 0);

  assert.equal(settled.stage, constants.finalStage);
  assert.ok(chorusRoutes.length >= 6, 'a chorus must affect a local family, not one route');

  const latest = chorusRoutes[0].chorusHistory.at(-1);
  assert.ok(latest.convergence > 0.02, 'routes must materially converge');
  assert.ok(latest.sharedSpan >= 4, 'the convergence must occupy a finite phrase');
  assert.ok(latest.fanOut > 0.01, 'routes must leave the phrase with altered exits');
});

test('handwriting v012 visitor chorus is bounded and lifting it restores the exact prior field', async () => {
  const { buildFrame, applyChorus, removeLatestChorus } = await import('../studies/handwriting/v012/engine.mjs');
  const baseline = buildFrame(8, []);
  const changed = applyChorus(baseline, { x: 0.98, y: -0.2 });
  const restored = removeLatestChorus(changed);

  assert.equal(changed.memory.length, 1);
  assert.ok(changed.memory[0].x <= 0.93 && changed.memory[0].x >= 0.07);
  assert.ok(changed.memory[0].y <= 0.805 && changed.memory[0].y >= 0.105);
  assert.notDeepEqual(changed.routes.map((route) => route.points), baseline.routes.map((route) => route.points));
  assert.deepEqual(restored.routes.map((route) => route.points), baseline.routes.map((route) => route.points));
});

test('handwriting v012 exposes the chorus tableau before editorial explanation', async () => {
  const html = await read('studies/handwriting/v012/index.html');
  const sketch = await read('studies/handwriting/v012/sketch.js');
  const style = await read('studies/handwriting/v012/style.css');

  assert.match(html, /data-raw-work-id="typography-2026-09-16"/);
  assert.match(html, /<figure[^>]+class="work artwork-frame"/);
  assert.match(html, /<canvas[^>]+id="piece"/);
  assert.match(html, /id="place-chorus"/);
  assert.match(html, /id="lift-chorus"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(sketch, /applyChorus/);
  assert.match(sketch, /removeLatestChorus/);
  assert.match(sketch, /blind/);
  assert.match(sketch, /__mutineHandwritingV012/);
  assert.match(style, /preview-mode/);
});

test('handwriting v012 keeps an explicit art-gate record and one daily catalogue slot', async () => {
  const readme = await read('studies/handwriting/v012/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v012/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v012/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matching = data.works.filter((work) => work.currentId === 'typography' && work.date === '2026-09-16');

  assert.match(readme, /## Hypothesis/);
  assert.match(readme, /## Changed rule/);
  assert.match(readme, /## Falsifier/);
  assert.match(readme, /## Deletion condition/);
  assert.equal(metrics.seed, '0x57563132');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.ok(metrics.finalMemory >= 1);
  assert.ok(Array.isArray(critiques) && critiques.length >= 4);
  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, 'typography-2026-09-16');
  assert.equal(matching[0].rawPath, '/studies/handwriting/v012/');
  assert.equal(matching[0].journal.anchor, 'journal-typography-2026-09-16');
  const workHtml = await read('works/typography-2026-09-16/index.html');
  assert.match(workHtml, /data-catalog-work-detail="typography-2026-09-16"/);
});
