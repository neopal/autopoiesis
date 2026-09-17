# Naive art v013 — The mistake keeps a fork

Status: daily candidate, held for independent caption-free perceptual review.

## Hypothesis

A naive drawing can keep a mistake alive without correcting it or turning it into a symbol. If a retained wrong turn must carry two possible ways forward, the drawing should make memory feel like a choice that refuses to resolve: the roof edge, ground, and walking route should each approach, split, carry twin paths, merge, and leave downstream.

## Changed rule

v012 made each retained correction a single suspended bridge. v013 abandons that one-span grammar. Each retained correction now becomes a six-phase fork record: approach, split, upper path, lower path, merge, and leave. The same record is replayed from three origins — the roof edge, the ground, and the route — while the merge moves the next cursor downstream. The mistake is no longer support; it is a temporary plurality that must carry both of its outcomes.

## Visible consequence

- the proposal panel is a direct house with a straight ground and route;
- the consequence panel gives the roof edge, ground, and walking route the same actual split / twin paths / merge grammar;
- the visitor's x position chooses span, width, and tilt while y chooses the upper/lower polarity and separation;
- the visitor can place a bounded fork, and undo reconstructs the exact previous geometry;
- static preview and reduced motion settle on the final seeded stage without interaction.

## Art gate

- **Seed/state:** `0x4e413133`, eighteen deterministic stages; `static=1` settles on stage 18 with the latest six autonomous forks retained in the finite structural window.
- **Expected consequence:** adding one fork changes `scene.forkRecords`, the house fork line, ground fork line, route coordinates, and downstream roof return together.
- **Falsifier:** if labels, readout, fork dots, and all prose are removed and the kept panel reads as one colored branch over unchanged lines, the changed rule is not perceptually carried.
- **Deletion condition:** delete v013 if two caption-free comparisons cannot identify a repeated approach, split, twin paths, and merge in the roof, ground, and route, or if the visitor gesture changes only a counter.

## Interaction

Click the field to place a normalized fork. The x position changes width, span, and tilt; the y position chooses upper/lower polarity and separation. `Enter`/`Space` and **keep the fork** add the same bounded visitor record. **undo latest** removes the newest record and reconstructs the earlier field. **release sequence** clears visitor memory and restarts the seeded sequence.

## Evidence boundary

The deterministic engine, bounded visitor input, exact undo, canvas-pixel restoration, responsive shell, and local headless browser matrix are recorded in `metrics.json` and the dated QA proof. The candidate remains held for an independent caption-free perceptual review and stable-alias production readback; a passing runtime check is not a perceptual approval.

The v012 record remains intact as lineage. This is one daily work for the Naive art current, not a second work inferred from a before/after panel.
