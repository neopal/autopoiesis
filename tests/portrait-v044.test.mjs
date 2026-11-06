import test from 'node:test';
import assert from 'node:assert/strict';

const {
  PANEL_COUNT,
  MEMORY_LIMIT,
  CHOICE_LIMIT,
  buildField,
  choosePanel,
  commitContradiction,
  geometrySignature,
  liftLatest,
  releaseField,
  buildTimeline
} = await import('../studies/self-portrait/v044/engine.mjs');

test('portrait v044 builds a deterministic refusal register', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(PANEL_COUNT, 11);
  assert.equal(CHOICE_LIMIT, 3);
  assert.equal(first.composition, 'refusal-register');
  assert.equal(first.renderer, 'p5-canvas');
  assert.equal(first.panels.length, PANEL_COUNT);
  assert.equal(first.choices.length, 0);
  assert.equal(first.memory.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('portrait v044 holds panel choices without changing the register', () => {
  const quiet = buildField();
  const selected = choosePanel(quiet, 2, 'left');

  assert.equal(selected.interaction, 'choice held');
  assert.deepEqual(selected.choices, [{ panel: 2, side: 'left' }]);
  assert.equal(geometrySignature(selected), geometrySignature(quiet));
});

test('portrait v044 refuses a partial or unanimous decision', () => {
  const quiet = buildField();
  const partial = commitContradiction(choosePanel(quiet, 2, 'left'));
  const unanimous = commitContradiction(
    choosePanel(choosePanel(choosePanel(quiet, 1, 'left'), 4, 'left'), 8, 'left')
  );

  assert.equal(partial.accepted, false);
  assert.equal(partial.field.revision, 0);
  assert.equal(partial.field.memory.length, 0);
  assert.equal(geometrySignature(partial.field), geometrySignature(quiet));
  assert.equal(unanimous.accepted, false);
  assert.equal(unanimous.field.interaction, 'refused / agreement');
  assert.equal(unanimous.field.memory.length, 0);
});

test('portrait v044 makes a split in an unchosen panel after a contradiction', () => {
  const quiet = buildField();
  const chosen = choosePanel(
    choosePanel(choosePanel(quiet, 1, 'left'), 4, 'right'),
    8,
    'left'
  );
  const result = commitContradiction(chosen);
  const event = result.field.memory.at(-1);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'contradiction-split');
  assert.equal(event.relation, 'decision-remembered-elsewhere');
  assert.equal(event.sources.length, CHOICE_LIMIT);
  assert.equal(event.receiver, 6);
  assert.equal(result.field.interaction, 'split / elsewhere');
  assert.equal(result.field.panels[1].state, 'quiet');
  assert.equal(result.field.panels[4].state, 'quiet');
  assert.equal(result.field.panels[8].state, 'quiet');
  assert.equal(result.field.panels[event.receiver].state, 'split');
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.ok(result.field.panels[event.receiver].seams > quiet.panels[event.receiver].seams);
});

test('portrait v044 compounds four contradictions and lifts the exact preceding register', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(releaseField().revision, 0);
});

test('portrait v044 exposes canvas and non-hover input paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v044/index.html');
  const sketch = await read('studies/self-portrait/v044/sketch.js');
  const style = await read('studies/self-portrait/v044/style.css');

  assert.match(html, /data-refusal-stage/);
  assert.match(html, /data-action="choose-left"/);
  assert.match(html, /data-action="choose-right"/);
  assert.match(html, /data-action="commit"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitContradiction/);
  assert.match(sketch, /__mutinePortraitV044/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v044 keeps control clicks from becoming panel selections', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/self-portrait/v044/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /event\.target\.closest\('\.refusal-controls'\)/);
});

test('portrait v044 has one canonical daily record and tableau route', async () => {
  const { readFile } = await import('node:fs/promises');
  const works = JSON.parse(await readFile(new URL('../studio/data/works.json', import.meta.url), 'utf8'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-11-06');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rawPath, '/studies/self-portrait/v044/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.match(matches[0].journal.anchor, /journal-portrait-2026-11-06/);
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  const canonical = await readFile(new URL('../works/portrait-2026-11-06/index.html', import.meta.url), 'utf8');
  assert.match(canonical, /data-work-id="portrait-2026-11-06"/);
  assert.match(canonical, /catalog\.js/);
});
