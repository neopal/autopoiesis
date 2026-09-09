# Brush v007 — The brush drinks the wound

**State:** candidate / held

## Artistic hypothesis

A removal should not merely sit as an absence. It should pull later wet marks inward and make them release the same material consequence downstream.

## Art gate

- **Changed rule:** each retained removal becomes a capillary pull. Later strokes gather toward the dry point, then release a shared wake downstream with changed route, wetting density, and width.
- **Visible consequence:** the route change is a two-part event: several strokes draw inward around one seam, then leave it together on a shifted course. The wake remains encoded in the strokes rather than only in the seam witness.
- **Deterministic state:** seed `0x42525537`; 11 stages; 8 strokes per frame; 56 points per stroke; a six-seam memory window. The same stage and memory rebuild the same frame.
- **Interaction:** pointer placement, `Enter`, or `Space` adds one bounded seam. `lift latest` removes the newest seam and recomputes the preceding field. `release sequence` returns to the timed sequence.
- **Falsifier:** if the routes only kink at the visible dry mouth, or if the affected strokes do not share a gather and downstream release, the capillary is an ornament rather than material memory.
- **Deletion condition:** delete the draw-in/release rule if a caption-free comparison with witnesses and notation hidden cannot locate the shared gather followed by a downstream wake in the strokes themselves.

## Technical note

`engine.mjs` is the deterministic geometry layer. `sketch.js` renders one material route per stroke with absorption-sensitive width, pigment wetting, and downstream wake. It does not add a second explanatory contour over a stable field. The raw study redirects through the canonical daily work record unless `preview=1` is requested.

## Evidence status

The artifact is held until browser-visible interaction, reduced-motion behavior, five-viewport responsive probes, production readback, and an independent caption-free perceptual comparison are observed. A passing runtime check is not a perceptual approval.
