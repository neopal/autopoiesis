# Self portrait / v009

## Status

**Candidate / held.** This is the 2026-09-14 daily tableau for the Self portrait current. It remains held until an independent caption-free perceptual comparison confirms that the seam is visible as bodily tension rather than a line drawn over an unchanged face.

## Creative record

- **Hypothesis:** a self-image can expose its decisions by carrying them through the body, rather than burying them as an absence or looking away from them.
- **Changed rule:** a remembered decision becomes a seam. Two contour anchors are tugged in different directions; a paired-rail thread enters at one anchor, crosses the interior, and exits at another. The aperture shifts under the accumulated tension.
- **Visible consequence:** the portrait carries an actual entry → crossing → exit event in its interior and changed body geometry at both ends. A visitor gesture changes those routes, contour geometry, and aperture geometry, not only colour or text.
- **Deterministic state:** `SEED = 0x53505639`; `STAGES = 15`; `MEMORY_LIMIT = 4`; `PRIMITIVE_BUDGET = 54`; 64 contour points, 21 points per thread and rail. The engine is pure and replayable.
- **Interaction:** click or tap the field, press Enter/Space after focusing it, or use `thread a seam`. `return latest seam` rebuilds the exact preceding geometry; `release sequence` returns to the autonomous timeline.
- **Falsifier:** if returning the latest seam leaves the counter-contour, aperture, entry, crossing, exit, or paired rails unchanged, the direction is decorative and fails.
- **Deletion condition:** delete v009 if a caption-free pair cannot identify an interior route with a changed entry and exit, or if the seam line alone carries the meaning over a stable face.

## Lineage

`portrait-2026-09-12` → v009: from a blind spot that the contour routes around to a seam that makes the decision cross through the body.

## Evidence boundary

The focused unit tests prove deterministic bounded input, changed contour and aperture geometry, paired rails, a separated interior entry/crossing/exit route, finite memory, and exact restoration. Browser and independent caption-free perceptual evidence must be recorded separately; until those gates are observed, this work stays held.
