---
type: critique-pulse
mode: criticise
date: 2026-08-29
scope: disposable spikes 001 and 002
status: hold; no production change
---
# Spike readiness critique — 2026-08-29

## Pulse brief

- **Active/chosen chantier:** the two existing v002-direction spikes — `001-subtractive-ecology` (Brush) and `002-disobedient-writing` (Handwriting). No third chantier opened.
- **Question:** Do the spikes satisfy enough of the studio's experiment contract to sponsor a future v002 decision, rather than merely render a plausible image?
- **Mode:** `criticise`.
- **Falsifier:** each spike has a deterministic initial state, a meaningful non-pointer path where needed, and a causal rule that its source actually enforces.
- **Bounded output / stop condition:** inspect the runnable source and readmes against the active ledger and studio contract; record one accepted and one resisted criticism. Do not alter code, deploy, commit, or promote either spike.

## Evidence inspected

- `STUDIO-OPERATING-SYSTEM.md` requires deterministic seed/state and a browser interaction before a trial can advance.
- The active ledger keeps both questions active: handwriting must make motor cost redirect its route; brush must make removal redirect its next mark.
- `spikes/001-subtractive-ecology/index.html` and `spikes/002-disobedient-writing/index.html`, plus their evidence protocols.

## Formalist reading — Brush spike

The causal core is materially present in the source: a successful cut kills one existing mark (`life=0`), creates a scar carrying the removed mark's position, angle, and mass, adds that mass to `bank`, and `spawnFromScars()` makes later marks begin at the scar rim using its angle. This is a genuine dependency rather than a scar overlay.

But the initial field is not deterministic. `rnd()` delegates to `Math.random()` for the original stock, mark geometry, and later motes/phases. `seed()` is therefore a reset, not a reproducible state. The README's claimed fixed stock may be finite within one run, but it is not a documented seed. This fails the studio invariant that a work be deterministic by seed/state and blocks comparison of two sessions.

## Historian reading — Handwriting spike

The writing is more than a jittered font in one important respect: authored route points are retained, `render()` accumulates earlier attempts, and the boundary is structurally re-authored as a seam then a bridge. The deterministic `wiggle()` function and `?minute=` state make the specified 0/2/5/10-minute inspection reproducible.

The present mobile composition nevertheless contradicts the later exhibition contract: `#field` has `min-width:830px` and `.writing-wrap` enables horizontal panning. That can be an intentional spike constraint, but it cannot become a public work unchanged because D1 forbids desktop canvas scaling/clipping in lieu of a deliberate mobile composition.

## Cynic reading — interaction claims exceed the code

Brush has pointer input only: it listens for `pointerdown`, `pointermove`, `pointerup`, and `pointercancel`; it exposes neither a keyboard route nor a visible reset/control. `window.__ecology.reset` is a developer hook, not a visitor interaction. Its perpetual `requestAnimationFrame` loop also has no reduced-motion branch.

Handwriting implements its documented keyboard routes (`Space` and `r`) and slider input. Its reduced-motion rule only disables smooth scrolling; accelerated time still runs via `requestAnimationFrame`. Neither spike may inherit a claim of exhibition readiness from its README.

## Decision

**Hold both as disposable spikes.** Retain the Brush causal rule and Handwriting's accumulating route rule, but do not promote, integrate, or call either a v002 trial yet.

- **Brush must answer next:** can a seeded stock preserve removal → scar geometry → redirected growth while offering a deliberate reset and keyboard-equivalent intervention?
- **Handwriting must answer next:** can its deterministic accumulation be recomposed into a mobile-safe encounter and retain causal meaning in a reduced-motion still/state path?

## Handoff

- **Changed rule:** a causal mechanism is insufficient for trial readiness when its starting state cannot be reproduced or its visitor path exists only as a pointer gesture.
- **Observed consequence:** Brush's formal direction is retained but its deterministic-state claim is rejected; Handwriting's stateful divergence is retained but its public responsive/reduced-motion readiness is rejected.
- **Criticism accepted / resisted:** accepted that the spikes' README-level verdicts overstate readiness. Resisted deleting either art hypothesis: the source does establish different, testable causal rules.
- **Next question:** can the next bounded make/test packet give Brush a documented deterministic seed and keyboard path without treating that accessibility work as visual promotion?
- **Hypothesis died:** no art hypothesis died. The assumption that a convincing causal rendering alone qualifies a spike to become a trial died.
