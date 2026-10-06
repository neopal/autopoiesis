import test from 'node:test';
import assert from 'node:assert/strict';

const {
  CHOICES,
  MEMORY_LIMIT,
  buildFrame,
  chooseBranch,
  liftLatestChoice,
  geometrySignature
} = await import('../studies/self-portrait/v022/engine.mjs');

test('portrait v022 turns one binary choice into a structural self-rebuttal', () => {
  const baseline = buildFrame(0, []);
  const changed = chooseBranch(baseline, 'left');
  const restored = liftLatestChoice(changed);
  const event = changed.memory.at(-1);

  assert.deepEqual(CHOICES, ['left', 'right']);
  assert.equal(baseline.memory.length, 0);
  assert.equal(changed.memory.length, 1);
  assert.equal(event.kind, 'self-rebuttal');
  assert.equal(event.choice, 'left');
  assert.notEqual(event.nodeIndex, event.replyIndex);
  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.ok(changed.nodes[event.nodeIndex].state === 'kept');
  assert.ok(changed.nodes[event.rejectedIndex].state === 'refused');
  assert.ok(changed.nodes[event.replyIndex].counter > baseline.nodes[event.replyIndex].counter);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
});

test('portrait v022 accepts a right choice from the initial cursor', () => {
  const changed = chooseBranch(buildFrame(0, []), 'right');
  const event = changed.memory.at(-1);

  assert.equal(event.choice, 'right');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.nodes[event.nodeIndex].state, 'kept');
  assert.equal(changed.nodes[event.rejectedIndex].state, 'refused');
});

test('portrait v022 makes a remembered refusal alter the next counterargument', () => {
  const baseline = buildFrame(0, []);
  const first = chooseBranch(baseline, 'left');
  const second = chooseBranch(first, 'left');
  const firstEvent = first.memory.at(-1);
  const secondEvent = second.memory.at(-1);

  assert.equal(second.memory.length, 2);
  assert.notEqual(secondEvent.replyIndex, firstEvent.replyIndex);
  assert.ok(secondEvent.nodeIndex !== firstEvent.nodeIndex, 'the portrait must move its active condition');
  assert.ok(second.nodes[secondEvent.replyIndex].counter > 0);
});

test('portrait v022 bounds choice memory and replays a deterministic timeline', async () => {
  let frame = buildFrame(0, []);
  for (let index = 0; index < 9; index += 1) frame = chooseBranch(frame, index % 2 ? 'right' : 'left');
  const { buildTimeline } = await import('../studies/self-portrait/v022/engine.mjs');
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(timeline.length, 19);
  assert.equal(settled.stage, 18);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.memory.at(-1).kind, 'self-rebuttal');
});

test('portrait v022 exposes a caption-free branching encounter with reversible choice', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v022/index.html');
  const sketch = await read('studies/self-portrait/v022/sketch.js');
  const style = await read('studies/self-portrait/v022/style.css');
  const readme = await read('studies/self-portrait/v022/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v022/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v022/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-10-06"/);
  assert.match(html, /id="decision-field"/);
  assert.match(html, /data-choice="left"/);
  assert.match(html, /data-choice="right"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /chooseBranch/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /ArrowLeft|ArrowRight/);
  assert.match(sketch, /__mutinePortraitV022/);
  assert.match(sketch, /renderFrame\(frozen \? timeline\.at\(-1\) : currentFrame\)/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.measured, true);
  assert.equal(metrics.renderer, 'deterministic browser-native branching atlas');
  assert.match(metrics.memoryRule, /refus|rebuttal/i);
  const { buildTimeline } = await import('../studies/self-portrait/v022/engine.mjs');
  const settled = buildTimeline().at(-1);
  assert.equal(metrics.settledKept, settled.nodes.filter((node) => node.state === 'kept').length);
  assert.equal(metrics.settledRefused, settled.nodes.filter((node) => node.state === 'refused').length);
  assert.equal(metrics.settledCounters, settled.nodes.filter((node) => node.state === 'counter').length);
  assert.equal(critiques.length, 6);
});

test('portrait v022 is the unique 2026-10-06 daily work with a canonical route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'portrait' && work.date === '2026-10-06');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-06/index.html');

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'portrait-2026-10-06');
  assert.equal(record.rawPath, '/studies/self-portrait/v022/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-portrait-2026-10-06');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /refus|branch|counter/i);
  assert.ok(record.critiques.length >= 6);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-06"/);
});
