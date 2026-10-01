import test from 'node:test';
import assert from 'node:assert/strict';


test('handwriting v018 pressure punches a real counter and reroutes a later word', async () => {
  const { buildFrame, applyPressure, constants } = await import('../studies/handwriting/v018/engine.mjs');
  const frame = buildFrame(0, []);
  const changed = applyPressure(frame, { x: 0.42, y: 0.38 });

  assert.equal(constants.lineCount, 5);
  assert.equal(changed.accepted, true);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.perforations.length, 1);
  assert.equal(changed.perforations[0].kind, 'counter-aperture');
  assert.ok(changed.lines.some((line, index) => line.baseline !== frame.lines[index].baseline));
  assert.ok(changed.lines.some((line, index) => line.tracking !== frame.lines[index].tracking));
  assert.match(changed.perforations[0].path, /^M/);
});

test('handwriting v018 raw tableau leads with a masked typographic lock-up', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../studies/handwriting/v018/index.html', import.meta.url), 'utf8');

  assert.match(html, /<figure id="work" class="work artwork-frame"/);
  assert.match(html, /<svg id="piece"/);
  assert.match(html, /id="hold-pressure"/);
  assert.match(html, /id="lift-perforation"/);
  assert.match(html, /mask/i);
  assert.match(html, /falsifier/i);
  assert.match(html, /deletion|delete/i);
  assert.ok(html.indexOf('<figure id="work"') < html.indexOf('id="work-title"'));
});

test('handwriting v018 runtime enforces a hold threshold and exposes replay state', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/handwriting/v018/sketch.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../studies/handwriting/v018/style.css', import.meta.url), 'utf8');

  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /HOLD_MS/);
  assert.match(sketch, /applyPressure/);
  assert.match(sketch, /removeLatestPressure/);
  assert.match(sketch, /__mutineHandwritingV018/);
  assert.doesNotMatch(sketch, /pointermove/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /preview-mode/);
});

test('handwriting v018 is the unique 2026-10-01 typography record with a canonical work page', async () => {
  const { readFile } = await import('node:fs/promises');
  const register = JSON.parse(await readFile(new URL('../studio/data/works.json', import.meta.url), 'utf8'));
  const matching = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-10-01');
  const work = matching[0];
  const canonical = await readFile(new URL('../works/typography-2026-10-01/index.html', import.meta.url), 'utf8');

  assert.equal(matching.length, 1);
  assert.equal(work.id, 'typography-2026-10-01');
  assert.equal(work.rawPath, '/studies/handwriting/v018/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-typography-2026-10-01');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-01"/);
});
