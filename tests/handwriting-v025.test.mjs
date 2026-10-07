import test from 'node:test';
import assert from 'node:assert/strict';

test('handwriting v025 turns a typed character into a local refusal and a remote reply', async () => {
  const { buildFrame, commitCharacter, geometrySignature } = await import('../studies/handwriting/v025/engine.mjs');
  const baseline = buildFrame(0, []);
  const changed = commitCharacter(baseline, { clause: 3, letter: 'a' });

  assert.equal(baseline.composition, 'refusal-plate');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].letter, 'a');
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.notEqual(changed.blocks[3].text, baseline.blocks[3].text);
  assert.ok(changed.blocks.some((block, index) => index !== 3 && block.text !== baseline.blocks[index].text));
  assert.ok(changed.blocks.some((block, index) => block.x !== baseline.blocks[index].x || block.y !== baseline.blocks[index].y || block.rotation !== baseline.blocks[index].rotation));
});

test('the refusal ledger stays bounded and replays the same plate deterministically', async () => {
  const { MEMORY_LIMIT, buildFrame, commitCharacter, geometrySignature } = await import('../studies/handwriting/v025/engine.mjs');
  const events = [
    { clause: 1, letter: 'a' },
    { clause: 4, letter: 'o' },
    { clause: 8, letter: 'u' },
    { clause: 10, letter: 'i' },
    { clause: 2, letter: 'e' }
  ];
  const first = events.reduce((frame, event) => commitCharacter(frame, event), buildFrame(14, []));
  const repeat = events.reduce((frame, event) => commitCharacter(frame, event), buildFrame(14, []));

  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(first.memory.length, 4);
  assert.equal(first.material.refusalCount, 4);
  assert.equal(geometrySignature(first), geometrySignature(repeat));
  assert.equal(first.material.grammar, 'ouie');
});

test('lifting the latest refusal restores the exact preceding plate', async () => {
  const { buildFrame, commitCharacter, liftLatestCharacter, geometrySignature } = await import('../studies/handwriting/v025/engine.mjs');
  const baseline = buildFrame(3, []);
  const first = commitCharacter(baseline, { clause: 2, letter: 'a' });
  const changed = commitCharacter(first, { clause: 9, letter: 'o' });

  assert.equal(liftLatestCharacter(changed).memory.length, 1);
  assert.equal(geometrySignature(liftLatestCharacter(changed)), geometrySignature(first));
});

test('handwriting v025 raw tableau is a browser-native typographic plate before explanation', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/handwriting/v025/index.html');
  const sketch = await read('studies/handwriting/v025/sketch.js');
  const style = await read('studies/handwriting/v025/style.css');

  assert.match(html, /id="refusal-plate"/);
  assert.match(html, /id="letter-input"/);
  assert.match(html, /id="commit-letter"/);
  assert.match(html, /id="lift-letter"/);
  assert.match(html, /id="release-letters"/);
  assert.match(html, /data-raw-work-id="typography-2026-10-08"/);
  assert.doesNotMatch(html, /p5\.min\.js/);
  assert.match(sketch, /commitCharacter/);
  assert.match(sketch, /__mutineHandwritingV025/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /min-height: 44px/);
});

test('handwriting v025 records its hypothesis, cultural translation, critique, and daily route', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/handwriting/v025/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v025/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v025/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/typography-2026-10-08/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x48574925');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /refusal|reply|grammar/i);
  assert.match(metrics.interactionRule, /letter|keyboard|clause/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-10-08');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'typography-2026-10-08');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/handwriting/v025/');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(work.source.translatedRule, /refus|reply|letter/i);
  assert.equal(work.journal.anchor, 'journal-typography-2026-10-08');
  assert.equal(work.decision.lineage, 'typography-2026-10-07');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-08"/);
});

test('every offered character receives a genuinely non-local reply', async () => {
  const { buildFrame, commitCharacter } = await import('../studies/handwriting/v025/engine.mjs');
  for (let clause = 0; clause < 12; clause += 1) {
    for (const letter of ['a', 'b', 'm', 'z']) {
      const changed = commitCharacter(buildFrame(0, []), { clause, letter });
      assert.notEqual(changed.memory[0].replyIndex, clause, `${letter} at clause ${clause} replied locally`);
    }
  }
});
