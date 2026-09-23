import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';

const {
  STAGES,
  PRIMITIVE_BUDGET,
  buildFrame,
  buildTimeline,
  distance,
  applyConstraint,
  deleteConstraint
} = await import('../studies/pure-svg/v014/engine.mjs');

const signature = (frame) => ({
  gates: frame.gates,
  memory: frame.memory,
  corridors: frame.corridors,
  cutCount: frame.cutCount
});

const gateDelta = (a, b) => a.gates.reduce((sum, gate, index) => {
  const other = b.gates[index];
  return sum + distance(gate, other) + Math.abs(gate.angle - other.angle) * 0.08 + (gate.visible === other.visible ? 0 : 0.18);
}, 0);

test('SVG v014 has a dedicated study tableau path', async () => {
  await access(new URL('../studies/pure-svg/v014/index.html', import.meta.url));
  assert.ok(true);
});

test('SVG v014 inverts reciprocal gaze into a visible topological refusal', () => {
  const frame = buildTimeline()[STAGES - 1];
  const latest = frame.memory.at(-1);
  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));

  assert.ok(frame.memory.length >= 2);
  assert.equal(latest.kind, 'constraint');
  assert.ok(latest.focusIndex >= 0);
  assert.ok(latest.blockedIndices.length >= 2);
  assert.ok(latest.gapIndex >= 0);
  assert.ok(frame.gates.some((gate) => gate.role === 'blocked'));
  assert.ok(frame.gates.some((gate) => gate.role === 'gap'));
  assert.ok(frame.gates.some((gate) => !gate.visible));
  assert.notDeepEqual(frame.corridors, withoutLatest.corridors);
  assert.ok(gateDelta(frame, withoutLatest) > 0.38, `expected refusal topology change, got ${gateDelta(frame, withoutLatest)}`);
  assert.ok(frame.cutCount >= 1);
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
});

test('SVG v014 visitor constraint is bounded, deterministic, and exactly reversible', () => {
  const frame = buildTimeline()[3];
  const next = applyConstraint(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.18 });
  assert.equal(next.memory.at(-1).source, 'visitor-constraint');
  assert.deepEqual(applyConstraint(frame, { x: 99, y: -2 }), next);
  assert.deepEqual(signature(deleteConstraint(next)), signature(buildFrame(frame.stage, frame.memory)));
});

test('SVG v014 keeps the line from pretending to look back', () => {
  const frame = buildTimeline()[STAGES - 1];
  assert.equal(frame.gates.some((gate) => gate.role === 'looking'), false);
  assert.equal(frame.gates.some((gate) => gate.role === 'answering'), false);
  assert.ok(frame.gates.some((gate) => gate.role === 'blocked'));
});

test('SVG v014 exposes a tableau-first refusal browser surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v014/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v014/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v014/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="constraint"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteConstraint/);
  assert.match(sketch, /applyConstraint/);
  assert.match(sketch, /blocked/);
  assert.match(sketch, /gap/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.gate--blocked/);
  assert.match(style, /static-mode[^}]*gap-mark/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
});

test('SVG v014 is registered as the unique 2026-09-23 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-23');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-23');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v014/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-09-23');
  assert.equal(matches[0].decision.lineage, 'pure-svg-v013');
  assert.equal(matches[0].source.referenceId, 'little-critters');

  const canonical = await readFile(new URL('works/svg-2026-09-23/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-23"/);
});
