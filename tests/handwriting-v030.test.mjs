import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('handwriting v030 turns a typed letter into a sentence-wide refusal', async () => {
  const {
    BASE_TEXT,
    buildFrame,
    geometrySignature,
    offerLetter
  } = await import('../studies/handwriting/v030/engine.mjs');

  const baseline = buildFrame();
  const offered = offerLetter(baseline, 'e');

  assert.equal(baseline.material.text, BASE_TEXT);
  assert.equal(baseline.material.lastEvent, 'quiet');
  assert.equal(offered.material.lastEvent, 'accepted');
  assert.equal(offered.memory.length, 1);
  assert.equal(offered.material.refusedLetters[0], 'E');
  assert.ok(offered.glyphs.some((glyph) => glyph.removed && glyph.original === 'E'));
  assert.notEqual(geometrySignature(offered), geometrySignature(baseline));
  assert.equal(offered.material.acceptedCount, 1);
});

test('handwriting v030 refuses a repeated letter without inventing a new event', async () => {
  const { buildFrame, geometrySignature, offerLetter } = await import('../studies/handwriting/v030/engine.mjs');
  const first = offerLetter(buildFrame(), 'e');
  const repeated = offerLetter(first, 'e');

  assert.equal(repeated.material.lastEvent, 'refused');
  assert.equal(repeated.material.refusedCount, 1);
  assert.equal(repeated.memory.length, first.memory.length);
  assert.equal(geometrySignature(repeated), geometrySignature(first));
});

test('handwriting v030 keeps four refusals liftable and bases the fifth on the changed sentence', async () => {
  const {
    MEMORY_LIMIT,
    buildFrame,
    geometrySignature,
    liftLatest,
    offerLetter,
    releaseFrame
  } = await import('../studies/handwriting/v030/engine.mjs');

  const letters = ['e', 'a', 'i', 'o', 't'];
  const baseline = buildFrame();
  const first = offerLetter(baseline, letters[0]);
  const second = offerLetter(first, letters[1]);
  const third = offerLetter(second, letters[2]);
  const fourth = offerLetter(third, letters[3]);
  const fifth = offerLetter(fourth, letters[4]);

  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(fifth.memory.length, MEMORY_LIMIT);
  assert.equal(fifth.material.acceptedCount, 5);
  assert.notEqual(fifth.material.text, fourth.material.text);
  assert.equal(geometrySignature(liftLatest(fifth)), geometrySignature(fourth));
  assert.equal(geometrySignature(releaseFrame(fifth)), geometrySignature(baseline));
});

test('handwriting v030 keeps release keys available after a letter button takes focus', async () => {
  const sketch = await readFile(new URL('../studies/handwriting/v030/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /document\.addEventListener\(['"]keydown['"], handleKey\)/);
});

test('handwriting v030 metrics count the sentence actually rendered by the engine', async () => {
  const [{ BASE_TEXT }, metricsText] = await Promise.all([
    import('../studies/handwriting/v030/engine.mjs'),
    readFile(new URL('../studies/handwriting/v030/metrics.json', import.meta.url), 'utf8')
  ]);
  const metrics = JSON.parse(metricsText);
  const letterCount = [...BASE_TEXT].filter((character) => /^[A-Z]$/.test(character)).length;
  assert.equal(metrics.characterCount, BASE_TEXT.length);
  assert.equal(metrics.letterCount, letterCount);
  assert.equal(metrics.primitiveBudget, BASE_TEXT.length);
});
