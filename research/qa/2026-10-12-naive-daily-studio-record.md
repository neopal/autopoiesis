# Mutine daily studio record — Naive art v029 — 2026-10-12

## Scope and source boundary

- Audit date: **2026-10-12 local time** (`+02:00`).
- Target slot supplied by the daily runner: **Naive art / naive / 5 of 6**.
- Cultural slot supplied by the rotation rule: **little-critters**.
- Canonical source registers read: `studio/data/studio.json`, `studio/data/works.json`, and `studio/data/cultural-field.json`.
- Existing target/date record before this run: **none**. One new record was created; no historical date was invented and no complete record was mutated.
- Working register after creation: **164 works** across **6 currents**.

## Radical progression gate

The last three Naive records were:

- **v026** — *The picture miscounts its witnesses.*: inline SVG witness apertures; focus then explicit commit; three bodies miscounted.
- **v027** — *The correction shifts the whole print.*: DOM/CSS layered registration print; closed correction loop; whole stack drifts.
- **v028** — *The picture misremembers the gap.*: semantic DOM mark strip; sustained look then departure; glyph and gap migrate.

Repeated grammar rejected: sparse marks or plates, ordered field/strip composition, local attention followed by a commit/departure threshold, and semantic/stateful geometry carried by SVG or DOM.

Material rupture chosen: **change the medium, composition, and encounter**. v029 is one Canvas 2D raster cut-paper picture of twelve irregular bodies. A point only arms. A gesture must cross the centre seam repeatedly, change direction, travel far enough, and release on a different part before the picture writes a false spatial relation. The source contracts and slips, a distant relay swells and leans, and a third echo tilts; four joins remain in bounded memory and can be lifted exactly.

## Cultural translation

- **Reference:** [little-critters](https://github.com/GordenSun/little-critters)
- **Observed mechanism:** situated code-drawn agents respond to pointer proximity with legible attention and reciprocal looking, making the visitor part of a social field without a dashboard.
- **Mutine translation:** refuse animals, eyes, characters, and the look-back scene. Translate proximity into a faulty relation between picture parts: a single point only arms; a hesitant cross-seam gesture between distant parts creates a persistent false join and remote echo in the raster picture.
- **Visible consequence:** the blind first render is one contiguous naive cut-paper picture, not a population, score, aperture array, or layered print. After a valid gesture, three actual Canvas bodies move, scale, shear, and tilt; later gestures inherit those changes.
- **Falsifier:** if a click or shallow drag writes, if release location simply selects the result, if only cursor/readout changes, if fewer than three bodies change, if later joins restart from baseline, or if the blind Canvas reads as a generic chart, the translation fails.
- **Anti-copy:** no animals, characters, eyes, paper scene, source palette, source composition, source code, or head-turning image is reproduced.
- **Direction consequence:** closes the witness / registration / mark-strip sequence and opens a raster misrelation direction: a mistake is a spatial join produced by hesitation, not a moved gap or corrected layer.

## Art gate

- **Hypothesis:** if a naive picture treats proximity as a faulty relation rather than a selection, a hesitant crossing between distant parts makes the picture join those parts incorrectly and preserve a third echo.
- **Seed/state:** `0x4e413239`; 12 patches; 4-event memory window; deterministic four-gesture timeline.
- **Expected visible consequence:** one sufficiently hesitant cross-seam gesture changes three Canvas bodies before the explanation is read.
- **Interaction contract:** pointerdown arms without writing; multi-crossing/direction-changing drag commits; shallow gestures refuse; Enter and the button share a deterministic gesture; Delete lifts; R releases.
- **Deletion condition:** delete v029 after two independent labels-off/controls-off comparisons if the three changed bodies cannot be found at 390px, if release is indistinguishable from clicking the button, or if lifting is not exact.

## Repository verification

- Targeted TDD: **3 passed, 0 failed** (`tests/naive-art-v029.test.mjs`). The first run was observed red before v029 production code existed; engine implementation then passed the engine slices; the final asset/register slice passed after the canonical route and public catalog were added.
- JavaScript syntax: `node --check` passed for `studies/naive-art/v029/engine.mjs`, `sketch.js`, and `scripts/naive-art-v029-probe.mjs`.
- Full `npm run test`: **812 passed, 0 failed, 0 skipped**.
- Local headless browser matrix: **20/20** raw/canonical runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced motion.
- Local diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses; overflow failures **0**.
- Local interaction: pointerdown arming remained at memory 0; a real cross-seam multi-direction gesture committed memory 1 and changed at least three patch geometries; a shallow click was refused; Enter/button equivalence, Delete/lift, R/release, and 44px controls passed.
- Local blind preview: Canvas visible at 390px with readout, controls, and hint hidden; settled memory **4**; changed patch count **10**; no overflow.
- Local readbacks: Journal anchor/title, Naive current card/title, canonical work title/tableau, and favicon paths passed.
- Proof directory: `research/qa/proofs/naive-v029-2026-10-12/` with `report.json` and **25 PNG captures**.
- Production headless browser matrix: **20/20** raw/canonical runs passed at the same five viewports in normal and reduced-motion modes.
- Production diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses; overflow failures **0**.
- Production interaction: pointerdown arming remained memory-neutral; the real cross-seam gesture committed memory 1 and changed at least three Canvas patch geometries; shallow refusal, Enter/button equivalence, Delete/lift, R/release, blind preview, and 44px controls passed.
- Production readbacks: `/studio/data/works.json` HTTP 200 with **164** works and exactly one target; `/studio/data/catalog-public.json` HTTP 200 with **164** public works and QA evidence omitted; rendered Journal anchor/title, Naive current card/title, canonical work title/tableau, raw v029 tableau, and favicon passed.
- Production proof directory: `research/qa/proofs/naive-v029-2026-10-12-production/` with `report.json` and **25 PNG captures**.
- Git source commit deployed: `e0ac65a268e4d1bc67d2b5bba5f4f751649e6038`; deployment: `dpl_Bq6zjJRAiD8EYDyQfn5sKdd79ooG`; stable alias: `https://autopoiesis-nine.vercel.app/`.
- `git diff --check`: passed on the staged v029 diff; Git emitted only existing LF/CRLF normalization warnings for modified JSON/Markdown/JavaScript files.
- Existing unrelated worktree modifications were left untouched and unstaged.

## Publication boundary

This run remains **candidate / held**, not exhibition-ready. Local and production artifact/runtime/public-readback gates passed. Independent caption-free perceptual review and provider-level Vercel-to-Git SHA linkage remain unresolved by policy.
