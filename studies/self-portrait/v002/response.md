---
type: studio-pulse
current: portrait
role: artist + release defender
mode: create-and-record
status: candidate / held; local evidence complete; no deployment
date: 2026-09-03
---

# Self portrait v002 — release evidence / 2026-09-03

## Work decision

The daily target was `portrait` / Self portrait. No `portrait-2026-09-03` record existed at the start of the slot. v002 was created as a real tableau under `studies/self-portrait/v002/`, then registered once the preview and canonical route passed their runtime checks.

The changed rule is structural: v001 gently perturbed later contours around blind spots; v002 turns each refusal into a signed hinge that displaces later contour mass and bends the internal axis. A visitor can add a hinge with pointer or `Enter`/`Space`, lift the latest hinge, and compare the rebuilt geometry. The memory is bounded to four hinges and is never stored in browser history.

## Browser evidence actually observed

A cache-isolated headless Chrome 151 CDP probe used real `Emulation.setDeviceMetricsOverride` and emulated reduced motion against:

- preview route: `http://127.0.0.1:4179/studies/self-portrait/v002/?preview=1&static=1`
- canonical route: `http://127.0.0.1:4179/works/portrait-2026-09-03/`
- raw route: `http://127.0.0.1:4179/studies/self-portrait/v002/`

The preview matrix covered `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080` in normal and reduced modes: **10/10 valid runs**.

Observed in all 10 preview runs:

- exact requested `innerWidth`/`innerHeight`;
- `scrollWidth === clientWidth`;
- full-viewport canvas in isolated preview;
- zero console events, zero runtime exceptions, and zero first-party HTTP 400+ responses;
- static preview hides its action rail and remains tableau-only;
- reduced motion settles on `stage 08 / 8` with `4 hinges remembered`.

Observed interaction evidence at `1280×800` in normal and reduced modes:

- `Enter` on the focused canvas changes the rendered canvas and reports `visitor hinge / paused`;
- a second keyboard hinge changes it again;
- `lift latest hinge` changes it back to a distinct rebuilt state;
- pointer press/release on the field changes the rendered canvas;
- the three action controls are visible in interactive preview and each measured `44px` high;
- no interaction probe produced console events, exceptions, or bad first-party responses.

Observed canonical routing evidence:

- direct raw navigation ended at `/works/portrait-2026-09-03/` through `raw-bridge.js`;
- canonical catalog mount became ready and loaded `/studies/self-portrait/v002/?preview=1&interaction=1` in its iframe;
- the iframe loaded `#field` and the tableau markup now precedes the timeline rail;
- canonical mobile reduced run at `320×568` had `scrollWidth = 305` and the tableau iframe began at `top = 196.5px`, before the explanatory ledger.

Evidence files:

- `research/qa/proofs/portrait-v002-2026-09-03/results.json`
- `research/qa/proofs/portrait-v002-2026-09-03/canonical-results.json`
- captures `portrait-*.png`, `canonical-desktop.png`, and `canonical-mobile-reduced.png` in the same folder.

## Art gate

The engine probe reports deterministic replay and a latest-hinge deletion maximum of `0.04770150801286075` normalized (`54.14121159459695px` at a 1135px field). The isolated captures read as a layered, translucent abstract contour rather than a human avatar. The remaining perceptual doubt is explicit: a caption-free pair with hinge witnesses hidden has not yet been independently observed. The work therefore stays **candidate / held**, not promoted.

The accepted deletion condition is unchanged: delete this direction if the same local downstream bend cannot be identified twice without the orange witnesses or explanatory prose, or if lifting a hinge leaves the later contour unchanged.

## Verification

- `npm test`: **50 passing / 0 failing**.
- `node --check studio/catalog.js`: passed.
- `node --check studies/self-portrait/v002/sketch.js`: passed.
- `node --check studies/self-portrait/v002/engine.mjs`: passed.
- `node scripts/generate-work-pages.mjs`: `generated 11 daily work pages`.
- canonical local URL: `http://127.0.0.1:4179/works/portrait-2026-09-03/`
- no deployment or public URL claim is made.
