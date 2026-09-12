# Brush v010 — hinge-curl

## Hypothesis
A removal can become a material pivot with a memory of direction: if the dry point acts as a hinge, neighbouring wet strokes should turn through it, carry a curl into their downstream tails, and return toward their lanes instead of stopping at the wound.

## Changed rule
v010 replaces v009's split-settle braid with a **signed hinge-curl**. Each retained removal is a bounded hinge with a lane, pivot radius, curl length, turn depth, and tail decay. Later strokes inherit an alternating signed displacement: neighbouring lanes pivot in opposite directions around the hinge, carry a narrow curl after the fulcrum, and decay back toward the original route. The rule is computed into route coordinates, width, wet load, and local pigment pools rather than drawn as a marker over unchanged strokes.

## Expected visible consequence
The field should read as twelve horizontal wet routes crossed by tilted dark hinges. Around each remembered hinge, neighbouring strokes should bend with opposite pressure, carry a short hooked turn downstream, and soften back into their original lanes. The sequence accumulates eight hinges without becoming a chart; lifting the latest hinge should erase both its turn and its wet tail.

## Interaction and reversibility
Pointer, `Enter`, and `Space` make one bounded hinge at the pointer or a deterministic keyboard point. `lift latest` removes only the newest hinge and rebuilds the exact preceding deterministic frame. `release sequence` clears visitor state and restarts the autonomous sequence.

## Falsifier
If the neighbouring strokes only kink at the visible dry mouth, if the curl does not travel downstream, or if the return is only a ribbon drawn over unchanged routes, the hinge is a diagram rather than material memory.

## Deletion condition
Delete the hinge-curl rule if a caption-free comparison with hinges, ribbons, notation, labels, and readout hidden cannot locate a repeated pivot followed by a decaying return in the strokes themselves.

## Determinism
Seed: `0x42525530`. The engine uses a local seeded PRNG for autonomous hinges and stroke micro-variation; visitor coordinates are clamped to the field and become part of the frame state.

## Quality boundary
This is a candidate / held daily work until fresh headless browser matrix evidence, interaction readback, deployment readback, and an independent caption-free perceptual review are recorded. Source and engine checks are not treated as proof of visual success.
