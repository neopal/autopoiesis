import test from 'node:test';
import assert from 'node:assert/strict';

const { buildFrame, buildTimeline, distance, applyCut } = await import('../studies/pure-svg/v002/engine.mjs');

test('SVG v002 carries the latest cut into later contour geometry', () => {
  const timeline = buildTimeline();
  const frame = timeline[5];
  assert.ok(frame.memory.length >= 2);

  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));
  const downstreamDelta = frame.points.reduce((sum, point, index) => (
    sum + distance(point, withoutLatest.points[index])
  ), 0);

  assert.ok(downstreamDelta > 0.03, `expected a structural downstream delta, got ${downstreamDelta}`);
  assert.ok(frame.memory.at(-1).influencedIndices.some((index) => index >= 7));
});

test('SVG v002 pointer cuts become deterministic inherited memory', () => {
  const frame = buildTimeline()[4];
  const next = applyCut(frame, { x: 0.68, y: 0.43 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.68, y: 0.43 });
  assert.equal(next.memory.at(-1).source, 'visitor-cut');
  assert.deepEqual(applyCut(frame, { x: 0.68, y: 0.43 }), next);
});

test('SVG v002 current routes resolve through the English studio shell', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const tableau = await readFile(new URL('studies/pure-svg/v002/index.html', root), 'utf8');
  const canonical = await readFile(new URL('works/svg-2026-09-02/index.html', root), 'utf8');
  for (const html of [tableau, canonical]) {
    assert.doesNotMatch(html, /\/galerie\//);
    assert.doesNotMatch(html, /\/(?:courants|oeuvres)\//);
    assert.match(html, /\/studio\//);
  }
});

test('SVG v002 keeps preview interaction and reduced-motion affordances coherent', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v002/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v002/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v002/style.css', root), 'utf8');
  const catalog = await readFile(new URL('studio/catalog.js', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /interactionFrame\?\.interaction === 'visitor-cut'/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.doesNotMatch(sketch, /staticPreview \|\| reducedMotion/);
  assert.match(sketch, /drawnWidth/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.active-scar\{animation:none!important\}/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
  assert.match(catalog, /withPreview\(work\.rawPath, \{ interaction: '1' \}\)/);
});

test('SVG v002 preserves exact pointer edges and deletes the visible latest scar', async () => {
  const edgeCut = applyCut(buildTimeline()[0], { x: 0, y: 0 });
  assert.deepEqual(edgeCut.memory.at(-1).point, { x: 0.04, y: 0.12 });

  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v002/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v002/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v002/style.css', root), 'utf8');
  assert.match(index, /static-mode/);
  assert.match(sketch, /base\.scar.*visitor-cut|visitor-cut.*base\.scar/);
  assert.match(sketch, /if \(!staticPreview\) makeCut/);
  assert.match(sketch, /if \(!staticPreview\) deleteLatest/);
  assert.match(style, /html\.static-mode/);
});
