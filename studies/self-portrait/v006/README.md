# Self portrait / v006

## Status

**Candidate / held.** This is the 2026-09-10 daily tableau for the Self portrait current. It remains held until a caption-free perceptual comparison confirms that the fold and returning inner route carry the decision without the readout or crease witnesses.

## Creative record

- **Hypothesis:** a self-image can expose its decisions through a contour that folds through itself, rather than by printing a stable face twice.
- **Changed rule:** a remembered decision becomes an occlusion fold. Later contour points bend across a local crease, disappear beneath the fold, and return as an inner route; the negative aperture is carried through the same fold field.
- **Visible consequence:** the body no longer only leans or misregisters. It develops a readable crossing: one outline has a crease, a displaced inner route, and an aperture that follows the fold instead of merely changing colour.
- **Deterministic state:** `SEED = 0x53505636`; `STAGES = 12`; `MEMORY_LIMIT = 4`; `PRIMITIVE_BUDGET = 42`; 48 contour points and 14 points per crease route. The engine is pure and replayable.
- **Interaction:** click or tap the field, press Enter/Space after focusing it, or use `fold a decision`. `lift latest fold` rebuilds the exact preceding geometry; `release sequence` returns to the autonomous timeline.
- **Falsifier:** if removing the latest fold leaves the folded contour, crease route, or aperture unchanged, the direction is decorative and fails.
- **Deletion condition:** delete v006 if a caption-free pair cannot identify the same contour crossing and inner return, or if the crease guide alone carries the meaning.

## Lineage

`portrait-2026-09-09` → v006: from a doubled registration plate to an occlusion fold that changes the topology of the later contour.

## Evidence boundary

The focused unit tests prove deterministic bounded input, a geometry delta, a returning crease route, and exact restoration. Browser and independent caption-free perceptual evidence must be recorded separately; until those gates are observed, this work stays held.
