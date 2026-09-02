---
type: studio-pulse
current: typography
role: test
mode: test
status: hold; disposable local evidence only
date: 2026-09-02
stimulus: x-camillerouxart-2094073992923521202
---

# Handwriting v002 — caption-free scar deletion test

## Pulse brief

- **Question:** When the route's scars, red refusal segments, captions, and explanatory furniture are hidden, does deleting one inherited scar visibly alter a late route rather than merely changing a number?
- **Hypothesis:** At a fixed deterministic late state, an intact-memory replay and the same replay with only the latest scar removed will show a repeatable downstream route difference. The route must remain visibly non-linear without relying on the scar marks or prose.
- **Changed rule under test:** This is a disposable comparison harness outside the production route. It renders only route geometry from the existing Handwriting v002 engine; no production sketch, catalogue record, or public surface is edited.
- **Deterministic state:** `MASTER_SEED = 0x6d757469`; stage `03 / 04` (zero-indexed `3`); `9` scars in the intact state and `8` after deleting the latest; no visitor input. The comparison uses the same generated point fields and the same canvas geometry for both panels.
- **Expected visible consequence:** deleting one scar produces a non-zero, repeatable downstream displacement in the late route geometry, while the caption-free canvas comparison still shows a recognizable difference at `320×568`, `390×844`, and `1280×800`.
- **Falsifier:** the deleted replay is geometrically identical, the difference is only the hidden scar/annotation layer, or the pair cannot be distinguished from a generic alternate route when shown without explanatory text.
- **Deletion condition:** hold or delete the scar-memory direction if the route difference does not survive caption-free rendering at narrow and desktop sizes; do not add labels, controls, colour witnesses, or prose to rescue it.
- **Bounded output / stop condition:** one test-first comparison module, one cache-isolated Chrome 151 browser run at the three widths, one visual capture pass, and one dated evidence record. No production engine edit, registry update, promotion, deployment, period claim, or invented tableau.

## Pre-code decision

Proceed only as a disposable test because the prior engine deletion probe proved structural dependency but did not prove that a visitor can see it without red scars or a caption. This packet tests perceptual persistence, not implementation readiness. If the pair remains ambiguous, the production candidate stays `candidate / held` and the memory direction becomes a deletion/recomposition question.

## Evidence actually observed

### Test-first comparison harness

- **RED:** `node --test research/qa/proofs/typography-caption-free-2026-09-02/comparison.test.mjs` failed with the expected `ERR_MODULE_NOT_FOUND` because the disposable comparison module did not exist.
- **GREEN:** after `comparison.mjs` was written, the same test passed: **1 passing / 0 failing**. The module imports the existing production engine without editing it, compares `makeRoutes(3, fullMemory)` with `makeRoutes(3, fullMemory.slice(0, -1))`, strips all scar/failure metadata from the render payload, and preserves only normalized route points.
- A second narrow red→green path test caught the server’s directory canonicalization hazard: the first browser run requested `/research/qa/proofs/comparison.mjs` and returned a first-party 404 because the harness used `./comparison.mjs`. The test failed against that relative import; the minimal fix uses the explicit repo-root URL `/research/qa/proofs/typography-caption-free-2026-09-02/comparison.mjs`.
- Focused structural suite after the fix: **3 passing / 0 failing** (`comparison.test.mjs`, `harness.test.mjs`, `import-path.test.mjs`).

### Cache-isolated browser run

The disposable canvas-only harness was served at:

`http://127.0.0.1:4179/research/qa/proofs/typography-caption-free-2026-09-02/index.html`

Cache-isolated **Chrome 151 CDP** with real `Emulation.setDeviceMetricsOverride` covered `320×568`, `390×844`, and `1280×800`: **3/3 valid runs**.

- Exact requested `innerWidth × innerHeight` in every run.
- `scrollWidth = clientWidth` in every run; no measured horizontal overflow.
- Canvas filled the viewport; sampled non-paper pixels were `1198`, `1682`, and `3367` respectively.
- The probe compared corresponding pixels inside the two rendered panel rectangles—stacked below `720px` and side-by-side otherwise. Compared sample counts were `90240`, `163410`, and `508000`; rendered panel difference metrics were positive at `75419`, `523875`, and `156388` respectively.
- Browser state was deterministic at stage `03`, with `9` intact scars, `8` scars after deleting the latest, `5` changed route points, and max normalized displacement `0.19999999999999996` in every run.
- The probe independently compared corresponding rendered panel pixels: `90,240` samples / difference `75,419` at `320×568`; `163,410` / `523,875` at `390×844`; and `508,000` / `156,388` at `1280×800`. The visual difference is therefore not inferred only from the engine metadata.
- `body.innerText` was empty; `controls = 0`; `links = 0`; the harness rendered no captions, annotations, or explanatory DOM.
- Console events `0`; runtime exceptions `0`; first-party HTTP `400+` responses `0`; loading failures `0` in all three runs.
- Structured output: `research/qa/proofs/typography-caption-free-2026-09-02/results.json`.
- Captures: `typography-caption-free-320x568.png`, `typography-caption-free-390x844.png`, and `typography-caption-free-1280x800.png` in the same evidence directory.

### Visual observation

- At `320×568`, the panels stack vertically and remain fully contained. The upper/lower route fields are almost coincident; a few late endpoints and bends differ, but the change is not immediately attributable to one prior refusal.
- At `390×844`, the stacked pair remains clean and the downstream differences are visible only as a comparison between near-identical route diagrams. No causal scar-to-bend reading survives because the scars and all labels are absent.
- At `1280×800`, the side-by-side panels read as restrained angular route fields. The right/left pair is distinguishable in several lower and far-right segments, but neither panel identifies itself as the result of a deleted scar; the composition reads as alternate route drawings.

## Critique / decision

**HOLD — disposable evidence study only; production candidate unchanged.** The engine falsifier is survived: replay is exact and deleting one scar changes five later route points. The perceptual falsifier is not cleared: without scar marks or prose, the pair is only a subtle A/B difference, not a legible memory relation. The existing Handwriting v002 route remains `candidate / held`; no promotion, version pointer change, or period claim follows.

- **Accepted criticism:** structural deltas and clean browser evidence do not prove that a viewer can perceive inherited refusal as cause. The current route still leans on its red refusal marks and explanatory frame to carry the memory claim.
- **Resisted:** no added captions, controls, colour witnesses, or arbitrary geometric amplification. That would rescue the explanation rather than test the work.

## Doubt

The current engine makes the deleted scar change later geometry, but the difference is distributed across many angular routes and is too close to fresh variation at mobile scale. The next revision must make one downstream bend materially singular, or the scar-memory direction should be deleted rather than ornamented.

## Next falsifiable move

Run a new disposable study—not a production edit—that isolates one inherited scar and one later affected route segment, then compare full-memory and one-scar-deleted settled frames at `320×568` and `1280×800` with all scars, captions, and panel labels hidden. Keep the direction only if an independent observer can name the same downstream correspondence twice; otherwise hold or delete the memory rule. Any production change must begin with a narrow red regression test.

## Verification record

- Focused TDD evidence suite: **3/3 passing** after the expected missing-module and stale-import failures; the changed-index assertions now pin the five moved points to route `3`, points `2–6`, with the prefix and other routes unchanged.
- `node --check research/qa/proofs/typography-caption-free-2026-09-02/comparison.mjs`: passed.
- `python -m py_compile research/qa/proofs/typography-caption-free-2026-09-02/probe.py`: passed.
- Cache-isolated browser probe: **3/3** exact viewports; actual browser `Chrome/151.0.7922.174` recorded and validated; final canonical URL recorded; zero overflow; empty body text; zero controls/links; zero console events/exceptions/bad first-party responses/loading failures.
- Visual captures inspected at all three sizes; no clipping or explanatory furniture observed.
- `npm run test`: **81 passing / 0 failing**; `git diff --check`: exit `0` (only existing Windows LF/CRLF warnings).
- The first independent code review failed closed on validator/test-strength gaps; the narrow repair added fail-closed runtime checks, dynamic browser provenance, changed-index assertions, and exact canvas-only body assertions. No production code or registry data was changed.
- Evidence is local-held only. No public URL, deployment, promotion, or period claim is made.
