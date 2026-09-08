import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const routeSignature = (routes) => routes
  .map((route) => route.points.slice(5).map(({ x, y }) => `${x.toFixed(4)},${y.toFixed(4)}`).join('|'))
  .join('||');

test('handwriting v004 turns remembered refusals into a structural lost beat', async () => {
  const { buildStage } = await import('../studies/handwriting/v004/engine.mjs');
  const settled = buildStage(8);
  const rememberedRefusal = settled.history
    .flatMap((entry) => entry.newScars)
    .find((scar) => scar.stage > 0 && scar.stage < 8);

  assert.ok(rememberedRefusal, 'the timeline should create a removable remembered refusal');
  assert.ok(settled.routes.some((route) => route.pause > 0 && route.gapStart >= 0 && route.reentryPoints?.length), 'a later route should carry a visible lost beat');
  assert.equal(settled.routes.some((route) => route.branchPoints), false, 'the v004 rule must not depend on a second decorative hand');

  const withoutRefusal = buildStage(8, { omitScarId: rememberedRefusal.id });
  assert.notEqual(routeSignature(settled.routes), routeSignature(withoutRefusal.routes), 'lifting memory must change later handwriting geometry');
});

test('handwriting v004 exposes a tableau-first preview and reversible memory action', async () => {
  const html = await read('studies/handwriting/v004/index.html');

  assert.match(html, /data-raw-work-id="typography-2026-09-04"/);
  assert.match(html, /<canvas[^>]+id="piece"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /id="lift-memory"/);
  assert.match(html, /id="restore-memory"/);
  assert.match(html, /aria-live="polite"/);
});

test('handwriting v004 is recorded as the unique typography work for 2026-09-04', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matching = data.works.filter((work) => work.currentId === 'typography' && work.date === '2026-09-04');

  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, 'typography-2026-09-04');
  assert.equal(matching[0].rawPath, '/studies/handwriting/v004/');
  assert.equal(matching[0].journal.anchor, 'journal-typography-2026-09-04');
  assert.equal(matching[0].decision.lineage, 'typography-2026-09-03');
});
