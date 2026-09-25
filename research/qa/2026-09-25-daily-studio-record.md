# Mutine daily studio record — 2026-09-25

## Target

- Current: Self portrait (`portrait`)
- Work: `portrait-2026-09-25`
- Study: `studies/self-portrait/v016/`
- Title: *The portrait loses the watched patch.*
- Status: **candidate / held**
- Observed at: `2026-09-25 04:59:17 +0200`

## Artistic gate

### Repeated grammar refused

The last three Self portrait works used a visitor event to change one coherent face or one of its parts: v013 folded routes, v014 answered in reciprocal plates, and v015 yielded a pressure membrane. Their repeated gesture was local attention → local reply or rupture → reversible recovery.

### Structural and perceptual rupture

v016 abandons contour, plates, membrane, routes, and local reply. It presents a dense oblique raster population of image cells. Pointer movement only arms a witness; a committed hold, click/tap, Enter, or Space withdraws actual density from the nearest patch and transfers it to a distant patch. A resistance map changes the next transfer, so repeated attention is not a replay. Lifting the latest witness reconstructs the exact preceding raster.

This changes representation (continuous geometry → raster population), composition (single body/parts → distributed field), encounter (press or look for a reply → sustained attention), temporal behaviour (scar or part memory → bounded non-local inheritance), and viewer task. It is not a palette, texture, density, title, or annotation variation.

### Falsifier and deletion condition

Hide the readout, controls, witness marks, annotations, and prose. The direction fails if the viewer sees a decorated dot field rather than an image that can withdraw one real patch and transfer density elsewhere; if the source only changes tint; if the receiver only receives a marker; or if repeated attention ignores resistance. Delete v016 rather than polishing it if a caption-free comparison confirms that the raster does not read as a self-image or that the transfer is not visible in the cells.

## Cultural translation

- Reference: `little-critters` — https://github.com/GordenSun/little-critters
- Observed mechanism: situated code-drawn agents respond to pointer proximity by changing attention and looking back, making the visitor part of a reciprocal encounter rather than a dashboard operator.
- Mutine translation: remove agents and invert the reply. Situated attention becomes a witness token inside a raster image; the nearest patch withdraws density, a distant patch inherits it, and local resistance changes the next collective decision.
- Visible consequence: the blind field is a dense raster self-image; after attention, one actual cell population thins and opens while a distant population grows and shifts.
- Anti-copy statement: no animals, characters, eyes, paper style, head-turning scene, source palette, composition, or surface vocabulary is reproduced.
- Direction consequence: close the v013–v015 folded-route, reciprocal-plate, and pressure-membrane grammar; open a social-attention direction in which a raster population remembers being watched through non-local withdrawal and inheritance.

## Files

- `studies/self-portrait/v016/index.html`
- `studies/self-portrait/v016/engine.mjs`
- `studies/self-portrait/v016/sketch.js`
- `studies/self-portrait/v016/style.css`
- `studies/self-portrait/v016/README.md`
- `studies/self-portrait/v016/metrics.json`
- `studies/self-portrait/v016/critiques.json`
- `works/portrait-2026-09-25/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/portrait-v016.test.mjs`
- Updated catalogue assertions in `tests/catalog-architecture.test.mjs`, `tests/daily-catalog.test.mjs`, and `tests/evolution-catalog.test.mjs`
- `scripts/portrait-v016-probe.mjs`
- `research/qa/proofs/portrait-v016-2026-09-25/` (`results.json`, `probe.mjs`, `interaction.png`, `blind.png`, `production-results.json`, `production-interaction.png`, `production-blind.png`)

## Verification

- Targeted v016 tests: **7 passed, 0 failed**.
- Full suite: **494 passed, 0 failed, 0 skipped, 0 todo**.
- Changed JavaScript syntax: **PASS** for v016 engine, sketch, targeted test, and browser probe.
- JSON validation: **PASS** for the work register, public catalogue, v016 metrics, v016 critiques, and production proof summary.
- `git diff --check`: **PASS**.
- Local headless browser matrix: **20/20 runs passed** — canonical and raw routes at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced motion.
- Local diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses in all matrix runs.
- Local overflow: every matrix run had `innerWidth == clientWidth == scrollWidth`.
- Local interaction: pointer movement armed without changing memory; click committed `0 → 1`; Enter committed `1 → 2`; Delete lifted the latest witness and restored the prior signature; release returned memory to `0`.
- Local blind preview: the canvas remained visible while readout and controls were hidden; `innerWidth == clientWidth == scrollWidth == 390`.
- Stable-alias production browser matrix: **20/20 runs passed** at the same five viewports and motion modes; zero matrix failures.
- Production interaction: pointer movement left memory at `0`; click committed `0 → 1`; Enter committed `1 → 2`; Delete restored the prior witness state at `1`; release returned memory to `0`.
- Production blind preview: canvas visible, readout and controls hidden, and `innerWidth == clientWidth == scrollWidth == 390`.
- Production HTTP readback: register, Journal, canonical work, raw tableau, and favicon all returned HTTP 200; the register contained exactly one `portrait-2026-09-25` record with the title and canonical mount/raw canvas were present.
- Production rendered Journal readback: exactly one `#journal-portrait-2026-09-25` entry, title present, canonical work link present, and zero console messages, page errors, or failed requests.
- The proof bundle contains local and production matrix summaries, interaction/blind captures, and the local probe source.

## Git and deployment

- Implementation commit: `0b31cb99555515509b7ec1d25fca2837cc668eb7`.
- Evidence commit: `b5fbac726c77e7c6c2112e08d5706c8f15caa97e`.
- `origin/main`: matched the evidence commit after push.
- Initial production deployment carrying the artwork: `dpl_EhuXBUKhjkQtqxDGerP57U6K4uR5`.
- Final production deployment carrying the evidence update: `dpl_7e2cQQ4kMsMTN6YLm7T2dw5NW2UT`.
- Stable alias: `https://autopoiesis-nine.vercel.app/`.

## Publication boundary

The local artifact, canonical page, register, Journal data, structural tests, local browser evidence, production browser evidence, and stable-alias readback are real. Independent caption-free perceptual comparison and provider revision linkage from the stable alias to the GitHub SHA remain unresolved. The work therefore remains honestly **candidate / held**, not exhibition-ready.
