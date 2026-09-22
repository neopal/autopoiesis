import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';

const {
  STAGES,
  PRIMITIVE_BUDGET,
  buildFrame,
  buildTimeline,
  distance,
  applyGaze,
  deleteGaze
} = await import('../studies/pure-svg/v013/engine.mjs');

const signature = (frame) => ({
  nodes: frame.nodes,
  memory: frame.memory,
  vacancies: frame.vacancies
});

const nodeDelta = (a, b) => a.nodes.reduce((sum, node, index) => {
  const other = b.nodes[index];
  return sum + distance(node, other) + Math.abs(node.angle - other.angle) * 0.08 + (node.visible === other.visible ? 0 : 0.12);
}, 0);

test('SVG v013 has a dedicated study tableau path', async () => {
  await access(new URL('../studies/pure-svg/v013/index.html', import.meta.url));
  assert.ok(true);
});

test('SVG v013 translates a gaze into a visible quorum, answering ring, and true vacancy', () => {
  const frame = buildTimeline()[STAGES - 1];
  const latest = frame.memory.at(-1);
  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));

  assert.ok(frame.memory.length >= 3);
  assert.equal(latest.kind, 'gaze');
  assert.ok(latest.focusIndex >= 0);
  assert.ok(latest.answeringIndices.length >= 3);
  assert.ok(latest.vacancyIndex >= 0);
  assert.ok(frame.nodes.some((node) => node.role === 'looking'));
  assert.ok(frame.nodes.some((node) => node.role === 'answering'));
  assert.ok(frame.nodes.some((node) => !node.visible));
  assert.ok(nodeDelta(frame, withoutLatest) > 0.55, `expected gaze topology change, got ${nodeDelta(frame, withoutLatest)}`);
  assert.ok(frame.vacancies >= 1);
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
});

test('SVG v013 visitor gaze is bounded, deterministic, and exactly reversible', () => {
  const frame = buildTimeline()[4];
  const next = applyGaze(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.94, y: 0.16 });
  assert.equal(next.memory.at(-1).source, 'visitor-gaze');
  assert.deepEqual(applyGaze(frame, { x: 99, y: -2 }), next);
  assert.deepEqual(signature(deleteGaze(next)), signature(buildFrame(frame.stage, frame.memory)));
});

test('SVG v013 exposes a tableau-first reciprocal browser surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v013/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v013/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v013/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="gaze"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteGaze/);
  assert.match(sketch, /applyGaze/);
  assert.match(sketch, /answering/);
  assert.match(sketch, /vacancy/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.node--looking/);
  assert.match(style, /static-mode[^}]*node-witness/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
});

test('SVG v013 is registered as the unique 2026-09-22 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-22');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-22');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v013/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-09-22');
  assert.equal(matches[0].decision.lineage, 'pure-svg-v012');

  const canonical = await readFile(new URL('works/svg-2026-09-22/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-22"/);
});
