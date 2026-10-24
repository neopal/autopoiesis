# Daily studio record — Self portrait — 2026-10-24

## Work

- **Current:** `portrait`
- **Work:** `portrait-2026-10-24`
- **Title:** *The portrait refuses to be continuous.*
- **Version:** `v032`
- **Status:** `candidate / held`
- **Raw tableau:** `/studies/self-portrait/v032/`
- **Canonical work:** `/works/portrait-2026-10-24/`

## Changed rule

The p5.brush material-agency mechanism is inverted: pressure and surface do not author the portrait. The first directional proposal is geometrically silent, repetition is refused, and only a different second proposal commits a contradiction-hinge. The committed contradiction changes the actual WebGL fold, hinge axis, facet relief/cuts, and central void. Four contradiction revisions remain bounded and liftable.

## Cultural translation

- **Reference:** [p5.brush](https://github.com/acamposuribe/p5.brush)
- **Observed mechanism:** programmable pressure, density, and directional fields participate in producing geometry.
- **Mutine translation:** deny pressure as the authoring cause; make disagreement between two directional proposals the material event.
- **Visible consequence:** a first proposal leaves the suspended two-plane hinge exact; a different second proposal folds the object and changes its negative seam and facet field.
- **Falsifier:** a single proposal, a repeated proposal, or a cosmetic-only contradiction changes the body; the pointer location becomes the answer; or exact lifting fails.
- **Anti-copy:** no brush appearance, watercolor, hatching, grain, source palette, composition, source code, API surface, or surface vocabulary is reproduced.

## Local browser evidence

Runner: headless system Chrome through Playwright. The bundled Playwright Chromium was unavailable, so no claim is made for that browser binary.

- Matrix: **20/20** runs across `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`; normal and reduced-motion modes; raw and canonical routes.
- Matrix diagnostics: **0**.
- Overflow failures: **0** (`scrollWidth` did not exceed `innerWidth`).
- Interaction diagnostics: **0**.
- Blind/static reduced-motion pass at `390×844`: canvas present; stage index, readout, hint, and controls all `display:none`; `scrollWidth=390`, `innerWidth=390`.
- Readback diagnostics: **0**; Journal and current both contain the exact title.
- Touch controls: six controls measured at **44px** height.
- Interaction evidence: first proposal unchanged; repeat unchanged/refused; incompatible second proposal changed geometry; Delete restored the prior frame; Arrow keys and Escape completed without diagnostics.
- Proof: `research/qa/proofs/portrait-v032-2026-10-24/results.json` and its 22 PNG captures.

## Tests

- `node --test tests/daily-catalog.test.mjs`: **7/7 passed**.
- `node --test tests/portrait-v032.test.mjs tests/daily-catalog.test.mjs`: **13/13 passed**.
- `npm test`: **1008/1008 passed**.
- `node --check studies/self-portrait/v032/sketch.js`: passed.
- `node --check studies/self-portrait/v032/engine.mjs`: passed.
- `git diff --check`: passed.

## Unresolved

Production deployment/readback and independent caption-free perceptual review remain open. The candidate stays **held** until the deployed route, Journal, and public register are verified and the blind object is judged as a refusal object rather than a generic 3D ornament.
