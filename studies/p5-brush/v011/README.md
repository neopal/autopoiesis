# Brush v011 — siphon-release

## Hypothesis
A removal can become a capillary event with a memory of pressure: if the dry point acts as a siphon mouth, neighbouring wet strokes should gather toward it, compress into a shared throat, and release downstream instead of merely bending around the wound.

## Changed rule
v011 replaces v010's signed hinge-curl with a **siphon-release**. Each retained removal is a bounded siphon with a lane, mouth radius, intake reach, pull strength, throat depth, release length, and stain load. Later strokes inherit a signed displacement: nearby lanes gather toward the mouth, compress through a narrow throat, then fan out after it with a decaying downstream release. The rule is computed into route coordinates, width, and wet load rather than drawn as a marker over unchanged strokes.

## Expected visible consequence
The field should read as fourteen horizontal wet routes whose repeated grammar is gather → throat → release. Around each remembered siphon, neighbouring strokes should visibly converge before the dry mouth, pass through a brief pressure seam, and separate after it with alternating downstream pressure. The sequence accumulates nine siphons without becoming a chart; lifting the latest siphon should erase its convergence, throat, and fan.

## Interaction and reversibility
Pointer, `Enter`, and `Space` make one bounded siphon at the pointer or a deterministic keyboard point. `lift latest` removes only the newest siphon and rebuilds the exact preceding deterministic frame. `release sequence` clears visitor state and restarts the autonomous sequence.

## Falsifier
If the routes remain parallel through the mouth, if the throat is only a visible witness, or if the release is a ribbon drawn over unchanged strokes, the siphon is a diagram rather than material memory.

## Deletion condition
Delete the siphon-release rule if a caption-free comparison with mouths, capillary witnesses, notation, labels, and readout hidden cannot locate a repeated gather, compression, and downstream fan in the strokes themselves.

## Determinism
Seed: `0x42525531`. The engine uses a local seeded PRNG for autonomous siphons and stroke micro-variation; visitor coordinates are clamped to the field and become part of the frame state.

## Quality boundary
This is a candidate / held daily work until fresh headless browser matrix evidence, interaction readback, deployment readback, and an independent caption-free perceptual review are recorded. Source and engine checks are not treated as proof of visual success.
