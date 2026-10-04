import test from 'node:test';
import assert from 'node:assert/strict';

test('portrait v019 turns attention into a real local split and a remote weld', async () => {
  const {
    buildFrame,
    armClause,
    commitAttention,
    liftLatestAttention,
    geometrySignature
  } = await import('../studies/self-portrait/v019/engine.mjs');
  const baseline = buildFrame(0, []);
  const armed = armClause(baseline, 2);
  const changed = commitAttention(armed);
  const restored = liftLatestAttention(changed);
  const event = changed.memory.at(-1);

  assert.equal(armed.memory.length, 0, 'attention must arm without writing history');
  assert.equal(changed.memory.length, 1);
  assert.equal(event.source, 'visitor-attention');
  assert.equal(event.kind, 'syntax-reply');
  assert.equal(event.clauseIndex, 2);
  assert.notEqual(event.replyIndex, event.clauseIndex);
  assert.ok(changed.clauses[event.clauseIndex].split > baseline.clauses[event.clauseIndex].split);
  assert.ok(changed.clauses[event.replyIndex].weld > baseline.clauses[event.replyIndex].weld);
  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(geometrySignature(restored), geometrySignature(baseline), 'lifting the latest attention must restore the exact prior seal');
});

test('portrait v019 remembers attention debt and bounds the syntax memory', async () => {
  const { MEMORY_LIMIT, buildFrame, commitAttention, buildTimeline } = await import('../studies/self-portrait/v019/engine.mjs');
  let frame = buildFrame(0, []);
  const first = commitAttention(frame, { clauseIndex: 2 });
  const second = commitAttention(first, { clauseIndex: 2 });
  frame = second;
  for (let index = 0; index < 6; index += 1) frame = commitAttention(frame, { clauseIndex: 2 });
  const settled = buildTimeline().at(-1);

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.ok(second.memory.at(-1).resistanceBefore > first.memory.at(-1).resistanceBefore);
  assert.notEqual(second.memory.at(-1).replyIndex, first.memory.at(-1).replyIndex);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.replies.length, MEMORY_LIMIT);
});

test('portrait v019 exposes an SVG syntax seal with keyboard attention and reversible controls', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const files = [
    'studies/self-portrait/v019/index.html',
    'studies/self-portrait/v019/sketch.js',
    'studies/self-portrait/v019/style.css',
    'studies/self-portrait/v019/README.md',
    'studies/self-portrait/v019/metrics.json',
    'studies/self-portrait/v019/critiques.json'
  ];
  for (const path of files) await access(new URL(`../${path}`, import.meta.url));
  const html = await readFile(new URL('../studies/self-portrait/v019/index.html', import.meta.url), 'utf8');
  const sketch = await readFile(new URL('../studies/self-portrait/v019/sketch.js', import.meta.url), 'utf8');
  assert.match(html, /<svg[^>]+id="syntax-seal"/);
  assert.match(html, /data-gesture="attend"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /commitAttention/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /Tab|ArrowRight/);
  assert.match(sketch, /pointer.*refused|pointer-attention-refused/i);
  assert.match(sketch, /__mutinePortraitV019/);
});

test('portrait v019 has an honest daily record and canonical work route', async () => {
  const { access, readFile } = await import('node:fs/promises');
  await access(new URL('../works/portrait-2026-10-03/index.html', import.meta.url));
  const read = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const works = await read('studio/data/works.json');
  const matches = works.works.filter((work) => work.currentId === 'portrait' && work.date === '2026-10-03');
  assert.equal(matches.length, 1);
  const record = matches[0];
  assert.equal(record.id, 'portrait-2026-10-03');
  assert.equal(record.rawPath, '/studies/self-portrait/v019/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-portrait-2026-10-03');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /clause|syntax|reply/i);
  assert.ok(record.critiques.length >= 5);
});
