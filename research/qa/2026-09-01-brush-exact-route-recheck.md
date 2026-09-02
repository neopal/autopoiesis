---
type: studio-pulse
current: brush
role: test / experience director
mode: test
status: hold; local runtime gate passed; perceptual art gate remains open; no production change
date: 2026-09-01
---

# Brush v002 — exact-route console and encounter recheck

## Pulse brief

- **Question:** Does the current local Brush v002 route still hold its autonomous wound consequence while its direct page is encountered, at the five contract widths and in reduced motion, without the blank exception warning seen in the earlier perceptual review?
- **Hypothesis:** The current candidate should render a non-empty deterministic canvas on the exact direct route; normal motion should begin at stage 01, reduced motion should preserve the authored terminal stage, and the canvas should precede explanatory copy in the direct DOM. This is a runtime/accessibility check, not an art approval.
- **Changed rule under test:** Verify the existing direct-route surface with cache-isolated Chrome CDP and real device metrics; do not infer browser behavior from source or a scaled screenshot.
- **Deterministic state:** Brush v002 seed `0x42525532`, 8 authored stages, 4 strokes, autonomous wound timeline; normal and `prefers-reduced-motion: reduce`; no visitor input.
- **Expected visible consequence:** A local direct-route run at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080` produces populated artwork and exact viewport metrics; reduced motion is terminal and normal motion is stage 01 at the first sample. The route remains work-first in DOM order without hiding overflow.
- **Falsifier:** Any runtime exception/console error/loading failure, blank canvas, viewport mismatch, horizontal overflow, reduced-motion intermediate state, missing 44px path target, or explanatory opening before the artwork in the direct DOM.
- **Deletion condition:** Delete/hold the current runtime claim if the route is only clean under a stale/cached page, if its reduced state is not a meaningful authored terminal state, or if the wound rule is not traceable in a later comparison; do not add decoration or controls to rescue a failed art claim.
- **Bounded output / stop condition:** One cache-isolated CDP matrix, one visual capture inspection, one independent critique, and this dated record. No engine edit, registry update, promotion, deployment, period claim, or invented tableau.

## Evidence actually observed

### Exact direct-route browser matrix

A cache-isolated **Chrome 151 CDP** run served the actual local route `http://127.0.0.1:4179/chantiers/p5-brush/v002/` with real `Emulation.setDeviceMetricsOverride` and `Emulation.setEmulatedMedia`. It covered the five contract widths in normal and reduced motion: **10/10 valid runs**.

- Requested `innerWidth × innerHeight` matched exactly in all 10 runs.
- `scrollWidth = clientWidth` in all runs; no measured horizontal overflow. The computed `body { overflow-x: hidden }` is retained as a latent masking risk and is not treated as a correction.
- Canvas was populated in all runs (`dataUrlLength` from `41,322` to `229,578`); no blank surface.
- Normal samples reported `stage 01 / 8` and `0 autonomous wounds`; reduced runs reported the authored terminal `stage 08 / 8` and `7 autonomous wounds` at every width.
- The direct DOM order was `studio-path → work-surface → work-opening → work-note → work-loop` in all runs: artwork surface precedes explanatory opening.
- There were `0` visitor controls. All sampled links had `44px` height; minimum link height was `44px`.
- Console events: `0`; runtime exceptions: `0`; first-party HTTP `400+` responses: `0`; network loading failures: `0`.
- Structured results and 10 viewport captures: `research/qa/proofs/brush-exact-route-2026-09-01/results.json` and the matching PNGs.

### Visual observation

- At `320×568`, the canvas is visibly present before the `creation` text. The first frame is sparse and calm: four long routes, a single active return wound, and no visible clipping or control panel.
- At `320×568` reduced motion, the terminal canvas is non-empty and materially denser: angular later strokes, seven retained wounds, and the `RETURN / CUT` witness remain inside the field. The frame is legible but busy.
- At `1280×800`, the canvas leads the direct page and reads as a restrained material field rather than a SaaS surface. The pale wound marks and `RETURN / CUT` label are more immediately legible than any single later stroke detour.
- The reduced `1280×800` state is coherent and unclipped, but the wound-to-detour relationship remains ambiguous: accumulated bends and multiple wounds do not isolate one causal correspondence.

## Independent critique

An independent critic returned **HOLD**, confidence `0.97`.

- **Accepted:** the local technical gate clears; all 10 exact viewport/motion runs are clean, populated, no-control, and reduced motion reaches stage `08 / 8`. The canvas leads explanatory copy at the inspected narrow size.
- **Blocking:** the wound-to-later-stroke causality is not perceptually singular. Broad curvature changes and multiple bends obscure which stroke answers which wound; pale marks and the label carry more of the claim than the detour itself.
- **Resisted:** deterministic replay, clean runtime, and structural metrics do not constitute perceptual promotion. No visitor controls, score, caption, or decorative mark should be added to compensate.
- **Next test from critic:** re-compose one retained wound and its first affected later stroke into an unmistakable local detour without labels or added controls; repeat normal/reduced exact-route captures with empty-memory or deletion comparison, then request a fresh independent perceptual review.

## Decision

**HOLD — local candidate unchanged.** The runtime/encounter gate is green for this working tree. The art gate is not: the local visual consequence is still diffuse and explanation-assisted. Brush v002 remains `candidate / held for perceptual critique`; v001 remains the separate held visitor interaction. No registry pointer, atelier wall, journal, deployment, release, or period state changed.

## Verification record

- `python research/qa/proofs/brush-exact-route-2026-09-01/probe.py`: **10/10** valid captures; exact viewports; zero console events/exceptions/bad first-party responses/loading failures; zero blank canvases; `surfaceBeforeOpening = 10`; reduced stage `08 / 8` at all five widths; minimum link height `44px`.
- `npm run test`: **81 passed / 0 failed**.
- `node --check chantiers/p5-brush/v002/engine.mjs`: passed.
- `node --check chantiers/p5-brush/v002/sketch.js`: passed.
- `python -m py_compile research/qa/proofs/brush-exact-route-2026-09-01/probe.py`: passed.
- `git diff --check`: exit `0` (only existing Windows LF/CRLF warnings).
- Independent code review of the new evidence probe: **passed**; no security concerns or logic errors. Non-blocking suggestions (deterministic readiness wait, stronger explicit screenshot/content assertions, stale-result hardening) are deferred because this bounded packet is complete and no production behavior changed.
- A direct browser-helper navigation attempt was blocked by its locked Brave profile; the successful evidence above comes from the existing cache-isolated Chrome 151 CDP transport on port `9229`, not from a static source read or scaled screenshot.
- All evidence is **local-held only**. No public URL, commit, deployment, or release claim is made.

## Next falsifiable move

Re-compose only one retained wound and its first affected later stroke in a disposable local study, without adding marks, captions, controls, or scores. Compare the same settled stage with full memory versus that one wound deleted at `320×568` and `1280×800`, in normal and reduced motion. Keep the direction only if an independent observer can identify the downstream detour from the canvas alone; otherwise hold or delete the wound-memory direction.
