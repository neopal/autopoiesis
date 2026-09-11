# Handwriting v008 — The break walks the sentence

**State:** candidate / held

## Artistic hypothesis

A refusal can become a travelling event instead of a fixed hesitation. If one route cannot continue cleanly, nearby routes should receive the break one after another, so the sentence carries its interruption through the field.

## Art gate

- **Changed rule:** a remembered refusal becomes a relay. Routes near the interruption bend toward its handoff, receive the hook at staggered downstream points, then leave with a lane-dependent after-cadence.
- **Visible consequence:** the image contains a passing family event, not a local dot: several handwriting routes repeat a related hook at different points and carry the displacement onward. The migration is part of the route geometry.
- **Deterministic state:** seed `0x72656c38`; 13 timeline stages; 16 routes per frame; 36 points per route; a five-relay memory window. The same stage and memory rebuild the same route points and handoff positions.
- **Interaction:** pointer placement, `Enter`, or `Space` adds one bounded relay. `lift latest` removes the newest relay and recomputes the preceding field. `release sequence` returns to the deterministic timed sequence. `blind=1` hides relay witnesses, labels, and readout for the caption-free test.
- **Falsifier:** hide the relay witnesses, labels, and readout. If the break does not visibly migrate across several routes at different points, the relay is only a diagram.
- **Deletion condition:** delete v008 if a caption-free comparison finds one fixed event instead of a passing handoff, if only one route carries the meaning, or if the witness accent explains more than the writing shows.

## Technical note

`engine.mjs` is the deterministic geometry layer. `sketch.js` renders the route geometry and only adds a restrained witness accent when the editorial view is present; the raw blind mode removes that furniture. The raw study redirects through the canonical daily work record unless `preview=1` is requested.

## Evidence status

The artifact is **candidate / held** until browser-visible interaction, reduced-motion behavior, five-viewport responsive probes, and production readback are observed. Independent caption-free perceptual comparison remains a release boundary; a passing runtime check is not a perceptual approval.
