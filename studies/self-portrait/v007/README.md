# Self portrait / v007

## Status

**Candidate / held.** This is the 2026-09-11 daily tableau for the Self portrait current. It remains held until a caption-free perceptual comparison confirms that the displaced eye, opposite contour response, and returning sight route carry the decision without labels or witnesses.

## Creative record

- **Hypothesis:** a self-image can expose its decisions by looking away from them, rather than by printing or folding a second version of its outline.
- **Changed rule:** a remembered decision becomes a counter-gaze. The contour on the opposite side bends downstream; the eye aperture and pupil slip away from the decision; a sight route returns from the displaced eye toward the answering contour.
- **Visible consequence:** the portrait no longer only folds or misregisters. It develops an asymmetrical eye/contour relation: the eye leaves the marked side while the body carries a bent response and a line that crosses back through the face.
- **Deterministic state:** `SEED = 0x53505637`; `STAGES = 13`; `MEMORY_LIMIT = 4`; `PRIMITIVE_BUDGET = 46`; 52 contour points and 16 points per sight route. The engine is pure and replayable.
- **Interaction:** click or tap the field, press Enter/Space after focusing it, or use `look away`. `return latest gaze` rebuilds the exact preceding geometry; `release sequence` returns to the autonomous timeline.
- **Falsifier:** if removing the latest counter-gaze leaves the counter-contour, displaced aperture/pupil, or sight route unchanged, the direction is decorative and fails.
- **Deletion condition:** delete v007 if a caption-free pair cannot identify the same eye looking away and contour answering, or if the route line alone carries the meaning.

## Lineage

`portrait-2026-09-10` → v007: from an occlusion fold in the contour to a counter-gaze that makes the eye answer a decision by looking elsewhere.

## Evidence boundary

The focused unit tests prove deterministic bounded input, a geometry delta, a displaced eye, returning sight routes, and exact restoration. Browser and independent caption-free perceptual evidence must be recorded separately; until those gates are observed, this work stays held.
