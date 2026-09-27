# Mutine daily studio record — 2026-09-27

## Target

- Current: Typography / Handwriting (`typography`)
- Work: `typography-2026-09-27`
- Study: `studies/handwriting/v017/`
- Title: *The sentence sets its own weight.*
- Status: **candidate / held**
- Canonical page: `/works/typography-2026-09-27/`
- Raw tableau: `/studies/handwriting/v017/`

## Artistic gate

### Repeated grammar refused

The last three Handwriting records were still organized around connected SVG/capillary route fields: pressure, proximity, relay, and altered downstream geometry. Their repeated gesture was line-based movement through a continuous sentence, with memory carried as rerouted or thickened paths.

### Structural and perceptual rupture

v017 changes the representation from one connected SVG sentence to 24 actual HTML text DOM tiles on four shelves. A bounded tap does not steer a path: it presses one real glyph into a shelf, shifts neighbouring glyphs, ejects another glyph into an impression rail, and leaves a true vacant slot. The work changes medium, composition, interaction, temporal memory, and the viewer's task before explanation.

The blind falsifier is concrete: hide labels, readout, controls, captions, and prose. Delete v017 if the type plate does not visibly carry a pressed shelf, displaced type, an ejected glyph, and a missing slot; if the ejected glyph is decorative; or if the gesture is only a weight/opacity toggle.

### Deterministic state

- Seed: `0x48574417`
- Stages: 13 (`0` through `12`)
- Tiles: 24 across 4 rows × 6 columns
- Memory window: 6 impressions
- Visitor tap and Enter/Space commit the same deterministic impression
- Delete lifts only the latest impression and restores the exact preceding DOM signature
- `r` releases the sequence to stage `0` with zero memory and zero vacancies

## Cultural translation

- Reference: `p5-brush` / [p5.brush](https://github.com/acamposuribe/p5.brush)
- Observed mechanism: pressure, density, grain, and vector fields act as programmable material forces that change how geometry is produced and remembered.
- Mutine translation: translate material pressure into typesetting pressure. A tap changes the setting rule itself: one glyph locks, local type shifts, another glyph leaves the sentence, and the next plate inherits the impression.
- Visible consequence: the blind field changes from loose shelves to a pressed setting with heavier/altered type, displaced local arrangement, an impression glyph, and a real vacancy.
- Anti-copy: no source brushes, watercolor appearance, hatching vocabulary, palette, composition, API surface, or character language is reproduced.
- Direction consequence: the Handwriting current closes the v016 capillary-sentence grammar and opens browser-native setting, occupancy, and absence as its next research direction.

## Files

- `studies/handwriting/v017/`
- `works/typography-2026-09-27/index.html`
- `tests/handwriting-v017.test.mjs`
- `tests/catalog-architecture.test.mjs`
- `tests/daily-catalog.test.mjs`
- `tests/evolution-catalog.test.mjs`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `vercel.json`
- `research/qa/proofs/typography-v017-2026-09-27/`
- `research/qa/proofs/typography-v017-2026-09-27-production/`

## Verification

- Targeted v017 test: **passed**.
- Full suite: **540 passed, 0 failed, 0 skipped, 0 todo**.
- JavaScript syntax checks: **passed** for the v017 engine, sketch, test, and browser probe.
- `git diff --check`: **passed**.
- Static security scan of staged additions: **no findings**.
- Local browser matrix: **20/20 passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced-motion modes.
- Production browser matrix: **20/20 passed** at the same five viewports and two motion modes.
- Production diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses in the browser matrix and focused readbacks.
- Overflow: **0** local and production failures; `innerWidth`, `clientWidth`, and `scrollWidth` matched in the recorded probes.
- Interaction: tap `0 → 1`, Enter `1 → 2`, Delete `2 → 1` with exact DOM-signature restoration, release `1 → 0`.
- Blind preview: type field remained visible while readout, controls, corner notation, and editorial furniture were hidden.
- Production Journal: rendered exactly one `#journal-typography-2026-09-27` entry with the title and canonical work link.
- Production current: one Handwriting current header and the `2026-09-27` work as first/latest artwork.
- Production routes: `/studio/favicon.svg`, `/favicon.ico`, `/studio/data/works.json`, `/journal/`, canonical work, and raw preview returned HTTP 200.

## Git and deployment provenance

- Final content/deployment commit: `610ffe6df3e24954e0c402d98c874f4b0d30d31a`.
- Remote `origin/main` at deployment time: `610ffe6df3e24954e0c402d98c874f4b0d30d31a`.
- Verified Vercel production deployment ID: `dpl_6zQHXbZPH7oWr1AKCgG7XikUhtoy`.
- Verified Vercel production deployment URL: `https://autopoiesis-hzy1pzv4e-lairpa-hotmailfrs-projects.vercel.app/`.
- Stable alias: https://autopoiesis-nine.vercel.app/
- Vercel listing reported `READY`, `target=production`, and `meta.githubCommitSha=610ffe6df3e24954e0c402d98c874f4b0d30d31a` for that deployment.

The Vercel listing therefore verifies the deployment-to-SHA link for the final production readback. This QA record is committed after deployment; that QA-only commit does not alter the deployed artwork content.

## Unresolved doubt

No independent caption-free perceptual reviewer was available in this unattended run. Runtime, interaction, responsive, route, and production evidence is complete, but the blind artistic question remains open: does the first-render type plate unmistakably read as a sentence being set under pressure, or does it still read as a decorated four-row grid? The candidate therefore remains honestly **candidate / held**, not exhibition-ready.
