import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const RETURN_PATH = [0, 1, 2, 3, 2];

 test('handwriting v023 begins as a deterministic browser-native reading fold', async () => {
  const { TOKEN_COUNT, buildFrame, geometrySignature } = await import('../studies/handwriting/v023/engine.mjs');
  const first = buildFrame(3, []);
  const repeat = buildFrame(3, []);

  assert.equal(first.composition, 'reading-fold');
  assert.equal(first.memory.length, 0);
  assert.equal(first.tokens.length, TOKEN_COUNT);
  assert.equal(TOKEN_COUNT, 16);
  assert.ok(first.tokens.every((token) => typeof token.text === 'string' && token.text.length > 0));
  assert.ok(first.tokens.every((token) => Number.isFinite(token.column) && Number.isFinite(token.row)));
  assert.equal(geometrySignature(first), geometrySignature(repeat));
});

test('a one-way reading pass arms only, while a return reflows real text and a remote reply', async () => {
  const { buildFrame, commitReadingReturn } = await import('../studies/handwriting/v023/engine.mjs');
  const baseline = buildFrame(2, []);
  const armed = commitReadingReturn(baseline, { path: [0, 1, 2, 3] });
  const committed = commitReadingReturn(baseline, { path: RETURN_PATH });

  assert.equal(armed.interaction, 'return-refused');
  assert.equal(armed.refusal, 'no-reading-return');
  assert.equal(armed.memory.length, 0);
  assert.equal(committed.interaction, 'return-committed');
  assert.equal(committed.memory.length, 1);
  assert.ok(committed.memory[0].directionChanges >= 1);
  assert.ok(committed.tokens.some((token, index) => token.text !== baseline.tokens[index].text));
  assert.ok(committed.tokens.some((token, index) => token.column !== baseline.tokens[index].column || token.row !== baseline.tokens[index].row));
  assert.ok(committed.memory[0].replyIndex !== committed.memory[0].anchorIndex);
});

test('reading debt changes the later reply partner instead of replaying one fixed answer', async () => {
  const { buildFrame, commitReadingReturn } = await import('../studies/handwriting/v023/engine.mjs');
  const baseline = buildFrame(1, []);
  const first = commitReadingReturn(baseline, { path: RETURN_PATH });
  const second = commitReadingReturn(first, { path: [4, 5, 6, 7, 6] });

  assert.equal(first.memory.length, 1);
  assert.equal(second.memory.length, 2);
  assert.notEqual(first.memory[0].replyIndex, second.memory[1].replyIndex);
  assert.notDeepEqual(second.tokens, first.tokens);
});

test('lifting the latest reading return restores the exact preceding sentence', async () => {
  const { buildFrame, commitReadingReturn, liftLatestReturn, geometrySignature } = await import('../studies/handwriting/v023/engine.mjs');
  const baseline = buildFrame(5, []);
  const changed = commitReadingReturn(baseline, { path: RETURN_PATH });

  assert.equal(geometrySignature(liftLatestReturn(changed)), geometrySignature(baseline));
});

test('handwriting v023 raw tableau exposes continuous typography before explanation', async () => {
  const html = await read('studies/handwriting/v023/index.html');
  const sketch = await read('studies/handwriting/v023/sketch.js');
  const style = await read('studies/handwriting/v023/style.css');

  assert.match(html, /id="reading-field"/);
  assert.match(html, /id="read-forward-control"/);
  assert.match(html, /id="turn-back-control"/);
  assert.match(html, /id="lift-return"/);
  assert.match(html, /id="release-reading"/);
  assert.match(html, /data-raw-work-id="typography-2026-10-06"/);
  assert.match(html, /id="sentence-stage"/);
  assert.match(sketch, /commitReadingReturn/);
  assert.match(sketch, /wheel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /__mutineHandwritingV023/);
  assert.match(style, /writing-mode/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: pan-y/);
});

test('handwriting v023 records the art gate, social-attention translation, and canonical daily work', async () => {
  const readme = await read('studies/handwriting/v023/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v023/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v023/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/typography-2026-10-06/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x48574923');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /reading|return|line|reply/i);
  assert.match(metrics.interactionRule, /return|wheel|keyboard/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-10-06');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'typography-2026-10-06');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/handwriting/v023/');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(work.source.translatedRule, /attention|reading|return/i);
  assert.equal(work.journal.anchor, 'journal-typography-2026-10-06');
  assert.equal(work.decision.lineage, 'typography-2026-10-05');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-06"/);
});
