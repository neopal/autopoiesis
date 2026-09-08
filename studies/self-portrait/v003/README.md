# Self portrait / v003

## Status

**Candidate / held.** This is the 2026-09-04 daily tableau for the Self portrait current. It remains held until a caption-free perceptual comparison confirms that the negative aperture and changed contour carry the decision without the readout or a witness mark.

## Creative record

- **Hypothesis:** a self-image can expose its decisions through what it refuses to contain rather than through a supplied face.
- **Changed rule:** a remembered refusal becomes a bounded negative aperture. Later contour mass and the internal axis lean around that absence; no orange hinge is required to explain the change.
- **Visible consequence:** the abstract body develops an off-axis inner opening and a compensating axis lean. The silhouette, aperture, and axis are all rebuilt from the same memory.
- **Deterministic state:** `SEED = 0x53505633`; `STAGES = 9`; `MEMORY_LIMIT = 3`; `PRIMITIVE_BUDGET = 40`. The engine is pure and replayable.
- **Interaction:** click or tap the field, press Enter/Space after focusing it, or use `withhold a place`. `lift latest absence` rebuilds the exact preceding geometry; `release sequence` returns to the autonomous timeline.
- **Falsifier:** if removing the latest absence leaves the contour and aperture unchanged, the direction is decorative and fails.
- **Deletion condition:** delete v003 if a caption-free pair cannot identify the same off-axis aperture and downstream shift, or if the form starts reading as a face.

## Lineage

`portrait-2026-09-03` → v003: from a visible hinge that tilted the axis to an interior absence carried by the negative space itself.

## Evidence boundary

The focused unit tests prove deterministic bounded input, a geometry delta, and exact restoration. A local Hermes headless browser loaded the canonical page and its isolated static preview; the observed desktop run had `innerWidth: 1264`, `scrollWidth: 1249`, a loaded tableau iframe, and three controls measured at 44px minimum height. Clicking the embedded canvas produced the visible `VISITOR ABSENCE / PAUSED` state. The browser probe then hit an idempotent/no-progress guardrail while refreshing the accessibility tree; the named button activation, the five required viewport matrix, and the independent caption-free perceptual comparison remain unresolved. Until those gates are observed, this work stays held.
