# Mutine daily studio record — 2026-09-26

## Audit scope

- Target slot: `brush` / `2026-09-26` / current index `4/6`.
- Cultural reference selected by the slot helper: `p5-brush` / p5.brush.
- Active catalogue sources: `studio/data/studio.json`, `studio/data/works.json`, and generated `studio/data/catalog-public.json`.
- Field tests and stimuli were not counted as works.
- Browser verification used headless Playwright only; no headed browser, CUA, CDP, remote debugging, or GUI launch was used.

## Today's work

- **Brush** (`brush`, active): recorded `brush-2026-09-26`, *The brush dries on the inside.*, status `candidate / held`, lifecycle `active`, raw tableau `/studies/p5-brush/v020/`, canonical `/works/brush-2026-09-26/`.

### Changed rule

v020 changes the Brush current from planar islands, membrane, and ordinal rack to a suspended WebGL helical coil. A discrete drying pulse fractures one actual pigment band into separated dry fragments and deflects the still-wet bands through changed phase, radius, and route. The material remembers by changing how the next geometry is produced.

### Cultural translation

- **Observed mechanism:** p5.brush treats pressure, density, grain, and vector fields as programmable geometry-producing behaviour rather than a cosmetic surface skin.
- **Mutine translation:** drying becomes an antagonist field. One pulse creates a structural seam in a helical band; later wet bands bend around it.
- **Visible consequence:** WebGL coil, central volume, fractured band, floating dry fragments, and deflected neighbouring bands; pointer position is not causal.
- **Falsifier:** if the pulse only changes hue, opacity, labels, or decorative particles, or if the wet bands keep their original route, the translation fails.
- **Anti-copy:** no p5.brush brushes, watercolor appearance, hatching vocabulary, API surface, palette, composition, or source examples were reproduced.

## Today's coverage

The six current/date slots for `2026-09-26` were checked against the parsed work register:

- **Handwriting** (`typography`, active): recorded `typography-2026-09-26`.
- **Self portrait** (`portrait`, active): **held / no record**.
- **Pure SVG** (`svg`, active): recorded `svg-2026-09-26`, *The loop misremembers a turn.*.
- **Brush** (`brush`, active): recorded `brush-2026-09-26`, *The brush dries on the inside.*.
- **Naive art** (`naive`, active): **held / no record**.
- **WebGPU** (`webgpu`, dormant): **held / no record**.

Duplicate current/date slots: **none**. No missing day was invented.

## Register integrity

- JSON parsing: **PASS** for source and generated public catalog registers.
- Parsed schemas: `mutine-studio/v2`, `mutine-works/v1`, and `mutine-public-catalog/v1`.
- Register size: **103 works across 6 currents**.
- Canonical pages: **103/103** present.
- Raw tableaux: **103/103** resolve to an existing `index.html` under `studies/`.
- Duplicate current/date keys: **none**.
- Generated public catalog: rebuilt from source data; QA/browser evidence is excluded from the public payload.

## Automated verification

- Targeted v020 tests: **5 passed, 0 failed**.
- Full suite: **526 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo**.
- Changed JavaScript syntax: **PASS** for `studies/p5-brush/v020/engine.mjs`, `sketch.js`, and the QA probe.
- JSON validation: **PASS** for v020 metadata, critiques, source works register, and generated public catalog.
- `git diff --check`: **PASS**; only existing LF→CRLF working-copy warnings were emitted.
- Static security scan: **no findings** in the generated v020 changes.

## Browser and interaction evidence

- Local headless matrix: **20/20** canonical/raw runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, in normal and reduced-motion modes.
- Local diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses across the matrix and focused readbacks.
- Local overflow: **0**; `innerWidth === clientWidth === scrollWidth` in all matrix runs and focused catalogue reads.
- Touch targets: all three raw controls measured **44px high × 117px wide** at `390×844`.
- Interaction: initial memory `0`; dry button `0→1`; `D` on focused canvas `1→2`; Delete `2→1` with `pulse-lifted`; release `→0`.
- Blind preview: WebGL canvas remained visible; readout and controls hidden; reduced-motion state reached `4` seams.
- Journal: exactly one `#journal-brush-2026-09-26` entry with the recorded title and canonical link.
- Brush current: current header and first artwork rendered at `390×844`; catalogue count `20`; no overflow.
- Proof bundle: `research/qa/proofs/brush-v020-2026-09-26/` with `results.json`, `summary.json`, `probe.mjs`, and `24` PNG captures.

## Publication state

- **Not yet deployed in this run.** Production readback, remote SHA, deployment URL, and deployed Journal verification remain outstanding until the generated work is committed and pushed.
- Existing unrelated worktree modifications remain untouched and will not be staged.

## Held decision

The work remains honestly **candidate / held**, not exhibition-ready. The engine, interaction, local responsive matrix, and register are real and verified. The unresolved doubt is perceptual: an independent caption-free reviewer has not yet confirmed that the broken band and the deflected wet bands read immediately as a changed material law rather than an attractive generic 3D coil. Provider revision linkage is also unresolved.
