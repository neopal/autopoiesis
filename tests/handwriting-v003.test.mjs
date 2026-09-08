import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const routeSignature = (routes) => routes
  .map((route) => route.points.slice(4).map(({ x, y }) => `${x.toFixed(4)},${y.toFixed(4)}`).join('|'))
  .join('||');

test('handwriting v003 makes a remembered refusal alter later geometry when one scar is lifted', async () => {
  const { buildStage } = await import('../studies/handwriting/v003/engine.mjs');
  const settled = buildStage(7);
  const rememberedScar = settled.history
    .flatMap((entry) => entry.newScars)
    .find((scar) => scar.stage > 0 && scar.stage < 7);

  assert.ok(rememberedScar, 'the timeline should create a removable remembered scar');
  assert.ok(settled.routes.some((route) => route.fracture > 0 && route.branchPoints?.length === route.points.length), 'a later route should visibly fracture');

  const withoutScar = buildStage(7, { omitScarId: rememberedScar.id });
  assert.notEqual(routeSignature(settled.routes), routeSignature(withoutScar.routes), 'lifting memory must change downstream route geometry');
});

test('handwriting v003 exposes a tableau-first preview and an accessible memory action', async () => {
  const html = await read('studies/handwriting/v003/index.html');

  assert.match(html, /data-raw-work-id="typography-2026-09-03"/);
  assert.match(html, /id="piece"[^>]*canvas|<canvas[^>]*id="piece"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /id="lift-memory"/);
  assert.match(html, /aria-live="polite"/);
});

test('timeline headings keep long current names inside their own column', async () => {
  const css = await read('studio/catalog.css');
  assert.match(css, /\.work-timeline-bar__heading \{[^}]*min-width: clamp\(132px, 16vw, 220px\)/);
  assert.match(css, /\.work-timeline-bar__heading strong \{[^}]*overflow-wrap: anywhere/);
});

test('narrow work headers wrap their route context instead of clipping it', async () => {
  const css = await read('studio/studio.css');
  assert.match(css, /\.studio-header p \{[^}]*min-width: 0/);
  assert.match(css, /\.studio-header p \{[^}]*overflow-wrap: anywhere/);
});

test('very narrow work headers stack the route context below the studio mark', async () => {
  const css = await read('studio/studio.css');
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*\.studio-header \{[^}]*grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*\.studio-header p \{[^}]*text-align: left/);
});
