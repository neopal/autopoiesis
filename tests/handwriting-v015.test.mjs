import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function agentDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) + Math.abs(a.angle - b.angle) * 0.02;
}

test('handwriting v015 replaces route relay with a structural attention quorum', async () => {
  const { buildFrame, constants } = await import('../studies/handwriting/v015/engine.mjs');
  const frame = buildFrame(6, []);
  const changed = buildFrame(6, [{ id: 'test-attention', stage: 6, x: 0.48, y: 0.46, force: 1, phase: 1.7 }]);
  const looking = changed.agents.filter((agent) => agent.role === 'looking');
  const answering = changed.agents.filter((agent) => agent.role === 'answering');

  assert.equal(constants.agentCount, 45);
  assert.ok(looking.length >= 3, `expected a local looking cohort, got ${looking.length}`);
  assert.ok(answering.length >= 4, `expected an answering ring, got ${answering.length}`);
  assert.ok(changed.emptySlots.length >= 1, 'expected the quorum to leave a visible vacancy');
  assert.ok(changed.quorums[0].topologyChanged);
  assert.ok(changed.agents.some((agent, index) => agentDistance(agent, frame.agents[index]) > 0.035));
});

test('handwriting v015 lifting the latest attention reconstructs the exact preceding field', async () => {
  const { buildTimeline, applyAttention, removeLatestAttention } = await import('../studies/handwriting/v015/engine.mjs');
  const frame = buildTimeline()[6];
  const changed = applyAttention(frame, { x: 0.38, y: 0.52 });
  const restored = removeLatestAttention(changed);

  assert.notDeepEqual(changed.agents, frame.agents);
  assert.deepEqual(restored.agents, frame.agents);
  assert.deepEqual(restored.memory, frame.memory);
});

test('handwriting v015 bounds visitor attention and preserves the new state machine', async () => {
  const { buildFrame, applyAttention } = await import('../studies/handwriting/v015/engine.mjs');
  const frame = buildFrame(4, []);
  const changed = applyAttention(frame, { x: 99, y: -20 });
  const event = changed.memory.at(-1);

  assert.equal(event.x, 0.93);
  assert.equal(event.y, 0.13);
  assert.equal(event.stage, frame.stage);
  assert.ok(changed.quorums[0].lookingCount >= 3);
  assert.ok(changed.quorums[0].answeringCount >= 4);
  assert.ok(changed.quorums[0].vacancyCount >= 1);
});

test('handwriting v015 raw tableau places the typographic field before its explanation', async () => {
  const html = await read('studies/handwriting/v015/index.html');

  assert.match(html, /<figure id="work" class="work artwork-frame"/);
  assert.match(html, /<canvas id="piece"/);
  assert.match(html, /id="attend-mark"/);
  assert.match(html, /id="lift-attention"/);
  assert.match(html, /data-frame="artwork-frame"/);
  assert.match(html, /raw-bridge\.js/);
  assert.match(html, /changed rule/i);
  assert.match(html, /falsifier/i);
  assert.match(html, /deletion|delete/i);
  assert.ok(html.indexOf('<figure id="work"') < html.indexOf('id="work-title"'));
});

test('handwriting v015 runtime binds pointer and keyboard to attention memory', async () => {
  const sketch = await read('studies/handwriting/v015/sketch.js');
  const style = await read('studies/handwriting/v015/style.css');

  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyAttention/);
  assert.match(sketch, /removeLatestAttention/);
  assert.match(sketch, /prefers-reduced-motion/);
  assert.match(sketch, /__mutineHandwritingV015/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /preview-mode/);
});

test('handwriting v015 records its art gate and source translation', async () => {
  const readme = await read('studies/handwriting/v015/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v015/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v015/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('attention'));
  assert.ok(metrics.interactionRule.includes('quorum'));
  assert.equal(critiques.length, 4);
});

test('handwriting v015 is the unique 2026-09-22 typography record with a canonical work page', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matching = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-22');
  const work = matching[0];
  const canonical = await read('works/typography-2026-09-22/index.html');
  const routes = await read('vercel.json');

  assert.equal(matching.length, 1);
  assert.equal(work.id, 'typography-2026-09-22');
  assert.equal(work.rawPath, '/studies/handwriting/v015/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-22');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-09-22"/);
  assert.match(routes, /"\/studies\/handwriting\/v015\/"/);
});
