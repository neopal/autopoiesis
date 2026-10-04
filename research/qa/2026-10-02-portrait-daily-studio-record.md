# Mutine daily rotation — Self portrait v018

- **Target:** Self portrait (`portrait`)
- **Date:** `2026-10-02`
- **Work:** *The portrait keeps a pressure register.*
- **Status:** **candidate / held**

## Artistic change

v018 breaks the last three portrait grammars: v015's continuous pressure membrane, v016's raster witness field, and v017's ordered aperture/refusal. It changes the medium from Canvas 2D to browser-native HTML/CSS geometry, the composition from a central object to a serial horizontal register, and the encounter from pointer proximity to a position-independent pressure command.

Seventeen real DOM strands form the register. One pressure event separates two actual strand halves, leaving a true negative interval; a distant strand becomes thicker and longer, and intervening strands bend and accrue resistance. Repeating the same pressure meets that resistance and selects a different reply. Pointer taps are refused; Enter, Space, the pressure control, Delete, and R are meaningful/reversible paths.

## Cultural translation

Reference: [p5.brush](https://github.com/acamposuribe/p5.brush)

- **Observed mechanism:** programmable pressure, density, grain, and directional fields change how geometry is produced and remembered, rather than merely decorating a finished mark.
- **Mutine translation:** pressure becomes a portrait register's geometry-producing rule: a command cuts actual DOM intervals, transfers load to a distant strand, and increases resistance for later replies.
- **Visible consequence:** the blind field is a serial register of uneven strands; after pressure, one strand has a real gap, one distant strand carries changed load, and the intervening field bends.
- **Falsifier:** if the gap is only an overlay, the remote reply is only a colour accent, intervening geometry stays fixed, a tap commits, or repeated pressure ignores resistance, the translation fails.
- **Anti-copy:** no p5.brush brushes, watercolor appearance, hatching vocabulary, palette, API surface, source examples, or composition are reproduced.
- **Direction consequence:** closes the aperture/refusal family and opens a material-agency direction where the portrait is a serial record of its own geometry-producing pressure.

## Files

- `studies/self-portrait/v018/` — HTML tableau, pure engine, DOM renderer, stylesheet, README, metrics, critiques
- `works/portrait-2026-10-02/index.html` — canonical daily shell
- `studio/data/works.json` — one factual daily record
- `studio/data/catalog-public.json` — rebuilt public catalogue
- `tests/portrait-v018.test.mjs` — five focused tests
- `tests/catalog-architecture.test.mjs`, `tests/daily-catalog.test.mjs`, `tests/evolution-catalog.test.mjs` — updated catalogue assertions
- `scripts/portrait-v018-probe.mjs` — bounded headless Chromium matrix
- `research/qa/proofs/portrait-v018-2026-10-02/results.json` — local browser evidence

## Verification

- TDD RED observed: v018 tests first failed with `ERR_MODULE_NOT_FOUND` and missing tableau files.
- Targeted v018 tests: **5 passed, 0 failed**.
- Catalogue + v018 regression subset: **21 passed, 0 failed**.
- Headless Chrome local matrix: **20/20 raw/canonical runs passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, in normal and reduced-motion modes.
- Browser diagnostics: **0 console messages, page errors, failed requests, or HTTP 400+ responses** across matrix and focused readbacks.
- Interaction: pointer tap kept memory at `0`; Enter made memory `1`; Delete restored `0`; R returned to stage `0` with `0` cuts/replies; the pressure button made memory `1`.
- Touch targets: all three controls measured **44px high** at `390×844`.
- Blind preview: 17-strand register visible; readout, controls, and labels hidden; `scrollWidth = clientWidth = innerWidth = 390`.
- Journal/current readbacks: both passed at `390×844` with no overflow; the new Journal anchor and current card were present.
- JavaScript syntax: passed.
- JSON validation: passed.
- `git diff --check`: passed.
- Static security scan on this run's diff: 0 findings.

## Publication gate

Publication is **blocked**. The full `npm run test` command returned exit code `1`: **589 tests, 585 passed, 4 failed**. All four failures are from the pre-existing untracked `tests/webgpu-v019.test.mjs`, which expects missing `studies/webgpu/v019/` files. Catalogue regressions introduced by this portrait record were updated and now pass; the unrelated WebGPU failure remains untouched.

- **Commit:** not created
- **Push:** not performed
- **Production deployment:** not performed
- **Production record/Journal verification:** not available
- **Remote SHA:** not checked for release because publication was stopped

## Unresolved doubt

The structural and responsive interaction rule is locally proven, but the independent caption-free perceptual comparison remains open: does the blind horizontal register read as a self carrying its own pressure, rather than decorative chart stripes? The candidate remains honestly **held**.
