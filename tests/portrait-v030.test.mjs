import test from 'node:test';
import assert from 'node:assert/strict';

const {
  AGENT_COUNT,
  buildFrame,
  geometrySignature,
  pulse
} = await import('../studies/self-portrait/v030/engine.mjs');

test('portrait v030 lets one pulse promote a non-local second opinion', () => {
  const baseline = buildFrame(0);
  const changed = pulse(baseline);
  const event = changed.memory.at(-1);

  assert.equal(baseline.composition, 'decision-population');
  assert.equal(baseline.agents.length, AGENT_COUNT);
  assert.equal(changed.memory.length, 1);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.equal(event.kind, 'second-opinion');
  assert.notEqual(event.sourceIndex, event.destinationIndex);
  assert.equal(changed.order.length, AGENT_COUNT);
  assert.equal(new Set(changed.order).size, AGENT_COUNT);
  assert.equal(changed.agents[event.sourceIndex].state, 'minority');
  assert.equal(changed.agents[event.destinationIndex].state, 'displaced');
});

test('portrait v030 exposes a semantic decision population and a causal pulse surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v030/index.html');
  const sketch = await read('studies/self-portrait/v030/sketch.js');

  assert.match(html, /data-decision-population/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-action="pulse"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /pulse\(/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /__mutinePortraitV030/);
});

test('portrait v030 publishes the settled frame as the live state in static mode', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/self-portrait/v030/sketch.js', import.meta.url), 'utf8');

  assert.match(sketch, /currentFrame = activeFrameAt\(\);/);
});
