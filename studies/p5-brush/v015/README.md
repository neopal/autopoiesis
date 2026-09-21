# Brush v015 — basin

## Hypothesis

A removal can remain materially present as a basin: if pigment is taken away from a wet route field, neighbouring strokes should descend into a shared floor, stay there long enough to become a place, and climb out over a far lip with a changed aftershock.

## Changed rule

v015 replaces v014's pool → spill → delayed shear tide mark with a **basin-mark** rule. Each retained removal has a lane, approach reach, bowl, floor, depth, far lip, and aftershock. Later strokes inherit actual route coordinates, width, and wet load: they bend downward into the mark, flatten across its floor, climb the far lip, and carry a changed exit into the later field. The basin is not painted as a hollow witness over unchanged routes.

## Expected visible consequence

The field should read as nineteen horizontal wet routes with a repeated grammar of descend → shared floor → climb → aftershock. Around a retained mark, neighbouring strokes should visibly occupy one shallow floor before separating over the far lip. The sequence accumulates eight basins without becoming a chart; lifting the latest basin should erase only its descent, floor, lip, and aftershock.

## Interaction and reversibility

Pointer, `Enter`, and `Space` make one bounded basin at the pointer or a deterministic keyboard point. `lift latest` removes only the newest basin and rebuilds the exact preceding deterministic frame. `release sequence` clears visitor state and restarts the autonomous sequence.

## Falsifier

If the routes never share a floor, if the basin is only a visible witness, or if the far lip leaves stroke coordinates and width unchanged, the basin is a diagram rather than material memory.

## Deletion condition

Delete the basin-mark rule if a caption-free comparison with basins, witness paths, notation, labels, and readout hidden cannot locate the descent, shared floor, and changed climb in the strokes themselves.

## Determinism

Seed: `0x42525535`. The engine uses a local seeded PRNG for autonomous basins and stroke micro-variation; visitor coordinates are clamped to the field and become part of the frame state.

## Quality boundary

This is a candidate / held daily work until fresh headless browser matrix evidence, interaction readback, deployment readback, and an independent caption-free perceptual review are recorded. Source and engine checks are not treated as proof of visual success.
