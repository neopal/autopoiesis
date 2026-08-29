import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the opening evolution declares its lineage, critiques and formal metrics', async () => {
  const raw = await readFile(new URL('../galerie/data/evolutions.json', import.meta.url));
  const data = JSON.parse(raw);
  const work = data.evolutions.find((entry) => entry.id === 'typographie-manuscrite-v001');
  assert.ok(work, 'v001 must be indexed by the gallery');
  assert.equal(work.chantier, 'typographie-manuscrite');
  assert.equal(work.seed, 'mutine-v001-autopoiese');
  assert.equal(work.critiques.length, 3);
  assert.deepEqual(Object.keys(work.metrics).sort(), ['density', 'entropy', 'symmetry']);
  assert.match(work.path, /^\/chantiers\/typographie-manuscrite\/v001\//);
});

test('the studio board exposes every atelier as an honest state, not a fabricated artwork', async () => {
  const raw = await readFile(new URL('../galerie/data/studio.json', import.meta.url));
  const studio = JSON.parse(raw);
  assert.equal(studio.chantiers.length, 6);
  assert.ok(studio.chantiers.some((x) => x.state === 'active' && x.evolution === 'v001'));
  assert.ok(studio.chantiers.every((x) => ['active', 'dormant', 'archived'].includes(x.state)));
  assert.ok(studio.chantiers.filter((x) => x.state === 'dormant').every((x) => x.evolution === null));
});

test('an active Brush room has a runnable v001, evidence, and a deletion-aware metric', async () => {
  const evolutions = JSON.parse(await readFile(new URL('../galerie/data/evolutions.json', import.meta.url)));
  const studio = JSON.parse(await readFile(new URL('../galerie/data/studio.json', import.meta.url)));
  const brush = evolutions.evolutions.find((entry) => entry.id === 'p5-brush-v001');
  assert.ok(brush, 'Brush v001 must be indexed before the room is active');
  assert.equal(brush.chantier, 'p5-brush');
  assert.match(brush.path, /^\/chantiers\/p5-brush\/v001\//);
  assert.ok(brush.source?.includes('acamposuribe'), 'the work must name its source trace');
  assert.ok(Number.isFinite(brush.metrics.erasureRatio), 'the work must measure removal');
  assert.equal(brush.critiques.length, 3);
  assert.deepEqual(studio.chantiers.find((room) => room.id === 'brush'), {
    id: 'brush', title: 'Brush', state: 'active', evolution: 'v001',
    question: 'Can paint remember its removals?', href: '/chantiers/p5-brush/v001/'
  });
  for (const file of ['index.html', 'sketch.js', 'metrics.json', 'critiques.json', 'reponse.md']) {
    await readFile(new URL(`../chantiers/p5-brush/v001/${file}`, import.meta.url));
  }
});

test('exhibition surfaces declare narrow-screen recomposition instead of clipping', async () => {
  const files = [
    '../galerie/field.css',
    '../chantiers/p5-brush/v001/style.css',
    '../chantiers/typographie-manuscrite/v001/style.css'
  ];
  for (const path of files) {
    const css = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(css, /@media\s*\(max-width:\s*650px\)/, `${path} needs a small-screen composition`);
    assert.match(css, /overflow-y:\s*auto/, `${path} must permit vertical recovery instead of globally clipping interactive content`);
  }
  const fieldCss = await readFile(new URL('../galerie/field.css', import.meta.url), 'utf8');
  assert.match(fieldCss, /main\s*\{[^}]*overflow:\s*hidden/s, 'the autonomous artwork must keep its own composition bounded');
  assert.match(fieldCss, /@media\s*\(max-width:\s*650px\)/, 'the autonomous artwork needs a narrow-screen composition');
  assert.match(fieldCss, /\.title\s*\{[^}]*max-width:\s*calc\(100vw\s*-\s*36px\)/s, 'the mobile title must reserve a viewport-bounded column');
  assert.match(fieldCss, /\.title h1\s*\{[^}]*font-size:\s*clamp\(52px,14vw,78px\)/s, 'the mobile title must not grow beyond its narrow-screen composition');
});

test('the opening keeps field tests available without calling them works', async () => {
  const gallery = await readFile(new URL('../galerie/index.html', import.meta.url), 'utf8');
  assert.match(gallery, /public study/i);
  assert.match(gallery, /\/spikes\/001-subtractive-ecology\//);
  assert.match(gallery, /\/spikes\/002-disobedient-writing\//);
  assert.doesNotMatch(gallery, /field tests are works/i);
});

test('the opening encounter is an autonomous artwork, not a visitor control panel', async () => {
  const gallery = await readFile(new URL('../galerie/index.html', import.meta.url), 'utf8');
  const fieldCode = await readFile(new URL('../galerie/field.js', import.meta.url), 'utf8');
  const fieldCss = await readFile(new URL('../galerie/field.css', import.meta.url), 'utf8');
  assert.doesNotMatch(gallery, /<button\b/i, 'the opening encounter must not ask visitors to operate a UI');
  assert.match(gallery, /<canvas id="field"[^>]*aria-label="Evidence under tolerance"/);
  assert.match(gallery, /creation\s*→\s*critique\s*→\s*progression/i);
  assert.match(fieldCode, /requestAnimationFrame\(frame\)/, 'the opening artwork must advance without visitor input');
  assert.doesNotMatch(fieldCode, /addEventListener\(['"](?:click|pointer|key)/, 'the opening artwork must not rely on pointer or keyboard controls');
  assert.match(fieldCode, /function resize\(\)[\s\S]*?render\(performance\.now\(\)\)/, 'reduced-motion artwork must re-render after a resize');
  assert.match(fieldCode, /if\s*\(width\s*>=\s*650\)/, 'the moving tolerance caption must withdraw rather than clip on narrow canvases');
  assert.match(fieldCss, /canvas\s*\{[^}]*touch-action:\s*(?:auto|pan-y)/s, 'a non-interactive canvas must preserve browser touch navigation');
});
