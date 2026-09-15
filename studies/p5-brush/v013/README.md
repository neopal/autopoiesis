# Brush v013 — dry seam

## Hypothesis
A removal can remain materially present as a drying seam: if pigment is taken away from a wet route field, neighbouring strokes should bend toward both banks, compress at the edges, leave a finite gap, and re-enter downstream with a changed offset and quieter wet load.

## Changed rule
v013 replaces v012's bank → split → braid → settle wake with a **dry-seam** rule. Each retained removal is a bounded seam with a lane, approach reach, gap width, bank compression, re-entry offset, return decay, and stain load. Later strokes inherit route coordinates, width, wetness, and a real discontinuity: they approach the seam, stop across the dry interval, then resume after it with a displaced return. The gap is not painted as a dark symbol over unchanged routes.

## Expected visible consequence
The field should read as sixteen horizontal wet routes whose repeated grammar is approach → gap → re-entry. Around each remembered seam, neighbouring strokes should lean inward at the banks, visibly disappear for a finite interval, and return downstream carrying a lower, shifted load. The sequence accumulates nine seams without becoming a chart; lifting the latest seam should erase only its banks, gap, and re-entry.

## Interaction and reversibility
Pointer, `Enter`, and `Space` make one bounded seam at the pointer or a deterministic keyboard point. `lift latest` removes only the newest seam and rebuilds the exact preceding deterministic frame. `release sequence` clears visitor state and restarts the autonomous sequence.

## Falsifier
If the marks remain continuous through the absence, if the gap is only a visible witness, or if re-entry leaves stroke coordinates, width, and wet load unchanged, the seam is a diagram rather than material memory.

## Deletion condition
Delete the dry-seam rule if a caption-free comparison with seams, witness paths, notation, labels, and readout hidden cannot locate repeated approach, finite gaps, and changed re-entry in the strokes themselves.

## Determinism
Seed: `0x42525533`. The engine uses a local seeded PRNG for autonomous seams and stroke micro-variation; visitor coordinates are clamped to the field and become part of the frame state.

## Quality boundary
This is a candidate / held daily work until fresh headless browser matrix evidence, interaction readback, deployment readback, and an independent caption-free perceptual review are recorded. Source and engine checks are not treated as proof of visual success.
