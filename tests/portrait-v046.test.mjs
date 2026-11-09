import test from 'node:test';
import assert from 'node:assert/strict';

const {
  BREAK_LIMIT,
  MEMORY_LIMIT,
  SEED,
  TOKEN_COUNT,
  buildField,
  compileMargin,
  geometrySignature,
  liftLatest,
  markToken,
  releaseField,
  buildTimeline
} = await import('../studies/self-portrait/v046/engine.mjs');

test('portrait v046 begins as a deterministic margin compiler manuscript', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(SEED, 0x503046);
  assert.equal(TOKEN_COUNT, 12);
  assert.equal(BREAK_LIMIT, 3);
  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(first.composition, 'margin-compiler');
  assert.equal(first.renderer, 'dom-typography');
  assert.equal(first.document.mode, 'quiet');
  assert.equal(first.tokens.length, TOKEN_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('portrait v046 holds a marginal mark without changing the typeset body', () => {
  const quiet = buildField();
  const marked = markToken(quiet, 2, 0.74, 'inset');
  const repeated = markToken(marked, 2, 0.92, 'outset');

  assert.equal(marked.interaction, 'mark held / 1 of 3');
  assert.deepEqual(marked.pending, [{ index: 2, pressure: 0.74, side: 'inset' }]);
  assert.equal(geometrySignature(marked), geometrySignature(quiet));
  assert.equal(repeated.interaction, 'refused / repeated mark');
  assert.deepEqual(repeated.pending, marked.pending);
  assert.equal(geometrySignature(repeated), geometrySignature(quiet));
});

test('portrait v046 refuses an incomplete or low-pressure lineation', () => {
  const quiet = buildField();
  const armed = [
    [2, 0.34, 'inset'],
    [5, 0.34, 'outset'],
    [9, 0.34, 'inset']
  ].reduce((field, [index, pressure, side]) => markToken(field, index, pressure, side), quiet);
  const result = compileMargin(armed);

  assert.equal(result.accepted, false);
  assert.equal(result.event, null);
  assert.equal(result.field.interaction, 'refused / insufficient pressure');
  assert.equal(result.field.document.revision, 0);
  assert.equal(geometrySignature(result.field), geometrySignature(quiet));
});

test('portrait v046 compiles pressure into a new lineation, not a local scar', () => {
  const quiet = buildField();
  const armed = [
    [1, 0.82, 'inset'],
    [6, 0.78, 'outset'],
    [10, 0.76, 'inset']
  ].reduce((field, [index, pressure, side]) => markToken(field, index, pressure, side), quiet);
  const result = compileMargin(armed);

  assert.equal(result.accepted, true);
  assert.equal(result.event.kind, 'margin-rewrite');
  assert.equal(result.event.relation, 'pressure-rewrites-lineation');
  assert.equal(result.field.document.revision, 1);
  assert.equal(result.field.memory.length, 1);
  assert.equal(result.field.pending.length, 0);
  assert.notEqual(result.field.document.mode, 'quiet');
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.ok(result.field.tokens.some((token, index) => token.x !== quiet.tokens[index].x || token.y !== quiet.tokens[index].y));
});

test('portrait v046 lets mark order alter the reflow itself', () => {
  const compile = (order) => {
    const armed = order.reduce((field, index) => markToken(field, index, 0.8, index === 6 ? 'outset' : 'inset'), buildField());
    return compileMargin(armed).field;
  };
  const forward = compile([1, 6, 10]);
  const reverse = compile([10, 6, 1]);

  assert.notEqual(forward.memory[0].marks.map((mark) => mark.index).join(','), reverse.memory[0].marks.map((mark) => mark.index).join(','));
  assert.notEqual(geometrySignature(forward), geometrySignature(reverse));
  assert.notEqual(forward.tokens[0].x, reverse.tokens[0].x);
});

test('portrait v046 compounds four rewrites and lifts the exact preceding manuscript', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(releaseField().document.revision, 0);
});

test('portrait v046 exposes a DOM manuscript, p5 material field, and non-hover paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v046/index.html');
  const sketch = await read('studies/self-portrait/v046/sketch.js');
  const style = await read('studies/self-portrait/v046/style.css');

  assert.match(html, /data-manuscript-stage/);
  assert.match(html, /data-manuscript/);
  assert.match(html, /data-action="compile"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /compileMargin/);
  assert.match(sketch, /__mutinePortraitV046/);
  assert.match(sketch, /event\.target\.closest\('\.margin-controls'\)/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v046 has one canonical daily record and tableau route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-11-09');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rawPath, '/studies/self-portrait/v046/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.match(matches[0].journal.anchor, /journal-portrait-2026-11-09/);
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.equal(matches[0].metrics.grammar, 'margin-compiler');
  const canonical = await read('works/portrait-2026-11-09/index.html');
  assert.match(canonical, /data-work-id="portrait-2026-11-09"/);
  assert.match(canonical, /catalog\.js/);
});
