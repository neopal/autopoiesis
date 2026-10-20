import test from 'node:test';
import assert from 'node:assert/strict';

const {
  PLATE_COUNT,
  buildFrame,
  commitGesture,
  geometrySignature,
  liftLatestGesture,
  releaseGrammar
} = await import('../studies/self-portrait/v028/engine.mjs');

test('portrait v028 turns a traversed gesture into a non-local grammar fold', () => {
  const baseline = buildFrame(0);
  const changed = commitGesture(baseline, {
    points: [[-0.82, -0.34], [-0.32, 0.28], [0.08, -0.18], [0.76, 0.34]]
  });
  const event = changed.memory.at(-1);

  assert.equal(baseline.composition, 'folded-grammar-volume');
  assert.equal(baseline.plates.length, PLATE_COUNT);
  assert.equal(event.source, 'visitor-gesture');
  assert.equal(event.kind, 'grammar-fold');
  assert.ok(event.turns >= 2);
  assert.ok(Number.isInteger(event.hingeIndex));
  assert.ok(Number.isInteger(event.counterIndex));
  assert.notEqual(event.hingeIndex, event.counterIndex);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.equal(changed.plates[event.hingeIndex].state, 'hinge');
  assert.equal(changed.plates[event.counterIndex].state, 'counterfold');
  assert.notEqual(changed.ruleIndex, baseline.ruleIndex);
});

test('portrait v028 is the unique 2026-10-20 daily work with a canonical page', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-10-20');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-10-20');
  assert.equal(work.rawPath, '/studies/self-portrait/v028/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-10-20');
  assert.equal(work.decision.lineage, 'portrait-2026-10-14');
  assert.equal(work.source.referenceId, 'p5-brush');

  const canonical = await read('works/portrait-2026-10-20/index.html');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-20"/);
});

test('portrait v028 exposes a WebGL folded-volume surface and gesture controls', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v028/index.html');
  const sketch = await read('studies/self-portrait/v028/sketch.js');
  const style = await read('studies/self-portrait/v028/style.css');
  const readme = await read('studies/self-portrait/v028/README.md');

  assert.match(html, /data-raw-work-id="portrait-2026-10-20"/);
  assert.match(html, /id="fold-volume-canvas"/);
  assert.match(html, /data-action="fold"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /createCanvas\([^;]+WEBGL/);
  assert.match(sketch, /commitGesture/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /__mutinePortraitV028/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
});

test('portrait v028 bounds grammar memory and lifts the exact preceding volume', () => {
  let frame = buildFrame(1);
  const signatures = [geometrySignature(frame)];
  const paths = [
    [[-0.82, -0.34], [-0.32, 0.28], [0.08, -0.18], [0.76, 0.34]],
    [[-0.75, 0.46], [-0.25, -0.22], [0.22, 0.42], [0.78, -0.38]],
    [[-0.7, -0.46], [-0.22, 0.1], [0.16, -0.4], [0.72, 0.24]],
    [[-0.78, 0.22], [-0.34, -0.34], [0.2, 0.18], [0.74, 0.46]],
    [[-0.7, 0.34], [-0.18, -0.28], [0.28, 0.38], [0.8, -0.2]]
  ];
  for (const points of paths) {
    frame = commitGesture(frame, { points });
    signatures.push(geometrySignature(frame));
  }

  assert.equal(frame.memory.length, 4);
  assert.equal(frame.commits.length, 4);
  assert.equal(geometrySignature(liftLatestGesture(frame)), signatures.at(-2));
  assert.equal(geometrySignature(releaseGrammar(1)), geometrySignature(buildFrame(1)));
});
