---
type: studio-pulse
current: naive
role: artist / creative coder
mode: make
status: spike; local evidence complete; not an artwork
stimulus: none
date: 2026-09-01
---

# Naive art v001 — downstream consequence re-composition study

## Pulse brief

- **Question:** Can the retained mistake become a spatial decision when the downstream door/path consequence is given more room, without adding a control, caption, or decorative witness?
- **Hypothesis:** A caption-free triptych will become more causally readable if the intact/deleted difference is re-routed through a longer path and a more legible attached door displacement, while every non-memory scene element remains fixed.
- **Changed rule:** This is a disposable evidence study outside the production route. It derives a bounded amplification from the existing stage-index-5 (sixth-frame) memory delta; it does not rewrite `chantiers/naive-art/v001/engine.mjs`, the registry, or the public tableau.
- **Deterministic state:** production seed `0x4e415649`; stage index `5` (sixth frame) of `09`; intact memory versus `memory.slice(0, -1)`; no visitor input.
- **Expected visible consequence:** deleting only the latest retained mistake produces a repeatable, caption-free downstream difference of at least `0.01` normalized door position and `0.07` normalized path bend in the study frame, while the door remains attached to the house and the refused draft remains distinct.
- **Falsifier:** the re-routed pair still reads as a generic A/B diagram, the door leaves the house, the difference depends on labels/colour/annotation, or the transformation changes non-memory scene structure between paired frames.
- **Deletion condition:** delete/hold the retained-error direction if the enlarged consequence cannot be identified from geometry alone at `320×568`, `390×844`, and `1280×800`; do not add more marks or prose to rescue it.
- **Bounded output / stop condition:** one test-first study module, one red→green module test plus two red→green probe regressions, one cache-isolated browser capture at the three widths, and one independent critique. No production route edit, registry update, promotion, deployment, period claim, or invented tableau.

## Pre-code decision

Proceed with a disposable study only because the prior caption-free test survived the engine falsifier but failed perceptual causality: the path difference was visible while the door difference was approximately one pixel at narrow sizes and no cause could be traced without A/B knowledge. The study must amplify the existing decision signal, not add an explanatory overlay. If it fails, the candidate remains `HOLD` and the memory rule is a deletion candidate.

## Evidence status

Study code and result now exist under the evidence directory; this packet remains a disposable spike and not an artwork.

## Evidence actually observed

### Test-first study module

- RED: `node --test research/qa/proofs/naive-art-recomposition-2026-09-01/recomposition.test.mjs` failed with the expected `ERR_MODULE_NOT_FOUND` because the study module did not yet exist.
- GREEN: after the minimal study module was written, the same test passed: **1 passing / 0 failing**.
- The module imports a source-compatible local snapshot of the existing Naive engine, verified byte-for-byte against `chantiers/naive-art/v001/engine.mjs` before this packet fix; it keeps the intact stage-index-5 (sixth-frame) scene as anchor, freezes house/sun/tree structure in the deleted replay, and amplifies only the deleted replay's door/path displacement with bounded factors `3` and `2.6`. It does not touch the production route or engine.

### Caption-free browser capture

A disposable canvas-only harness was served locally at:

`http://127.0.0.1:4179/research/qa/proofs/naive-art-recomposition-2026-09-01/index.html`

Cache-isolated Chrome 151 CDP with real device metrics covered `320×568`, `390×844`, and `1280×800`: **3/3 valid runs**.

- Exact requested `innerWidth × innerHeight` in all runs; the probe asserted `Chrome/151.` from `/json/version`.
- `scrollWidth = clientWidth` in all runs; no measured horizontal overflow.
- The strict probe asserts settled page state, exact final navigated study URLs, in-viewport canvas bounds, artwork pixels differing from the paper field, empty text/control sets, expected deterministic deltas, and zero console/network failures.
- Artwork pixels differ from the paper field in all runs; text nodes `[]`; controls/links `0`.
- Console events `0`; exceptions `0`; first-party HTTP `400+` responses `0`; loading failures `0`.
- The study probe reports stage index `5 / 9` (sixth frame), `5` retained mistakes in the intact frame, `4` after latest-memory deletion, `doorDelta = -0.01135429450403913`, and `pathDelta = -0.07354944689058701` normalized.
- Captures: `naive-recomposition-320x568.png`, `naive-recomposition-390x844.png`, and `naive-recomposition-1280x800.png` under `research/qa/proofs/naive-art-recomposition-2026-09-01/`.

### Perceptual observation

- At `320×568`, the three scenes are fully contained and vertically stacked. The refused dashed draft is distinct; the solid kept scenes share house/sun/tree structure while the right replay visibly moves the door left and bends the path more sharply left.
- At `390×844`, the door/path difference remains visibly readable without labels, orange loops, bridge, readout, or prose.
- At `1280×800`, the triptych is coherent and restrained, but the center/right pair still reads readily as alternate diagrams. No door leaves the house and no panel is clipped.

## Independent critique and decision

An independent perceptual critic returned **HOLD**, confidence `0.90`.

- **Accepted:** the refused state is materially distinct; the amplified downstream door/path difference is visible across all three observed sizes; center/right geometry changes remain localized and non-decorative.
- **Blocking concern:** an unlabeled triptych does not establish that the right panel is caused by deleting the latest retained mistake. It can still read as a generic A/B or alternate diagram. Displacement is legible; memory-dependent causality is not.
- **Resisted:** clean replay, a larger delta, and no-caption screenshots do not earn promotion. No control, score, orange witness, or explanatory copy will be added to rescue the claim.

**Decision: HOLD — disposable study only; production candidate unchanged.** The study strengthens the spatial consequence but does not clear the perceptual art gate. `chantiers/naive-art/v001/`, the registry, public wall, journal, deployment, and period ledger remain unchanged.

## Next falsifiable move

Run a caption-free blind-viewing test with randomized panel order at `320×568` and `1280×800`. Ask an observer to identify the refused state, group the two kept states, and explain why the kept states differ. Keep the memory direction only if the observer infers loss/deletion as cause rather than merely describing an alternate design; otherwise hold or delete the direction.

## Verification record

- Test-first RED→GREEN: **1/1** module test passing after the expected missing-module failure; **2/2** probe regressions passing after the expected stale-result failures (URL preservation, then artwork-pixel proof).
- `node --check research/qa/proofs/naive-art-recomposition-2026-09-01/recomposition.mjs`: passed.
- Snapshot integrity: SHA-256 `e1095c3b98bbe0135c368be218a98e4220fdae4030d6a9e2b7471853ca7204c6` matches the current local Naive engine byte-for-byte; a clean `HEAD` plus staged-files checkout reran the study test successfully.
- Browser probe: **3/3** valid runs; exact final study URLs and viewports; artwork-pixel proof; zero console events/exceptions/bad first-party responses/loading failures; zero text nodes and controls.
- Visual captures inspected at all three requested sizes; no clipping or detached door observed.
- Production code, registry, atelier wall, journal, deployment, and period ledger: unchanged by this pulse.
- Clean `HEAD` plus this staged packet: `npm run test` **19/19**; focused evidence tests **3/3**.
- Evidence is local-held only. No public URL or deployment claim is made.
