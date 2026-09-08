# Brush v006 — The brush leaves a wet return

**State:** candidate / held

## Artistic hypothesis

A removal should not only create an absence. It should alter where a later wet stroke is willing to return.

## Art gate

- **Changed rule:** each retained removal becomes a delayed return seam. Later strokes bend around its dry mouth, travel on a displaced course, and re-enter with a local pressure pool.
- **Visible consequence:** the route change begins near a remembered absence but remains visible downstream across the strokes that share its lane. The pooled re-entry is wider/brighter because pressure is part of the route, not a captioned witness.
- **Deterministic state:** seed `0x42525536`; 10 stages; 7 strokes per frame; 54 points per stroke; a six-seam memory window. The same stage and memory rebuild the same frame.
- **Interaction:** pointer placement, `Enter`, or `Space` adds one bounded seam. `lift latest` removes the newest seam and recomputes the preceding field. `release sequence` returns to the timed sequence.
- **Falsifier:** if later strokes do not share the displaced return, or if the route only kinks at the visible dry mouth, the seam is an ornament rather than material memory.
- **Deletion condition:** delete the delayed-return rule if a caption-free comparison with witnesses and notation hidden cannot locate the changed course in the strokes themselves.

## Technical note

`engine.mjs` is the deterministic geometry layer. `sketch.js` renders one route per stroke with pressure-sensitive width and re-entry pools; it does not fake the return with a second explanatory line. The raw study redirects through the canonical daily work record unless `preview=1` is requested.

## Evidence status

The artifact is held until browser-visible interaction, reduced-motion behavior, five-viewport responsive probes, and an independent caption-free perceptual comparison are observed. No deployment or commit is implied by this local study.
