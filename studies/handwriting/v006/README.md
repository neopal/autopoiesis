# Handwriting v006 — The gap writes through its neighbours

**State:** candidate / held

## Artistic hypothesis

A refusal should become a visible counterform rather than a private mark. If a sentence loses a place, nearby routes should have to share the opening and carry its altered rhythm beyond the loss.

## Art gate

- **Changed rule:** a remembered refusal becomes a contagious counterform aperture. Nearby later routes converge on one mouth, disappear through the same interval, and re-emerge with a shared phase and exit shift before returning to their lanes.
- **Visible consequence:** the image contains a family event, not a local dot: several handwriting routes narrow toward one absence, vanish together, and leave with a common after-route. The missing spans are part of the geometry.
- **Deterministic state:** seed `0x6d757469`; 11 timeline stages; 15 routes per frame; 28 points per route; a six-gap memory window. The same stage and memory rebuild the same route points and missing spans.
- **Interaction:** pointer placement, `Enter`, or `Space` adds one bounded gap. `lift latest` removes the newest gap and recomputes the preceding field. `release sequence` returns to the deterministic timed sequence. `blind=1` hides witness rings, labels, and readout for the caption-free test.
- **Falsifier:** hide the gap witnesses, labels, and readout. If the routes do not still produce one common disappearance with a recognisable shared exit rhythm, the counterform is only a diagram.
- **Deletion condition:** delete v006 if a caption-free comparison cannot locate the common opening and changed after-route in the handwriting itself, if the gap does not affect several routes, or if only the accent witness carries the meaning.

## Technical note

`engine.mjs` is the deterministic geometry layer. `sketch.js` renders route segments on either side of the computed aperture; it does not paint a diagnostic gap over an otherwise stable field. The raw study redirects through the canonical daily work record unless `preview=1` is requested.

## Evidence status

The artifact remains **candidate / held** after browser-visible interaction, reduced-motion behavior, five-viewport responsive probes, and production readback passed. An independent caption-free perceptual comparison is still required; a passing runtime check is not a perceptual approval.
