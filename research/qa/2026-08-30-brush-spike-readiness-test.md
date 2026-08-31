---
type: test-pulse
mode: test
date: 2026-08-30
scope: spikes/001-subtractive-ecology
status: blocked; no production change
---
# Brush spike readiness test — 2026-08-30

## Pulse brief

- **Active/chosen chantier:** the existing Brush v002-direction spike, `spikes/001-subtractive-ecology`; no third chantier opened.
- **Question:** Can the spike presently supply a reproducible initial state and a keyboard-equivalent visitor intervention?
- **Mode:** `test`.
- **Falsifier:** the executable exposes a documented deterministic seed and keyboard path that can be exercised locally; or static/runtime evidence shows either requirement absent.
- **Bounded output / stop condition:** run the repository suite, attempt one local browser load, inspect only the two readiness seams, and record the evidence. Do not edit, deploy, commit, push, or promote the spike.

## Evidence

1. The full repository suite passed: `npm test` reported **6 passing, 0 failing** tests (93.386 ms). These tests do not prove Brush determinism or keyboard equivalence.
2. A local static server did answer `HTTP/1.0 200 OK` for `/spikes/001-subtractive-ecology/`.
3. The required local browser run could not begin. The browser harness stopped before navigation/DOM access because Chrome displayed its explicit **“Allow remote debugging?”** permission dialog. The agent did not click it. Consequently no canvas hash, gesture, keyboard, reduced-motion, console, network, or screenshot evidence was collected.
4. Static seam inspection preserves the prior negative finding:
   - `index.html:28` defines `rnd` with `Math.random()`, so the seed stock is not reproducible across independent loads.
   - `index.html:138–140` registers pointer events only; a search for `keydown` returns no result.
   - `index.html:141` exposes `window.__ecology.reset`, a developer hook rather than a visible visitor control.

## Result

The spike still fails the two readiness preconditions in source: it has neither a deterministic initial seed nor a keyboard-equivalent intervention. Browser-level confirmation is additionally blocked by the unapproved remote-debugging permission, so it would be false to report interaction or rendering verification.

No production behavior changed, no release claim is made, and the spike remains disposable rather than a trial or work.

## Handoff

- **Changed rule:** a source-level finding can retain a readiness block, but cannot substitute for required browser interaction evidence.
- **Observed consequence:** Brush remains held on two independently visible grounds: `Math.random()` prevents comparable starts, and no keyboard handler provides equivalent intervention.
- **Criticism accepted / resisted:** accepted the prior requirement for seeded state and a visitor—not developer—path. Resisted treating a passing catalog suite as proof of artwork interaction.
- **Next question:** after remote debugging is explicitly allowed, can a narrow browser test first demonstrate the current non-deterministic reload and missing keyboard path, then support a separate red→green accessibility/state correction packet?
- **Hypothesis died:** no art hypothesis died; the assumption that static source review alone can validate an interactive browser spike died.
