# Brush v008 — porous exchange

## Hypothesis
A removal can become a material relation rather than a local scar: if the dry point is porous, neighbouring wet strokes should trade pigment through it and keep an opposite gain/loss downstream.

## Changed rule
v008 replaces v007's shared released wake with a **porous membrane**. Each retained removal is a bounded membrane with a lane, porosity, and alternating exchange side. Later strokes inherit a signed lateral transfer: one side thickens and shifts while the other thins and shifts. The exchange is computed into route coordinates, width, and wetting rather than drawn as a marker over unchanged strokes.

## Expected visible consequence
The field should read as nine horizontal wet routes interrupted by a dark, slightly tilted membrane. Around each remembered membrane, neighbouring routes should braid into a short shared crossing and then separate with opposite colour/weight: warm pigment received on one lane, cool pigment relinquished by another. The sequence accumulates seven membranes without becoming a grid.

## Interaction and reversibility
Pointer, `Enter`, and `Space` make one bounded membrane. `lift latest` removes only the newest membrane and rebuilds the exact preceding deterministic frame. `release sequence` clears the visitor state and restarts the autonomous sequence.

## Falsifier
If the neighbouring strokes do not show an opposite gain/loss pair beyond the dry point, or if the membrane only adds a halo while route geometry stays unchanged, the exchange is a diagram rather than material memory.

## Deletion condition
Delete the porous-exchange rule if a caption-free comparison with membrane witnesses, notation, labels, and readout hidden cannot locate a shared sideways transfer in the strokes themselves.

## Determinism
Seed: `0x42525538`. The engine uses a local seeded PRNG for autonomous membranes and stroke micro-variation; visitor coordinates are clamped to the field and are part of the frame state.

## Quality boundary
This is a candidate / held daily work until fresh headless browser matrix evidence and an independent caption-free perceptual review are recorded. Source and engine checks are not treated as proof of visual success.
