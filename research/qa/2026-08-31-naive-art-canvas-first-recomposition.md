---
type: pulse-brief
current: naive
role: artist / experience director
mode: make
status: local-composition-pass-art-gate-hold
date: 2026-08-31
---

# Naive art — canvas-first direct-route recomposition

## Pulse brief

- **Question:** Can the direct work route let the tableau arrive before its explanation, especially at `320×568` and `390×844`, without changing the autonomous engine or adding visitor controls?
- **Creative concept:** The house should be encountered as a stubborn object before the caption explains its mistake. Contact first; admission second.
- **Changed rule:** Move the real `work-surface` immediately after the breadcrumb, before the title and premise, so the artwork—not the process prose—owns the first direct-route encounter at every viewport.
- **Deterministic state:** unchanged seed `0x4e415649`, nine-stage authored timeline, no visitor input; this packet changes only encounter order.
- **Expected visible consequence:** the direct narrow route should expose the refused/kept diptych in the first viewport instead of spending that viewport on the title and premise; the title and critique follow the canvas in document order.
- **Falsifier:** at a contract width the canvas is still below the first viewport, the two panels lose readable scale/containment, or the reorder creates a broken reading path/collision. If the image remains caption-dependent, this is not an artistic solution.
- **Deletion condition:** revert the ordering if it merely front-loads a smaller/less legible field or if the canvas-first encounter does not make the retained-error relation more available without explanation.
- **Bounded output / stop condition:** one DOM-order composition change, one narrow regression, local five-width route probe at normal and reduced motion, and a fresh visual/causal review. No promotion, deploy, or period claim.

## Pre-code state

The existing local evidence said the direct route was text-led at narrow sizes while the isolated preview was composed. This packet tested the encounter order rather than adding ornament to the canvas.

## TDD evidence

The narrow regression was written before the HTML reorder and failed as intended:

```text
Naive art v001 leads the direct route with the artwork before its explanation
AssertionError: the artwork must arrive before its explanatory opening
32 passed / 1 failed
```

The minimal green change moved only the existing `work-surface` section before `work-opening` in `chantiers/naive-art/v001/index.html`. The autonomous engine, seed, stage timing, memory rule, and visitor-control prohibition were untouched. The same test then passed with `33 passed / 0 failed`.

## Browser evidence — local-held

A real headless Chrome 151 CDP run served `http://127.0.0.1:4179/chantiers/naive-art/v001/` with cache disabled and `Emulation.setDeviceMetricsOverride` applied before navigation. It covered normal and reduced motion at all five contract viewports: **10/10 runs**.

- all 10 target `innerWidth × innerHeight` values matched exactly;
- `scrollWidth ≤ clientWidth` in all 10 runs; no horizontal overflow;
- the canvas was first in DOM order and fully inside the first viewport in all 10 runs;
- visible links were at least `44px` in both dimensions in all 10 runs;
- 0 `button`, `input`, `select`, or `textarea` controls;
- 0 runtime exceptions, 0 console events, and 0 first-party responses at HTTP ≥ 400;
- normal motion observed `stage 01 / 9`, `0 retained mistakes`; reduced motion observed `stage 09 / 9`, `8 retained mistakes`;
- the pointer gesture followed `MUTINE` to `/galerie/`, and a subsequent `Tab` focused the `MUTINE` exit on the returned work route;
- machine-readable evidence and ten viewport captures: `research/qa/proofs/naive-art-canvas-first-2026-08-31/results.json`.

The captures show the refused and kept panels as a contained stacked diptych at `320×568` and `390×844`, and as a contained wide field at `768×1024`, `1280×800`, and `1920×1080`. The reduced-motion captures retain the orange memory marks and the final `8 retained mistakes` state. The title/premise follows the field rather than occupying the opening mobile viewport.

## Critique / decision

**Accepted:** the experience criticism that a direct work route must let the image arrive before its explanation. The canvas-first relation is now visible, not asserted: the direct narrow captures begin with the actual tableau, not the hero title.

**Resisted:** treating this encounter correction as proof that the retained mistake is legible. At normal stage 01 there is no inherited memory by design; the current capture proves ordering and containment, not causal comprehension across stages. The simple house vocabulary and orange marks can still ask for caption support.

**Decision:** local composition gate `PASS`; Naive art remains `candidate / local perceptual KEEP, direct-route presentation corrected, release gate open`. No promotion, deployment, period claim, or public provenance follows. WebGPU remains dormant and Brush v001 remains a held visitor interaction.

## Next falsifiable move

Run the bounded stages `1–6` before/after replay at `320×568`, `390×844`, and `1280×800` with captions hidden: compare the intact timeline against a replay with one retained mistake deleted. If the changed door/path cannot be identified from the field alone, hold or delete the memory direction rather than adding annotation. After that, only a fresh independent perceptual critique and a deployed five-width matrix can move the candidate.

## Independent review

A fresh independent reviewer returned `passed: true` with no security concerns or logic errors. It confirmed that the existing accessible work surface precedes the explanatory section without changing route semantics, that the regression fails before and passes after the reorder, and that the documentation does not overclaim deployment or promotion. Its only suggestion was non-blocking: add an even stricter source-order assertion if immediate adjacency after the breadcrumb becomes a contractual invariant.

## Files changed by this pulse

- `chantiers/naive-art/v001/index.html`
- `tests/evolution-catalog.test.mjs`
- `research/qa/2026-08-31-naive-art-canvas-first-recomposition.md`
- `research/qa/proofs/naive-art-canvas-first-2026-08-31/results.json`
- `research/qa/proofs/naive-art-canvas-first-2026-08-31/naive-canvas-first-*.png`
