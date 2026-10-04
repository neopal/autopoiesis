# Mutine daily studio record — Naive art — 2026-10-04

## Decision

- Target slot: `naive` / `2026-10-04`.
- Cultural reference: [`little-critters`](https://github.com/GordenSun/little-critters).
- Work: *The picture misreads its own shadow.* (`naive-2026-10-04`).
- Status: **candidate / held**.
- The work is a declared structural rupture relative to the last three Naive records: v021's situated SVG rooms, v022's DOM cut-out slots, and v023's continuous Canvas route are replaced by one p5.js WebGL paper-theatre relief and an approach/departure encounter.

## Changed rule and translation

`little-critters` makes pointer proximity a reciprocal attention relation between situated agents. Mutine refuses animals, eyes, character design, paper scene, source palette, and head-turning imagery. v024 translates the mechanism into a spatial reconstruction rule: proximity only arms one faceted plane; leaving the field changes that plane's actual depth and hinge, and a non-adjacent plane reconstructs itself from the wrong cast shadow. Later departures inherit the changed shadow state.

- Visible consequence: the blind field is one nine-plane WebGL paper theatre with depth cues and cast shadows; a departure changes both a local plane and a distant reply plane.
- Falsifier: if proximity or a tap commits, if the remote answer is only a glow or sticker, if the remote plane does not move, or if the blind work reads as a generic 3D card wall.
- Deletion condition: delete v024 if caption-free comparison cannot distinguish `wrong shadow → reconstruction` from v021's rooms, v022's slots, and v023's wrong-landing route.
- Anti-copy: no animals, eyes, characters, source palette, paper scene, composition, surface style, API surface, or head-turning vocabulary were reproduced.

## Files

- Study: `studies/naive-art/v024/` (`index.html`, `engine.mjs`, `sketch.js`, `style.css`, `README.md`, `metrics.json`, `critiques.json`).
- Canonical work page: `works/naive-2026-10-04/index.html`.
- Register: `studio/data/works.json` contains exactly one `naive/2026-10-04` record and 130 total works in the current worktree.
- Public runtime catalog regenerated at `studio/data/catalog-public.json`.
- Targeted test: `tests/naive-art-v024.test.mjs`.
- Browser probe: `scripts/naive-art-v024-probe.mjs`.
- Evidence: `research/qa/proofs/naive-art-v024-2026-10-04/`.

## Verification

- TDD RED observed: the targeted test failed because the v024 engine and tableau files did not exist.
- TDD GREEN observed: targeted v024 tests **3 passed, 0 failed**.
- Headless browser matrix: **20/20 passed** across `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, raw/canonical, normal/reduced motion.
- Overflow: all runs kept `innerWidth = clientWidth = scrollWidth`; canonical child frames were also contained.
- Diagnostics: **0 console messages, page errors, failed requests, or HTTP 400+ responses** across the matrix, focused interaction, and blind readback.
- Touch controls: all three measured **118px × 44px** at `390×844`.
- Interaction: a real pointer tap kept memory `0`; pointer approach armed without memory; leaving the theatre changed memory `0→1` and changed local depth/hinge plus remote shadow geometry; Enter changed memory `1→2`; Delete changed `2→1` and restored the exact preceding signature; `R` returned to `0`; the misread control produced `0→1`.
- Blind preview: the p5.js WebGL canvas stayed visible while readout, controls, labels, annotations, and prose were hidden; reduced motion settled at stage `18`, memory `4`, and `8` changed plane roles.
- Evidence: **22** non-empty PNG captures.
- JavaScript syntax checks and `git diff --check`: passed.

## Publication gate

The full suite is not green, so publication stopped here. The current run did not commit, push, deploy, or perform production readback.

- Full suite: **640 passed, 4 failed out of 644**.
- The four failures are unchanged, pre-existing WebGPU v019 expectations for missing `studies/webgpu/v019/`, `works/webgpu-2026-10-01/`, and its daily record. No WebGPU v019 files were changed by this run.
- Commit SHA: none.
- Remote SHA: not checked.
- Production URL: not verified.
- Intended canonical route: `/works/naive-2026-10-04/`.

## Unresolved doubt

Independent caption-free perceptual review remains open: whether the blind theatre reads as one spatially misremembering paper object, rather than a decorative 3D card wall whose causal meaning is supplied by the caption. Provider revision linkage is also unresolved because publication was blocked. **Candidate remains held.**
