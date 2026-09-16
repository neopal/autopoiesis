# Naive art v012 — The mistake keeps a bridge

Status: daily candidate, held for independent caption-free perceptual review.

## Hypothesis

A naive drawing can keep a mistake alive without correcting it or turning it into a symbol. If a retained wrong turn must carry itself over a hollow, the drawing should make memory feel like shared support: the roof edge, ground, and walking route should each approach, rise, span, drop, and reunite on the far bank.

## Changed rule

v011 made each retained correction a five-phase vertical bump: approach, lift, crest, descent, and return. v012 abandons that solitary rise. Each retained correction now becomes a five-phase bridge record: approach, rise, span, drop, and reunite. The same record is replayed from three origins — the roof edge, the ground, and the route — while the reunite point moves the next cursor downstream. The mistake is no longer a bump; it becomes a small piece of infrastructure.

## Visible consequence

- the proposal panel is a direct house with a straight ground and route;
- the consequence panel gives the roof edge, ground, and walking route the same suspended-crossing grammar;
- the visitor's x position chooses span length, width, and tilt while y chooses upward/downward polarity and rise;
- the visitor can place a bounded bridge, and undo reconstructs the exact previous geometry;
- static preview and reduced motion settle on the final seeded stage without interaction.

## Art gate

- **Seed/state:** `0x4e413132`, seventeen deterministic stages; `static=1` settles on stage 17 with the latest six autonomous bridges retained in the finite structural window.
- **Expected consequence:** adding one bridge changes `scene.bridgeRecords`, the house bridge line, ground bridge line, route coordinates, and downstream roof return together.
- **Falsifier:** if labels, readout, bridge dots, supports, and all prose are removed and the kept panel reads as an arch drawn over unchanged lines, the changed rule is not perceptually carried.
- **Deletion condition:** delete v012 if two caption-free comparisons cannot identify a repeated approach, rise, span, drop, and reunite in the roof, ground, and route, or if the visitor gesture changes only a counter.

## Interaction

Click the field to place a normalized bridge. The x position changes span length, width, and tilt; the y position controls up/down polarity and rise. `Enter`/`Space` and **keep the bridge** add the same bounded visitor record. **undo latest** removes the newest record and reconstructs the earlier field. **release sequence** clears visitor memory and restarts the seeded sequence.

## Evidence boundary

The deterministic engine, bounded visitor input, exact undo, canvas-pixel restoration, responsive shell, and local headless browser matrix are recorded in `metrics.json` and the dated QA proof. The candidate remains held for an independent caption-free perceptual review and stable-alias production readback; a passing runtime check is not a perceptual approval.

The v011 record remains intact as lineage. This is one daily work for the Naive art current, not a second work inferred from a before/after panel.