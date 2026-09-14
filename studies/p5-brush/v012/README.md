# Brush v012 — wake-braid

## Hypothesis
A removal can become a lateral wake with a memory of pressure: if the dry point disturbs the wet field, neighbouring strokes should bank toward it, split above and below it, braid around the absence, and settle back into their lanes carrying the disturbance downstream.

## Changed rule
v012 replaces v011's gather → throat → release siphon with a **wake-braid**. Each retained removal is a bounded wake with a lane, bank reach, split depth, braid length, settle decay, and stain load. Later strokes inherit a signed displacement: nearby lanes bank toward the dry point, fork into alternating upper and lower paths, braid across the wake, then settle downstream. The rule is computed into route coordinates, width, and wet load rather than drawn as a marker over unchanged strokes.

## Expected visible consequence
The field should read as fifteen horizontal wet routes whose repeated grammar is bank → split → braid → settle. Around each remembered wake, neighbouring strokes should visibly lean toward the absence, separate with opposite pressure, cross or counter-curve after it, and soften back downstream. The sequence accumulates eight wakes without becoming a chart; lifting the latest wake should erase its bank, braid, and settling return.

## Interaction and reversibility
Pointer, `Enter`, and `Space` make one bounded wake at the pointer or a deterministic keyboard point. `lift latest` removes only the newest wake and rebuilds the exact preceding deterministic frame. `release sequence` clears visitor state and restarts the autonomous sequence.

## Falsifier
If the routes remain parallel through the absence, if the braid is only a visible witness, or if the downstream return does not alter stroke geometry and width, the wake is a diagram rather than material memory.

## Deletion condition
Delete the wake-braid rule if a caption-free comparison with wakes, witness strands, notation, labels, and readout hidden cannot locate repeated banking, split paths, and a downstream settle in the strokes themselves.

## Determinism
Seed: `0x42525532`. The engine uses a local seeded PRNG for autonomous wakes and stroke micro-variation; visitor coordinates are clamped to the field and become part of the frame state.

## Quality boundary
This is a candidate / held daily work until fresh headless browser matrix evidence, interaction readback, deployment readback, and an independent caption-free perceptual review are recorded. Source and engine checks are not treated as proof of visual success.
