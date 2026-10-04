import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));


test('handwriting v021 begins as a deterministic orbital sentence around a listening void', async () => {
  const { GLYPH_COUNT, buildFrame, geometrySignature } = await import('../studies/handwriting/v021/engine.mjs');
  const first = buildFrame(3, []);
  const repeat = buildFrame(3, []);

  assert.equal(first.composition, 'orbital-sentence-listening-void');
  assert.equal(first.memory.length, 0);
  assert.equal(first.glyphs.length, GLYPH_COUNT);
  assert.ok(first.glyphs.every((glyph) => glyph.char.length === 1));
  assert.ok(first.glyphs.every((glyph) => Number.isFinite(glyph.theta) && Number.isFinite(glyph.orbit)));
  assert.equal(geometrySignature(first), geometrySignature(repeat));
  assert.ok(first.glyphs.some((glyph) => glyph.depth !== 0 || glyph.angle !== 0));
});


test('approach only arms a witness while a committed departure turns a local glyph and a remote partner', async () => {
  const { buildFrame, armWitness, commitWitness } = await import('../studies/handwriting/v021/engine.mjs');
  const baseline = buildFrame(2, []);
  const armed = armWitness(baseline, 4);
  const committed = commitWitness(armed, { witnessIndex: 4, direction: -1, dwell: 620 });

  assert.equal(armed.interaction, 'witness-armed');
  assert.equal(armed.memory.length, 0);
  assert.equal(committed.interaction, 'witness-committed');
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].kind, 'reciprocal-glance');
  assert.equal(committed.memory[0].witnessIndex, 4);
  assert.notEqual(committed.glyphs[4].angle, baseline.glyphs[4].angle);
  assert.ok(committed.glyphs.some((glyph, index) => index !== 4 && glyph.replyTo === 4 && glyph.angle !== baseline.glyphs[index].angle));
  assert.ok(committed.attentionDebt > baseline.attentionDebt);
});


test('repeated attention debt changes the later partner instead of replaying a fixed look-back', async () => {
  const { buildFrame, commitWitness } = await import('../studies/handwriting/v021/engine.mjs');
  const baseline = buildFrame(1, []);
  const first = commitWitness(baseline, { witnessIndex: 2, direction: 1, dwell: 700 });
  const second = commitWitness(first, { witnessIndex: 2, direction: 1, dwell: 700 });

  assert.equal(first.memory.length, 1);
  assert.equal(second.memory.length, 2);
  assert.notEqual(first.memory[0].replyIndex, second.memory[1].replyIndex);
  assert.ok(second.attentionDebt > first.attentionDebt);
  assert.notDeepEqual(second.glyphs, first.glyphs);
});


test('lifting the latest reciprocal glance restores the exact preceding orbital sentence', async () => {
  const { buildFrame, commitWitness, liftLatestWitness, geometrySignature } = await import('../studies/handwriting/v021/engine.mjs');
  const baseline = buildFrame(5, []);
  const changed = commitWitness(baseline, { witnessIndex: 7, direction: -1, dwell: 880 });

  assert.equal(geometrySignature(liftLatestWitness(changed)), geometrySignature(baseline));
});


test('handwriting v021 raw tableau exposes the reciprocal typography encounter before explanation', async () => {
  const html = await read('studies/handwriting/v021/index.html');
  const sketch = await read('studies/handwriting/v021/sketch.js');
  const style = await read('studies/handwriting/v021/style.css');

  assert.match(html, /p5\.js\/1\.11\.3\/p5\.min\.js/);
  assert.match(html, /id="listening-field"/);
  assert.match(html, /id="turn-toward-control"/);
  assert.match(html, /id="lift-glance"/);
  assert.match(html, /id="release-glances"/);
  assert.match(html, /data-raw-work-id="typography-2026-10-04"/);
  assert.match(sketch, /armWitness/);
  assert.match(sketch, /commitWitness/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /__mutineHandwritingV021/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});


test('handwriting v021 records the art gate, little-critters translation, and canonical daily work', async () => {
  const readme = await read('studies/handwriting/v021/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v021/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v021/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/typography-2026-10-04/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x48574921');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /attention|reply|glance/i);
  assert.match(metrics.interactionRule, /approach|departure|witness/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-10-04');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'typography-2026-10-04');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/handwriting/v021/');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(work.source.translatedRule, /witness|reply|attention/i);
  assert.equal(work.journal.anchor, 'journal-typography-2026-10-04');
  assert.equal(work.decision.lineage, 'typography-2026-10-03');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-04"/);
});
