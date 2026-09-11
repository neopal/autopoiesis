# Brush v009 — split-settle braid

## Hypothesis
A removal can become a material relation with a visible afterlife: if the dry point acts as a braid gate, neighbouring wet strokes should split around it and settle back into one downstream deposit rather than merely exchanging at the wound.

## Changed rule
v009 replaces v008's porous lateral exchange with a **split-settle braid**. Each retained removal is a bounded gate with a lane, spread, settling distance, and deposit mass. Later strokes inherit signed route displacement: nearby lanes divide in opposite directions while crossing the dry point, then cancel their divergence downstream and gather pigment into a common deposit. The rule is computed into route coordinates, width, and deposit density rather than drawn as a marker over unchanged strokes.

## Expected visible consequence
The field should read as ten horizontal wet routes interrupted by dark, slightly tilted gates. Around each remembered gate, neighbouring routes should open into a short two-sided braid and return toward one shared downstream knot with denser rust/warm marks. The sequence accumulates eight gates without becoming a chart; removing the last gate should erase both its split and its deposit.

## Interaction and reversibility
Pointer, `Enter`, and `Space` make one bounded braid gate. `lift latest` removes only the newest gate and rebuilds the exact preceding deterministic frame. `release sequence` clears visitor state and restarts the autonomous sequence.

## Falsifier
If the neighbouring strokes do not divide in opposite directions, if their paths do not visibly settle downstream, or if the deposit is only a halo while route geometry stays unchanged, the braid is a diagram rather than material memory.

## Deletion condition
Delete the split-settle rule if a caption-free comparison with gates, threads, notation, labels, and readout hidden cannot locate a repeated divide followed by one common deposit in the strokes themselves.

## Determinism
Seed: `0x42525539`. The engine uses a local seeded PRNG for autonomous gates and stroke micro-variation; visitor coordinates are clamped to the field and are part of the frame state.

## Quality boundary
This is a candidate / held daily work until fresh headless browser matrix evidence and an independent caption-free perceptual review are recorded. Source and engine checks are not treated as proof of visual success.
