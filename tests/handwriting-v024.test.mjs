import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const PRESSURE_SEQUENCE = [2, 6, 1, 7];

test('handwriting v024 begins as a deterministic material sentence field', async () => {
  const { TOKEN_COUNT, PORT_COUNT, buildFrame, geometrySignature } = await import('../studies/handwriting/v024/engine.mjs');
  const first = buildFrame(0, []);
  const repeat = buildFrame(0, []);

  assert.equal(first.composition, 'material-sentence-field');
  assert.equal(first.memory.length, 0);
  assert.equal(first.tokens.length, TOKEN_COUNT);
  assert.equal(TOKEN_COUNT, 18);
  assert.equal(PORT_COUNT, 9);
  assert.ok(first.tokens.every((token) => typeof token.text === 'string' && token.text.length > 0));
  assert.ok(first.tokens.every((token) => Number.isFinite(token.x) && Number.isFinite(token.y)));
  assert.equal(geometrySignature(first), geometrySignature(repeat));
});

test('a pressure point changes how downstream letters are produced', async () => {
  const { buildFrame, commitPressure, geometrySignature } = await import('../studies/handwriting/v024/engine.mjs');
  const baseline = buildFrame(2, []);
  const changed = commitPressure(baseline, { port: 2 });

  assert.equal(changed.interaction, 'pressure-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].port, 2);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.ok(changed.tokens.some((token, index) => token.text !== baseline.tokens[index].text));
  assert.ok(changed.tokens.some((token, index) => token.x !== baseline.tokens[index].x || token.y !== baseline.tokens[index].y || token.angle !== baseline.tokens[index].angle));
  assert.ok(changed.material.resistance > baseline.material.resistance);
});

test('material residue makes a later pressure event choose a different answer', async () => {
  const { buildFrame, commitPressure } = await import('../studies/handwriting/v024/engine.mjs');
  const baseline = buildFrame(1, []);
  const first = commitPressure(baseline, { port: 2 });
  const second = commitPressure(first, { port: 2 });

  assert.equal(first.memory.length, 1);
  assert.equal(second.memory.length, 2);
  assert.notEqual(first.memory[0].replyIndex, second.memory[1].replyIndex);
  assert.notDeepEqual(second.tokens, first.tokens);
});

test('lifting the latest pressure restores the exact preceding material field', async () => {
  const { buildFrame, commitPressure, liftLatestPressure, geometrySignature } = await import('../studies/handwriting/v024/engine.mjs');
  const baseline = buildFrame(5, []);
  const changed = commitPressure(baseline, { port: 6 });

  assert.equal(geometrySignature(liftLatestPressure(changed)), geometrySignature(baseline));
});

test('bounded pressure memory replays a deterministic settled field', async () => {
  const { MEMORY_LIMIT, buildFrame, commitPressure, geometrySignature } = await import('../studies/handwriting/v024/engine.mjs');
  let frame = buildFrame(15, []);
  for (const port of PRESSURE_SEQUENCE) frame = commitPressure(frame, { port });
  const repeat = PRESSURE_SEQUENCE.reduce((state, port) => commitPressure(state, { port }), buildFrame(15, []));

  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(frame.memory.length, 4);
  assert.equal(frame.stage, 15);
  assert.equal(frame.material.resistance, repeat.material.resistance);
  assert.equal(geometrySignature(frame), geometrySignature(repeat));
});

test('handwriting v024 raw tableau exposes a canvas material field before explanation', async () => {
  const html = await read('studies/handwriting/v024/index.html');
  const sketch = await read('studies/handwriting/v024/sketch.js');
  const style = await read('studies/handwriting/v024/style.css');

  assert.match(html, /id="pressure-field"/);
  assert.match(html, /id="press-margin"/);
  assert.match(html, /id="lift-pressure"/);
  assert.match(html, /id="release-pressure"/);
  assert.match(html, /data-raw-work-id="typography-2026-10-07"/);
  assert.match(sketch, /commitPressure/);
  assert.match(sketch, /new p5/);
  assert.match(sketch, /__mutineHandwritingV024/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});

test('handwriting v024 records the material cultural translation and canonical daily work', async () => {
  const readme = await read('studies/handwriting/v024/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v024/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v024/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/typography-2026-10-07/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x48574924');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /pressure|resistance|material/i);
  assert.match(metrics.interactionRule, /point|pressure|keyboard/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-10-07');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'typography-2026-10-07');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/handwriting/v024/');
  assert.equal(work.source.referenceId, 'p5-brush');
  assert.match(work.source.translatedRule, /resistance|material|pressure/i);
  assert.equal(work.journal.anchor, 'journal-typography-2026-10-07');
  assert.equal(work.decision.lineage, 'typography-2026-10-06');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-07"/);
});
