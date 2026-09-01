---
type: studio-pulse
current: naive
role: test
mode: test
status: hold; local evidence complete; no production change
date: 2026-09-01
---

# Naive art v001 — caption-free causal pair test

## Pulse brief

- **Question:** Can a retained mistake be seen as a later spatial decision when captions, orange memory loops, bridge, readout, and surrounding explanation are absent?
- **Hypothesis:** At the same deterministic stage, deleting only the latest retained mistake must visibly change the kept door/path while all non-memory state remains constant.
- **Changed rule under test:** compare `buildFrame(5, fullMemory)` with `buildFrame(5, fullMemory.slice(0, -1))` and an empty-memory reference; render the refused draft, intact kept scene, and deleted kept scene without captions or orange annotation.
- **Deterministic state:** seed `0x4e415649`; stage `06 / 09`; `5` retained mistakes in the intact frame and `4` after deleting the latest one; no visitor input.
- **Expected consequence:** a repeatable downstream door/path difference should survive the removal of explanatory furniture.
- **Falsifier / deletion condition:** if an observer cannot identify a downstream difference from the field alone, hold or delete the retained-error memory rule rather than adding more marks or prose.
- **Bounded output / stop condition:** one caption-free browser comparison at `320×568`, `390×844`, and `1280×800`; one direct-route smoke matrix at the same widths in normal/reduced motion; no engine edit, registry change, promotion, deployment, period claim, or invented tableau.

## Evidence actually observed

### Engine replay / deletion probe

The local engine replay was deterministic (`replay: true`). At stage 06:

```json
{
  "memoryVsEmpty": {
    "doorX": 0.005926055797500052,
    "pathBend": 0.03167737465249376
  },
  "deleteLatestVsIntact": {
    "doorX": -0.0037847648346797103,
    "pathBend": -0.028288248804071936
  }
}
```

The memory effect is structural in the engine. Deleting one retained mistake changes the later path bend by `0.028288248804071936` normalized and the later door by `0.0037847648346797103` normalized. The replay does not collapse to the same frame.

Machine-readable output: `research/qa/proofs/naive-art-causal-2026-09-01/results.json`.

### Caption-free browser comparison

A temporary local evidence harness imported the production `engine.mjs` and rendered three unlabeled panels: refused draft, intact memory, and latest-memory-deleted replay. The harness intentionally omitted the production labels, readout, orange memory loops, orange bridge, captions, and all DOM text. Before rendering, it froze house position/size, sun, and tree from the empty-memory frame, so the paired visual comparison changes only the door/path memory values; the separate engine probe records the un-frozen structural dependency. It ran through cache-isolated Chrome 151 CDP with real `Emulation.setDeviceMetricsOverride` at the three requested widths: **3/3 valid viewport runs**.

- `innerWidth × innerHeight` matched `320×568`, `390×844`, and `1280×800` exactly.
- `clientWidth = scrollWidth` in all harness runs.
- Rendered DOM text nodes: `[]`; controls/links: `0`.
- Console events: `0`; exceptions: `0`; first-party HTTP 400+ responses: `0`.
- All three captures were non-empty and stored under `research/qa/proofs/naive-art-causal-2026-09-01/`.

**Visual observation:**

- The refused dashed draft is materially distinct from the two solid kept scenes at all three widths.
- The intact/deleted pair retains a visible downstream path-bend difference, including at `320×568` and `390×844`.
- The door movement is not perceptually dependable: it is approximately `1.0px`, `1.2px`, and `1.4px` across the corresponding paired panel widths. At narrow sizes the door remains effectively coincident.
- With orange marks and captions absent, no single retained mistake can be traced to a changed door. The path difference is visible as a comparison, but the causal reading still requires the viewer to know which panel is intact and which is deleted.

Captures and probe: `research/qa/proofs/naive-art-causal-2026-09-01/`.

### Direct-route smoke matrix

The actual route `http://127.0.0.1:4179/chantiers/naive-art/v001/` was then run at the same three widths in normal and reduced motion: **6/6 valid runs**.

- Exact requested viewport dimensions in all six runs.
- `scrollWidth = clientWidth` in all six runs; no measured horizontal overflow.
- The canvas is first in the main DOM composition and fully inside the first viewport at all three widths.
- `controls = 0`; minimum sampled link height `44px`.
- Normal motion begins at `stage 01 / 9`, `0 retained mistakes`; reduced motion settles at `stage 09 / 9`, `8 retained mistakes`.
- Console events `0`; exceptions `0`; first-party HTTP 400+ responses `0`.
- The computed `body { overflow-x: hidden }` remains a latent masking rule and is not counted as a fix.

Structured route output: `research/qa/proofs/naive-art-causal-2026-09-01/direct-results.json`.

The direct `320×568` capture shows the tableau before the title/premise and without clipping; the reduced `1280×800` capture shows the settled remembered state and a coherent refused/kept diptych. This is a selected three-width smoke matrix, not the full five-width release matrix.

## Critique and decision

**Decision: HOLD — local candidate unchanged.**

The engine-side falsifier is survived: replay is exact and removing one memory changes later geometry. The perceptual falsifier is not cleared. Caption-free viewing makes the path bend observable, but the door movement is too small to function as a repeatable spatial decision, and the source of the path change cannot be identified from a single field without the A/B framing. The earlier orange memory loops therefore remain at risk of carrying the claim as annotation/decorative glyphs.

- **Accepted criticism:** a structural engine delta is not perceptual causality; the door/path relation must remain legible without prose or orange witnesses.
- **Resisted criticism:** no redesign-by-decoration, new control, score, or promotion follows from a green runtime matrix. The work remains an autonomous candidate and WebGPU remains dormant.

## Next falsifiable move

Make one bounded re-composition study outside the production route: enlarge or spatially re-route the downstream door/path consequence without adding a generic control or explanatory label, then repeat the same caption-free intact/deleted comparison at `320×568`, `390×844`, and `1280×800`. If the changed door/path still cannot be identified from the geometry alone, hold or delete the retained-error direction. Any production behavior change must begin with a narrow red regression test before implementation.

## Verification record

- `node --input-type=module` engine probe: **replay true**; memory and latest-deletion deltas non-zero.
- Caption-free harness probe: **3/3** valid browser runs; exact viewports; zero console events/exceptions/bad first-party responses; zero rendered text nodes.
- Direct-route smoke probe: **6/6** valid normal/reduced runs; exact viewports; zero console events/exceptions/bad first-party responses; zero controls; minimum link height `44px`.
- Production code, registry, atelier wall, journal, deployment, release metadata, and period ledger: **unchanged** by this pulse.
- The candidate engine/route used by the probes remain pre-existing local worktree files outside this archival packet; the evidence is therefore intentionally **local-held and not independently reproducible from a clean `HEAD` checkout**. No unrelated candidate files are bundled to manufacture reproducibility.
- Evidence is local-held only; no public URL or deployment claim is made.
