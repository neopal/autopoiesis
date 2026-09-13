# Handwriting v009 — The sentence changes lanes

**State:** candidate / held

## Artistic hypothesis

A refusal can become a change of order instead of a travelling accent. If two neighbouring routes are forced through the same seam, they should cross once, inherit one another’s lane, and make the sentence remember that exchange downstream.

## Art gate

- **Changed rule:** a remembered refusal becomes a lane switch. Two adjacent routes approach one event-owned seam, cross once, exchange vertical order, and continue in the other lane with a small carried drift.
- **Visible consequence:** without any witness mark, the handwriting contains a real X-shaped crossing and an exchanged exit order. The event is structural: downstream route points and line identity change together.
- **Deterministic state:** seed `0x57563339`; 13 timeline stages; 18 routes per frame; 40 points per route; a five-switch memory window. The same stage and memory rebuild the same point geometry, crossing index, and order metadata.
- **Interaction:** pointer placement, `Enter`, or `Space` adds one bounded switch at the last pointer position. `lift latest` removes the newest switch and recomputes the preceding field. `release sequence` returns to the deterministic timed sequence. `blind=1` hides switch witnesses, labels, and readout for the caption-free test.
- **Falsifier:** hide switch witnesses, labels, and readout. If the lines do not visibly cross and leave in exchanged order, the switch is only a diagram.
- **Deletion condition:** delete v009 if an independent caption-free comparison finds only a coloured accent, if the pair does not cross once, if the exchanged order is not legible downstream, or if the copy explains more lane exchange than the handwriting can show.

## Technical note

`engine.mjs` is the deterministic geometry layer. `sketch.js` renders the route geometry and adds a restrained crossing witness only in editorial view; raw blind mode removes that furniture. The raw study redirects through the canonical daily work record unless `preview=1` is requested.

## Evidence status

The artifact is **candidate / held** until local and production browser-visible interaction, reduced-motion behavior, five-viewport responsive probes, and production readback are observed. Independent caption-free perceptual comparison remains a release boundary; a passing runtime check is not a perceptual approval.
