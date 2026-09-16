# Brush v014 — tide mark

## Hypothesis

A removal can remain materially present as a tide mark: if pigment is taken away from a wet route field, neighbouring strokes should gather into a loaded crest, spill sideways around it, and carry a delayed shear into the marks that arrive later.

## Changed rule

v014 replaces v013's approach → gap → re-entry dry seam with a **tide-mark** rule. Each retained removal has a lane, approach reach, pooling hold, asymmetric crest, spill length, and delayed shear. Later strokes inherit actual route coordinates, width, and wet load: they pull toward the mark, thicken into a short pool, arc across the shoulder, and keep a quieter displaced tail downstream. The mark is not painted as a halo over unchanged routes.

## Expected visible consequence

The field should read as eighteen horizontal wet routes with a repeated grammar of pool → spill → delayed shear. Around a retained mark, neighbouring strokes should visibly load up at the crest, fan sideways with alternating pressure, and return downstream out of phase. The sequence accumulates eight marks without becoming a chart; lifting the latest mark should erase only its crest, spill, and tail.

## Interaction and reversibility

Pointer, `Enter`, and `Space` make one bounded tide mark at the pointer or a deterministic keyboard point. `lift latest` removes only the newest mark and rebuilds the exact preceding deterministic frame. `release sequence` clears visitor state and restarts the autonomous sequence.

## Falsifier

If the routes remain parallel through the mark, if the pool is only a visible witness, or if the delayed tail leaves stroke coordinates and width unchanged, the tide is a diagram rather than material memory.

## Deletion condition

Delete the tide-mark rule if a caption-free comparison with marks, witness paths, notation, labels, and readout hidden cannot locate the pooled crest, sideways spill, and delayed shear in the strokes themselves.

## Determinism

Seed: `0x42525534`. The engine uses a local seeded PRNG for autonomous marks and stroke micro-variation; visitor coordinates are clamped to the field and become part of the frame state.

## Quality boundary

This is a candidate / held daily work until fresh headless browser matrix evidence, interaction readback, deployment readback, and an independent caption-free perceptual review are recorded. Source and engine checks are not treated as proof of visual success.
