# Handwriting v005 — The sentence borrows its neighbour

## State

`v005` is a daily work candidate, recorded as **candidate / held**. It is not promoted to a finished period.

## Hypothesis

The previous mutation made memory visible as a lost beat inside one route. That risked making absence the whole image. This version asks whether refusal can become social: one broken route changes the baseline and phase of nearby later routes, so the sentence temporarily writes as a group.

## Changed rule

A remembered refusal is no longer rendered as a private gap. The deterministic engine finds the closest route point, then pulls nearby later routes toward the refusal's local `y` value from a bounded `borrowStart`. Those routes share a phase handoff, emit a `rejoinStep`, and peel away with a small horizontal drift. A current-stage visitor refusal has precedence over older memory, so the action changes the constraint field rather than just selecting a marker.

## Visible consequence

Twelve warm routes cross a dark ruled field. A refusal causes a cluster of neighbouring routes to gather into the same temporary baseline, with a signal-coloured return segment. Older route strata remain as quiet attempted sentences. Even with the small circular witnesses ignored, the downstream lines should briefly become one handwriting family and then separate.

## Visitor action

In an interactive preview, click the field or use **place refusal**. The latest refusal is inserted into memory and the later routes are recomputed. **Lift latest** removes the last refusal and reconstructs the prior route state; **restore baseline** returns to the deterministic settled frame. The canvas also supports focus + `Enter` / `Space`, `R` restore, `P` pause, and `S` still export.

## Determinism

The fixed numeric seed `MASTER_SEED = 0x6d757469` is combined with the stage. `buildFrame(stage, memory)` has no browser-history or local-storage dependency. `buildTimeline()` records the exact active memory used by each stage. `applyRefusal()` clamps visitor positions to the field and `removeLatestRefusal()` rebuilds the preceding frame from the remaining memory.

## Falsifier and deletion condition

Hide the refusal witnesses and compare the settled field with and without one refusal. Delete this direction if the shared downstream migration cannot be identified, if the dashed baseline is doing the explanatory work alone, if the effect is only chromatic, or if lifting the latest refusal leaves later route coordinates unchanged.

## Evidence boundary

The engine contract is covered by deterministic tests: multiple routes change, visitor coordinates are bounded, and lifting the latest refusal deep-equals the preceding frame. Structural checks cover tableau-first markup, keyboard/pointer bindings, reduced-motion handling, art-gate fields, the daily register, and the canonical work page.

A browser viewport matrix, console/network probe, rendered local screenshot, independent caption-free comparison, GitHub synchronization, and production URL verification are release evidence still required by the studio gate. Until those are observed, this packet remains **candidate / held** and does not claim exhibition readiness.
