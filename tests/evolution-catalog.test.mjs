import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

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
    id: 'brush', title: 'Brush', state: 'active', path: '/courants/brush/', evolution: 'v001',
    works: ['p5-brush-v001'], fieldTests: ['/spikes/001-subtractive-ecology/'],
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

test('the opening links every runnable study once and does not elevate a held record', async () => {
  const gallery = await readFile(new URL('../galerie/index.html', import.meta.url), 'utf8');
  const currentStudies = gallery.match(/<nav aria-label="Current studies">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(currentStudies, 'the opening must contain its explicit Current studies navigation');
  const hrefs = [...currentStudies.matchAll(/<a\s+href="([^"]+)"[^>]*>/g)].map((match) => match[1]);
  assert.deepEqual(hrefs, [
    '/chantiers/typographie-manuscrite/v002/',
    '/chantiers/p5-brush/v001/',
    '/spikes/001-subtractive-ecology/',
    '/spikes/002-disobedient-writing/'
  ], 'the explicit opening navigation must expose each runnable item once, in authored order');
  assert.doesNotMatch(currentStudies, /href="\/atelier\//, 'the held accountability record must not compete with works in opening navigation');
});

test('the opening masthead remains a genuine touch-sized exit', async () => {
  const fieldCss = await readFile(new URL('../galerie/field.css', import.meta.url), 'utf8');
  assert.match(fieldCss, /header a\s*\{[^}]*min-height:\s*44px/s, 'the MUTINE return link needs a 44px touch target');
  assert.match(fieldCss, /header a\s*\{[^}]*display:\s*inline-flex/s, 'the touch target must be an actual layout box');
  assert.match(fieldCss, /header a\s*\{[^}]*align-items:\s*center/s, 'the masthead wordmark must remain centered in its touch target');
});

test('the opening declares its own favicon instead of emitting a first-party 404', async () => {
  const gallery = await readFile(new URL('../galerie/index.html', import.meta.url), 'utf8');
  assert.match(gallery, /<link rel="icon" href="\/galerie\/favicon\.svg" type="image\/svg\+xml">/);
  await readFile(new URL('../galerie/favicon.svg', import.meta.url));
});

test('the opening field reserves the title label zone rather than letting generated marks cross it', async () => {
  const fieldCode = await readFile(new URL('../galerie/field.js', import.meta.url), 'utf8');
  assert.match(fieldCode, /document\.querySelector\(['"]\.title['"]\)\.getBoundingClientRect\(\)/, 'the renderer must read the actual title geometry rather than guess a mobile exclusion zone');
  assert.match(fieldCode, /ctx\.clip\(['"]evenodd['"]\)/, 'the renderer must exclude the reading zone from generated marks');
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

test('the public studio wall annotates every current without making the visitor operate it', async () => {
  const gallery = await readFile(new URL('../galerie/index.html', import.meta.url), 'utf8');
  const atelier = await readFile(new URL('../atelier/index.html', import.meta.url), 'utf8');
  const studio = JSON.parse(await readFile(new URL('../galerie/data/studio.json', import.meta.url)));
  const currentIds = studio.chantiers.map((current) => current.id);
  const handwriting = studio.chantiers.find((current) => current.id === 'typography');
  assert.equal(handwriting.evolution, 'v002', 'the active handwriting current must point at its progressive version');
  assert.equal(handwriting.href, '/chantiers/typographie-manuscrite/v002/');
  assert.match(gallery, /href="\/atelier\/"/, 'the artist studio must be reachable from the opening');
  assert.doesNotMatch(gallery.match(/<nav aria-label="Current studies">([\s\S]*?)<\/nav>/)?.[1] ?? '', /atelier/, 'the studio record must remain secondary to works');
  for (const id of currentIds) {
    assert.match(atelier, new RegExp(`data-current="${id}"`), `${id} needs an honest wall plate`);
  }
  assert.equal((atelier.match(/class="plate(?:\s|\")/g) ?? []).length, currentIds.length, 'the wall must have one annotated plate per current');
  assert.equal((atelier.match(/data-annotation="creation"/g) ?? []).length, currentIds.length, 'each plate needs a creation annotation');
  assert.equal((atelier.match(/data-annotation="critique"/g) ?? []).length, currentIds.length, 'each plate needs a critique annotation');
  assert.equal((atelier.match(/data-annotation="progression"/g) ?? []).length, currentIds.length, 'each plate needs a progression annotation');
  assert.doesNotMatch(atelier, /<(?:button|input|select|textarea)\b/i, 'the studio wall must not turn the visitor into an operator');
  assert.doesNotMatch(atelier, /source-gravity map|PUBLIC ACCOUNTABILITY \/ DAY 001/i, 'the public record must not repeat unsupported process claims');
});

test('Handwriting v002 is an autonomous progressive work, not a visitor-operated rewrite toy', async () => {
  const evolutions = JSON.parse(await readFile(new URL('../galerie/data/evolutions.json', import.meta.url)));
  const work = evolutions.evolutions.find((entry) => entry.id === 'typographie-manuscrite-v002');
  assert.ok(work, 'Handwriting v002 must be indexed before it can enter critique');
  assert.match(work.path, /^\/chantiers\/typographie-manuscrite\/v002\//);
  assert.equal(work.seed, 'mutine-typography-v002-memory-route');
  assert.equal(work.critiques.length, 4);
  assert.equal(work.critiques[3].persona, 'Perceptual critic');
  const html = await readFile(new URL('../chantiers/typographie-manuscrite/v002/index.html', import.meta.url), 'utf8');
  const sketch = await readFile(new URL('../chantiers/typographie-manuscrite/v002/sketch.js', import.meta.url), 'utf8');
  const engine = await readFile(new URL('../chantiers/typographie-manuscrite/v002/engine.mjs', import.meta.url), 'utf8');
  for (const file of ['style.css', 'README.md', 'metrics.json', 'critiques.json', 'reponse.md']) {
    await readFile(new URL(`../chantiers/typographie-manuscrite/v002/${file}`, import.meta.url));
  }
  assert.doesNotMatch(html, /<(?:button|input|select|textarea)\b/i, 'v002 must not ask the visitor to operate the work');
  assert.doesNotMatch(sketch, /addEventListener\s*\(/, 'v002 must not depend on visitor events');
  assert.match(sketch, /requestAnimationFrame\(frame\)/, 'v002 must progress through an authored timeline');
  assert.match(engine, /stage\s*===\s*0/, 'v002 must seed its first refusal or later stages cannot inherit memory');
  assert.match(sketch, /(?:memory|scar|revision|failure)/i, 'v002 must carry failure into a later formal decision');
  assert.match(sketch, /for\s*\(let segment = firstSegment; segment <= maxSegment; segment \+= 1\)/, 'a counter-path must begin at its declared pressure segment');
  assert.match(html, /creation\s*→\s*critique\s*→\s*progression/i);
});

test('Handwriting v002 engine makes scar deletion testable outside the canvas', async () => {
  const engine = await import(new URL('../chantiers/typographie-manuscrite/v002/engine.mjs', import.meta.url));
  const baseline = engine.buildStage(3);
  const intact = engine.makeRoutes(3, baseline.memory);
  const removed = engine.makeRoutes(3, baseline.memory.slice(0, -1));
  const changedPoints = intact.reduce((total, route, routeIndex) => total + route.points.reduce((count, point, pointIndex) => {
    const comparison = removed[routeIndex].points[pointIndex];
    return count + (point.x !== comparison.x || point.y !== comparison.y ? 1 : 0);
  }, 0), 0);
  assert.equal(JSON.stringify(baseline), JSON.stringify(engine.buildStage(3)), 'the same stage must be repeatable');
  assert.equal(baseline.memory.length, 9);
  assert.ok(changedPoints > 0, 'removing one inherited scar must alter later geometry');
});

test('Handwriting v002 exposes the refused draft beside each remembered detour', async () => {
  const engine = await import(new URL('../chantiers/typographie-manuscrite/v002/engine.mjs', import.meta.url));
  const influenced = engine.buildStage(3).routes.filter((route) => route.memoryInfluence > 0);
  assert.ok(influenced.length > 0, 'a later stage must contain routes visibly shaped by memory');
  assert.ok(influenced.some((route) => JSON.stringify(route.draftPoints) !== JSON.stringify(route.points)), 'an influenced route must retain its refused draft for visual comparison');
});

test('Handwriting v002 gives the artwork first-viewport priority over its explanation', async () => {
  const style = await readFile(new URL('../chantiers/typographie-manuscrite/v002/style.css', import.meta.url), 'utf8');
  assert.match(style, /\.opening\{[^}]*padding:7vh\s+8vw\s+4vh/, 'the opening must not spend the first viewport on a hero preface');
  assert.match(style, /\.opening h1\{[^}]*clamp\(48px,7vw,112px\)/, 'the title must yield space to the autonomous canvas');
  assert.match(style, /\.opening h1\{[^}]*font-size:clamp\(48px,7vw,52px\)/, 'the mobile title must not jump when the breakpoint closes');
});

test('the public information architecture exposes six currents, real works, field tests, and a journal', async () => {
  const studio = JSON.parse(await readFile(new URL('../galerie/data/studio.json', import.meta.url)));
  const evolutions = JSON.parse(await readFile(new URL('../galerie/data/evolutions.json', import.meta.url)));
  const currents = await readFile(new URL('../courants/index.html', import.meta.url), 'utf8');
  const works = await readFile(new URL('../oeuvres/index.html', import.meta.url), 'utf8');
  const journal = await readFile(new URL('../journal/index.html', import.meta.url), 'utf8');
  assert.deepEqual(studio.chantiers.map((current) => current.id), ['typography', 'portrait', 'svg', 'brush', 'naive', 'webgpu']);
  assert.deepEqual(studio.chantiers.map((current) => current.path), [
    '/courants/handwriting/', '/courants/self-portrait/', '/courants/pure-svg/',
    '/courants/brush/', '/courants/naive-art/', '/courants/webgpu/'
  ]);
  for (const current of studio.chantiers) assert.match(currents, new RegExp(`data-current="${current.id}"`));
  for (const evolution of evolutions.evolutions) assert.match(works, new RegExp(`href="${evolution.path.replaceAll('/', '\\/')}"`));
  assert.match(works, /field tests/i);
  assert.match(works, /id="field-tests"/);
  assert.match(works, /not works/i);
  assert.match(journal, /creation\s*→\s*critique\s*→\s*progression/i);
  assert.match(journal, /2026-08-31-v002-perceptual-critique\.md/);
  assert.match(journal, /id="writing-hold"/);
  const journalSources = [...journal.matchAll(/href="(\/research\/qa\/[^"#]+\.md)"/g)].map((match) => match[1]);
  assert.ok(journalSources.length >= 5, 'the journal must expose its evidence files');
  for (const source of journalSources) await access(new URL(`..${source}`, import.meta.url));
});

test('the four exposed routes carry the same wayfinding path back to gallery, current, works, and journal', async () => {
  const routes = [
    '../chantiers/typographie-manuscrite/v002/index.html',
    '../chantiers/p5-brush/v001/index.html',
    '../spikes/001-subtractive-ecology/index.html',
    '../spikes/002-disobedient-writing/index.html'
  ];
  for (const route of routes) {
    const html = await readFile(new URL(route, import.meta.url), 'utf8');
    assert.match(html, /aria-label="Studio navigation"/i, `${route} needs the shared studio navigation`);
    assert.match(html, /href="\/galerie\/"/);
    assert.match(html, /href="\/courants\/"/);
    assert.match(html, /href="\/oeuvres\/"/);
    assert.match(html, /href="\/journal\/"/);
    const globalNav = html.match(/<nav class="studio-nav"[\s\S]*?<\/nav>/i)?.[0] ?? '';
    assert.doesNotMatch(globalNav, /aria-current="page"/i, `${route} must not call gallery the current page`);
    assert.match(html, /aria-label="Studio path"/i, `${route} needs a breadcrumb path`);
    assert.match(html, /creation\s*→\s*critique\s*→\s*progression/i, `${route} needs the public process loop`);
  }
});

test('shared wayfinding rails align with the isolated work surface', async () => {
  const css = await readFile(new URL('../galerie/wayfinding.css', import.meta.url), 'utf8');
  assert.match(css, /\.studio-path\s*\{[\s\S]*max-width:\s*1060px/);
  assert.match(css, /\.studio-context\s*\{[\s\S]*max-width:\s*1060px/);
});

test('the artist wall links every annotated plate to its current page', async () => {
  const raw = await readFile(new URL('../galerie/data/studio.json', import.meta.url));
  const studio = JSON.parse(raw);
  const wall = await readFile(new URL('../atelier/index.html', import.meta.url), 'utf8');
  for (const current of studio.chantiers) {
    const plate = wall.match(new RegExp(`<article[^>]*data-current="${current.id}"[\\s\\S]*?<\\/article>`))?.[0] ?? '';
    assert.ok(plate.includes(`href="${current.path}"`), `${current.id} plate needs a current link`);
  }
});
