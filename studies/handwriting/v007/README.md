# Handwriting v007 — The sentence stutters together

**State:** candidate / held

## Artistic hypothesis

A refusal can become a shared hesitation instead of a hole. If one route cannot continue cleanly, nearby routes should repeat its small gesture together and carry the altered cadence onward.

## Art gate

- **Changed rule:** a remembered refusal becomes a shared stutter. Nearby later routes bend toward one hinge, repeat a doubled hook across the same interval, then leave with a common phase slip before returning to their lanes.
- **Visible consequence:** the image contains a family event, not a local dot: several handwriting routes repeat the same small gesture in one band, then continue slightly out of phase. The repeated motion is part of the route geometry.
- **Deterministic state:** seed `0x73747574`; 13 timeline stages; 16 routes per frame; 32 points per route; a six-stutter memory window. The same stage and memory rebuild the same route points and repeated hooks.
- **Interaction:** pointer placement, `Enter`, or `Space` adds one bounded stutter. `lift latest` removes the newest stutter and recomputes the preceding field. `release sequence` returns to the deterministic timed sequence. `blind=1` hides witness loops, labels, and readout for the caption-free test.
- **Falsifier:** hide the stutter witnesses, labels, and readout. If the routes do not still repeat one local gesture together and carry its changed cadence, the stutter is only a diagram.
- **Deletion condition:** delete v007 if a caption-free comparison cannot locate the shared repeated hook in the handwriting itself, if only one route bends, or if the accent witness carries more meaning than the marks.

## Technical note

`engine.mjs` is the deterministic geometry layer. `sketch.js` renders the route geometry and only adds a restrained witness accent when the editorial view is present; the raw blind mode removes that furniture. The raw study redirects through the canonical daily work record unless `preview=1` is requested.

## Evidence status

The artifact is **candidate / held** until browser-visible interaction, reduced-motion behavior, five-viewport responsive probes, and production readback are observed. Independent caption-free perceptual comparison remains a release boundary; a passing runtime check is not a perceptual approval.
