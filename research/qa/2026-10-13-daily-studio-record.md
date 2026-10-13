# MUTINE daily studio record — 2026-10-13

## Target

- Current: `portrait` / Self portrait
- Work: `portrait-2026-10-13`
- Title: **The portrait elects an absence.**
- Version: `v026`
- Status: `candidate / held`
- Canonical route: `/works/portrait-2026-10-13/`
- Raw study: `/studies/self-portrait/v026/`
- Journal anchor: `journal-portrait-2026-10-13`

## Artistic gate

### Hypothesis

A self-portrait can portray not only its state but the distributed decision by which it changes: attention can accumulate locally while the portrait elects a remote absence.

### Changed rule

v026 abandons the prior object, membrane, and decision-ribbon grammars. Fifteen irregular semantic DOM marks form a single witness field. Pointer, touch, or keyboard proximity only arms a mark and records exposure; an explicit Enter, Space, witness-control, or focused touch commitment elects three *other* consequences: the least-seen remote mark becomes absent, the most exposed eligible remote mark replies, and a third mark carries a counter-decision. Four elections are retained. Delete/lift reconstructs the exact preceding field; `R` releases bounded attention.

### Visible consequence

The blind field is a quiet, spacious manuscript of fifteen irregular marks with faint threads and no explanatory furniture. After a commitment the visited mark remains present but witnessed, while a remote mark opens into absence, another stretches/reorients as reply, and a third takes the counter-shear. Later elections inherit exposure rather than restarting from baseline.

### Falsifier

The translation fails if visiting changes geometry before commitment, the visited mark is always the one that changes, the remote reply is only a colour/readout effect, later elections ignore exposure, lift is not exact, or the blind view reads as a dashboard, card grid, face, membrane, ribbon, or generic constellation.

### Deletion condition

Delete v026 if the labels/readout/controls/prose-off field cannot carry the causal distinction, or if the remote absence/reply/counter-decision cannot be found in actual DOM geometry after interaction.

### Radical progression

The last three self-portrait records repeated an object/field that watched, measured, or routed a visitor through a continuous visual surface. v026 makes a material rupture in representation and encounter: Canvas object → semantic DOM manuscript; direct/local response → non-local election; departure/withdrawal → explicit commitment; one current state → bounded collective memory. The rupture is in the engine (`commitWitness` elects remote indices), the interaction (arming is geometry-neutral until commitment), and the rendered field (the visited mark remains while remote marks change).

## Cultural translation

- Reference: [little-critters](https://github.com/GordenSun/little-critters)
- Observed mechanism: a population of code-drawn agents responds to pointer proximity with situated attention and reciprocal looking, making the visitor part of a social field without a dashboard.
- Mutine translation: refuse animals, eyes, character designs, and the look-back scene; translate situated reciprocity into a non-figurative witness field in which local exposure is stored but commitment is answered by a remote absence election.
- Visible consequence: a scattered manuscript of abstract marks; commitment opens a remote gap, makes an exposed mark reply, and gives a third mark the counter-decision.
- Anti-copy: no source animals, character designs, scene, palette, composition, API surface, or image vocabulary is reproduced.
- Direction consequence: closes the direct-target / unseen-face / self-measuring sequence and opens distributed attention as a self-portrait decision grammar.

## Files

- `studies/self-portrait/v026/index.html`
- `studies/self-portrait/v026/sketch.js`
- `studies/self-portrait/v026/engine.mjs`
- `studies/self-portrait/v026/style.css`
- `studies/self-portrait/v026/README.md`
- `studies/self-portrait/v026/metrics.json`
- `studies/self-portrait/v026/critiques.json`
- `tests/portrait-v026.test.mjs`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `works/portrait-2026-10-13/index.html`
- `tests/catalog-architecture.test.mjs`
- `tests/daily-catalog.test.mjs`
- `tests/evolution-catalog.test.mjs`
- `research/qa/proofs/portrait-v026-2026-10-13/` (local captures and `results.json`)

## Verification evidence

- TDD regression: the keyboard-focus assertion was added first and observed failing; `node --test tests/portrait-v026.test.mjs` then passed **7/7** after the minimal focus-preservation fix.
- Full suite: `npm test` passed **829/829**.
- Syntax: `node --check studies/self-portrait/v026/sketch.js` and `node --check studies/self-portrait/v026/engine.mjs` passed.
- Local browser matrix: **20/20** raw/canonical runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, in normal and reduced-motion modes.
- Local browser diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses across the matrix, interaction, blind preview, Journal, current, and canonical work readbacks.
- Responsive evidence: all runs kept `innerWidth === clientWidth` and `scrollWidth === clientWidth`; all three interaction controls measured `44px` high at `390×844`.
- Interaction evidence: the first witness kept the geometry signature unchanged; real Playwright `mark.click()` followed by `mark.press('Enter')` committed a remote absence election (`witnessIndex: 4`, `absenceIndex: 0`); lift returned memory to `0`; `R` released bounded memory; the witness control committed a second election; Delete/lift returned the exact preceding signature.
- Blind evidence: reduced-motion static blind preview at `390×844` kept all 15 marks visible while hiding readout, controls, and hint; no horizontal overflow.
- Route evidence: local `/journal/`, `/currents/self-portrait/`, and `/works/portrait-2026-10-13/` rendered the anchor, work card, canonical title, and embedded v026 tableau.
- Catalog generation: `node scripts/generate-work-pages.mjs` generated the daily pages; `node scripts/build-public-catalog.mjs` generated `studio/data/catalog-public.json`.
- `git diff --check` passed.

## Release decision

The artifact is recorded honestly as `candidate / held`. Local structural, interaction, and responsive evidence is complete. It is not called exhibition-ready: an independent caption-free perceptual review of the blind field remains unresolved, and production deployment/readback plus provider-level Git SHA linkage must occur after the release commit.
