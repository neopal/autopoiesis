import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_PHONEMES,
  applyAddress,
  buildInitialState,
  removeLatestAddress,
  signature
} from '../studies/handwriting/v019/engine.mjs';

test('v019 starts as a deterministic situated glyph field with no replies or vacancies', () => {
  const state = buildInitialState();

  assert.equal(state.stage, 0);
  assert.equal(state.memory.length, 0);
  assert.equal(state.replyCount, 0);
  assert.equal(state.vacancyCount, 0);
  assert.ok(state.glyphs.length > 20);
  assert.ok(state.glyphs.every((glyph) => glyph.sourceSlot === glyph.slot));
});

test('an addressed phoneme removes matching glyphs from their source slots and gathers them in the reply channel', () => {
  const before = buildInitialState();
  const after = applyAddress(before, DEFAULT_PHONEMES[0]);
  const answered = after.glyphs.filter((glyph) => glyph.reply);

  assert.equal(after.memory.length, 1);
  assert.ok(answered.length > 0);
  assert.equal(after.replyCount, answered.length);
  assert.equal(after.vacancyCount, answered.length);
  assert.ok(answered.every((glyph) => glyph.char === DEFAULT_PHONEMES[0]));
  assert.ok(answered.every((glyph) => glyph.slot !== glyph.sourceSlot));
  assert.ok(after.sourceHoles.some((hole) => hole.sourceSlot));
});

test('lifting the latest address reconstructs the exact preceding field signature', () => {
  const initial = buildInitialState();
  const first = applyAddress(initial, DEFAULT_PHONEMES[0]);
  const second = applyAddress(first, DEFAULT_PHONEMES[1]);
  const restored = removeLatestAddress(second);

  assert.equal(restored.memory.length, 1);
  assert.equal(signature(restored), signature(first));
  assert.notEqual(signature(second), signature(first));
});

test('v019 is recorded once for the typography daily slot with a navigable tableau', async () => {
  const catalog = JSON.parse(await readFile('studio/data/works.json', 'utf8'));
  const matches = catalog.works.filter((work) => work.currentId === 'typography' && work.date === '2026-10-02');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].rawPath, '/studies/handwriting/v019/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].metrics.representationRupture, /HTML|glyph|channel/i);
  assert.ok(matches[0].critiques.length >= 5);
  assert.match(await readFile('works/typography-2026-10-02/index.html', 'utf8'), /data-catalog-work-detail="typography-2026-10-02"/);
});
