# MUTINE daily studio record — Brush / 2026-10-13

## Slot

- Current: `brush`
- Work: `brush-2026-10-13`
- Title: *The paint stores a pressure debt.*
- Status: `candidate / held`
- Raw tableau: `/studies/p5-brush/v030/`
- Canonical work: `/works/brush-2026-10-13/`
- Journal anchor: `journal-brush-2026-10-13`

## Cultural translation

- Reference: [p5.brush](https://github.com/acamposuribe/p5.brush)
- Observed mechanism: programmable pressure, density, grain, and directional fields participate in producing geometry rather than decorating finished geometry.
- Mutine translation: refuse brush marks, watercolor, hatching, source palette, source composition, and library vocabulary; translate material agency into a pressure debt whose resistance redistributes one bounded pulse through a local buckle, a remote lift, and a third seam scar.
- Visible consequence: the blind first view is one suspended folded pigment sheet with nine register folds and a dark underside seam. A valid pulse changes three non-local fold silhouettes; later pulses inherit the altered sheet.
- Falsifier: waiting, pointer location, a pressure ring, or readout must not be the sole cause; weak and over-held pulses must refuse; fewer than three fold geometries, forgotten debt, or inexact lifting would fail the translation.
- Anti-copy: no source brush, watercolor, hatching, palette, composition, example, or API surface is reproduced.

## Radical progression

The last three Brush records were: v027 detached scrape/fracture islands, v028 a continuous wounded reservoir that mends elsewhere, and v029 a radial sediment mass that changes under stillness. v030 makes a structural rupture across at least two perceptual dimensions: one vertical folded sheet replaces populations/reservoir/radial mass, and a short discrete press-release pulse replaces scrape, route mending, or dwell. The pointer arms the event but cannot choose its consequence; the sheet's resistance assigns three fold roles and retains four debts.

## Art gate

- Changed rule: a bounded pressure pulse is redistributed through one nine-fold sheet into a local buckle, a remote lift, and a third seam scar.
- Deterministic state: seed `0x42525530`; `9` folds; `13` stages; settled stage `12`; memory window `4`; primitive budget `9`.
- Meaningful interaction: pointer/touch down arms; release between `120ms` and `560ms` commits; weak and over-held releases refuse; Enter, Space, and the pulse control commit deterministic events; Delete lifts the latest debt; R releases all.
- Falsifier: if the first view reads as a generic strip or radial chart, if the entry point selects the buckle, if three fold bodies do not change, if bounded memory is not inherited, or if exact lift fails, delete this direction.
- Deletion condition: remove v030 from the public register rather than polishing it if the blind sheet remains a generic strip or the causal/undo contract breaks.

## Implementation

- `studies/p5-brush/v030/index.html`
- `studies/p5-brush/v030/engine.mjs`
- `studies/p5-brush/v030/sketch.js`
- `studies/p5-brush/v030/style.css`
- `studies/p5-brush/v030/README.md`
- `studies/p5-brush/v030/metrics.json`
- `studies/p5-brush/v030/critiques.json`
- `tests/brush-v030.test.mjs`
- `scripts/brush-v030-probe.mjs`
- `works/brush-2026-10-13/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `research/qa/proofs/brush-v030-2026-10-13/`

## Verification observed locally

- TDD RED: the new v030 targeted suite failed before the implementation existed; subsequent implementation passed the targeted behavior tests.
- Targeted v030 suite: passed.
- Full suite: `840 passed, 0 failed`.
- JavaScript syntax: `engine.mjs`, `sketch.js`, and `brush-v030-probe.mjs` passed `node --check`.
- `git diff --check`: passed; Git emitted only existing LF/CRLF normalization warnings.
- Browser matrix: `20/20` raw/canonical runs passed at `320x568`, `390x844`, `768x1024`, `1280x800`, and `1920x1080`, normal and reduced-motion.
- Viewport evidence: measured `innerWidth`, `clientWidth`, and `scrollWidth` matched on every run; no horizontal overflow.
- Diagnostics: `0` console messages, page errors, failed requests, or HTTP 400+ responses across matrix and readback probes; favicon returned HTTP 200 as SVG.
- Interaction: pointer arming stayed at memory `0`; a weak `20ms` pulse refused; a `260ms` pulse committed memory `0 -> 1` and produced one buckle, one lift, and one scar; a `620ms` over-held pulse refused; deterministic control and keyboard paths committed; Delete restored the preceding signature; R released memory.
- Blind preview: at `390x844`, field and canvas remained visible while readout, controls, hint, and annotation furniture were hidden; settled deterministic state reported stage `12`, memory `4`, and four buckle/lift/scar roles.
- Touch targets: all three controls measured `44px` high at `390x844`.
- Local publication readbacks: Journal anchor, Brush current title, canonical work title, embedded v030 tableau, public catalog, and favicon were present.

## Evidence boundary

This is a local candidate record. Production deployment, public HTTP readback, and provider-level deployment-to-SHA linkage remain unresolved until the authorized release step. The candidate remains `held` pending an independent caption-free perceptual comparison of the blind sheet against v027–v029; technical evidence alone does not prove that the sheet reads as an authored material body rather than a generic strip.
