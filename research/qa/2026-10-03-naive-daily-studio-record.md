# Mutine daily studio record — Naive art — 2026-10-03

## Decision

- Target slot: `naive` / `2026-10-03`.
- Cultural reference: [`p5.brush`](https://github.com/acamposuribe/p5.brush).
- Work: *The line forgets where it was going.* (`naive-2026-10-03`).
- Status: **candidate / held**.
- The work is genuinely new relative to the last three Naive records: v020's pressure print, v021's wrong-room SVG topology, and v022's DOM cut-out reflow are replaced by a single continuous Canvas route and a temporal double-tap encounter.

## Changed rule and translation

p5.brush makes pressure, density, and fields alter how geometry is produced. Mutine refuses its brush appearance and translates that mechanism into a naive-art rule: a timed double tap sends one painted band to a wrong anchor, leaves the intended arrival empty, and makes later bands rebuild from the wrong landing. A single tap only waits; later geometry, not a readout or marker, carries the mistake.

- Falsifier: if the event changes only colour, if the gap is an overlay, if later bands keep their old starts, or if the blind route reads as a generic chart.
- Deletion condition: delete v023 if caption-free comparison cannot distinguish wrong-landing reuse from the previous pressure, topology, and vacancy grammars.
- Anti-copy: no p5.brush brushes, watercolor, hatching, palette, API surface, source examples, or source composition were reproduced.

## Files and register

- Study: `studies/naive-art/v023/` (`index.html`, `engine.mjs`, `sketch.js`, `style.css`, `README.md`, `metrics.json`, `critiques.json`).
- Canonical work page: `works/naive-2026-10-03/index.html`.
- Register: `studio/data/works.json` contains exactly one `naive/2026-10-03` record and **125 total works**.
- Public runtime catalog regenerated at `studio/data/catalog-public.json`.
- Targeted test: `tests/naive-art-v023.test.mjs`.
- Browser probe: `scripts/naive-art-v023-probe.mjs`.
- Evidence: `research/qa/proofs/naive-art-v023-2026-10-03/`.

## Verification

- TDD RED observed: missing v023 engine/tableau/registration failures.
- Targeted tests: **3 passed, 0 failed**; engine edge-case test also observed RED before the wrong-landing guard was added, then GREEN.
- Headless browser matrix: **20/20 passed** across `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, raw/canonical, normal/reduced motion.
- Browser diagnostics: **0 page errors, failed requests, HTTP 400+ responses, or overflow failures** in the matrix.
- Touch controls: minimum measured height **44px** at the responsive probe.
- Interaction: one tap kept memory `0`; the second tap inside the interval changed memory `0→1`, wrong landings `0→1`, and intended gaps `0→1`; Enter changed memory `1→2`; Delete changed `2→1` and restored the preceding route; `R` returned memory to `0`; the **make a slip** button committed memory `0→1`.
- Blind preview: Canvas remained visible; readout and controls were hidden; `innerWidth = clientWidth = scrollWidth = 390`.
- Evidence: **22 non-empty PNG captures**.
- Changed JavaScript syntax checks and `git diff --check`: passed.
- Full suite: **618 passed, 4 failed out of 622**. The four failures are the pre-existing untracked WebGPU v019 expectations for missing `studies/webgpu/v019/` and `webgpu-2026-10-01`; no WebGPU v019 files were changed.

## Publication gate

Because the full suite is not green, publication stopped here:

- Commit SHA: none.
- Remote SHA: not checked.
- Production deployment: not performed.
- Production URL: not verified.
- Intended canonical route: `/works/naive-2026-10-03/`.

## Unresolved doubt

Independent caption-free perceptual review remains open: whether the blind Canvas reads as one material route that has acquired a wrong future landing, rather than a colourful decorative linefield with explanatory prose doing the work. **Candidate remains held.**
