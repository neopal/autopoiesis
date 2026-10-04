# Mutine daily studio record — Brush v022

- **Target:** Brush (`brush`)
- **Date:** `2026-10-02`
- **Work:** *The brush seals a pause.*
- **Status:** **candidate / held**

## Creative direction

v022 breaks the last three Brush grammars: v019's hanging pigment register, v020's suspended drying coil, and v021's cellular grain cut. The new field is continuous pigment, not a population of removable objects. Its primary rupture is a change from absence-memory to resistance-memory: a press-and-hold thickens binder density and forms a cusp that changes the material encountered by the next hold.

The viewer task is a dwell, not a wheel step, pulse, or traveled drag. A tap is refused. The field is rendered from changed density, binder, heat, cusp, and sample coordinates; lifting the latest dwell rebuilds the exact preceding field.

## Cultural translation

- **Reference:** [p5.brush](https://github.com/acamposuribe/p5.brush)
- **Observed mechanism:** pressure, density, grain, and directional fields act as programmable material forces; material changes how geometry is produced rather than decorating finished geometry.
- **Mutine translation:** refuse the source brush surface and make dwell duration a material load. A sustained hold increases binder density in a continuous field, produces a real cusp, and changes the law met by the next hold.
- **Visible consequence:** a tap leaves the field unchanged; a hold changes the continuous field and its cusp; a later hold is computed through inherited binder resistance.
- **Falsifier:** if the hold is only a cursor halo, if the underlying field remains unchanged, if the second hold behaves exactly like the first, or if the blind view reads as generic noise, the translation fails.
- **Anti-copy:** no p5.brush brushes, watercolor appearance, hatching vocabulary, API surface, palette, source examples, or source composition is reproduced.

## Files

- `studies/p5-brush/v022/` — `index.html`, `sketch.js`, `style.css`, `engine.mjs`, `README.md`, `metrics.json`, `critiques.json`
- `works/brush-2026-10-02/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/p5-brush-v022.test.mjs`
- `tests/catalog-architecture.test.mjs`
- `tests/daily-catalog.test.mjs`
- `tests/evolution-catalog.test.mjs`
- `research/qa/proofs/brush-v022-2026-10-02/`

## Verification

- **TDD RED:** missing v022 engine observed; later metadata/tableau test also failed on missing README before implementation.
- **Targeted tests:** **20 passed, 0 failed** (v022 engine, tableau, catalogue, and route checks).
- **Headless Chrome matrix:** **20/20 passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`, normal and reduced motion.
- **Browser diagnostics:** **0 console messages, page errors, failed requests, or HTTP 400+ responses** across matrix and focused readbacks.
- **Interaction:** tap reported `pressure-refused` with memory `0`; a real `520ms` hold changed memory `0→1` and binder mass `50→66`; Enter changed memory `1→2`; Delete restored `2→1`; R returned to memory `0` and the baseline binder mass.
- **Blind preview:** canvas remained visible; readout and controls were hidden; `innerWidth = clientWidth = scrollWidth = 390`; reduced motion settled at stage `15` with `4` bounded pressure holds.
- **Touch targets:** all three controls measured `117px × 44px` at `390×844`.
- **Evidence:** 12 non-empty PNG captures; minimum capture size `366,917` bytes.
- **Static checks:** `node --check` passed for v022 engine, sketch, and probe; JSON validation passed for works/public catalog/metrics/critiques; `git diff --check` passed.
- **Full suite:** **594 passed, 4 failed out of 598**. All four failures are the pre-existing untracked `tests/webgpu-v019.test.mjs`, which expects missing `studies/webgpu/v019/` and `webgpu-2026-10-01` files. The new Brush/catalog tests pass.

## Publication blocker

Per the release gate, no commit, push, or production deployment was performed. Production URL, deployed record, and deployed Journal anchor are therefore **not verified**. The local register contains exactly one `brush-2026-10-02` record; the public catalog contains the corresponding runtime record with QA-only browser evidence removed.

- **Commit SHA:** none
- **Remote SHA:** not checked for publication because the full suite is blocked
- **Production URL:** not verified

## Unresolved doubt

The causal and responsive evidence is strong, but the independent caption-free perceptual question remains open: does the blind field read as continuous pigment whose resistance changes under a held pressure, rather than as a polished procedural noise surface with explanatory contours?

**Candidate remains held.**
