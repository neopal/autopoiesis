# Naive art v010 — The mistake keeps a bypass

Status: daily candidate, held for independent caption-free perceptual review.

## Hypothesis

A naive drawing can keep a mistake alive without correcting it or turning it into a symbol. If a retained wrong turn takes a longer side road around a closed point, the drawing should make memory feel like a changed route rather than a decorative scar. The roof edge, ground, and walking route should each approach, sidestep, travel alongside, and return downstream.

## Changed rule

v009 made each retained correction an approach/threshold/inside/exit doorway. v010 abandons that passage grammar. Each retained correction now becomes a four-phase bypass record: approach, sidestep, alongside, and return. The same record is replayed from three origins — the roof edge, the ground, and the route — while the return moves the next cursor downstream. The mistake does not enter the obstacle; it makes a longer lane beside it.

## Visible consequence

- the proposal panel is a direct house with a straight ground and route;
- the consequence panel gives the roof edge, ground, and walking route the same lateral detour grammar;
- the visitor's x position chooses the bypass side and width, while y chooses its duration, depth, and tilt;
- the visitor can place a bounded bypass, and undo reconstructs the exact previous geometry;
- static preview and reduced motion settle on the final seeded stage without interaction.

## Art gate

- **Seed/state:** `0x4e413130`, fifteen deterministic stages; `static=1` settles on stage 15 with the latest six autonomous bypasses retained in the finite structural window.
- **Expected consequence:** adding one bypass changes `scene.bypassRecords`, the house bypass line, ground bypass line, route coordinates, and downstream roof return together.
- **Falsifier:** if labels, readout, bridge, bypass dots, and all prose are removed and the kept panel reads as an offset or doubled line, the changed rule is not perceptually carried.
- **Deletion condition:** delete v010 if two caption-free comparisons cannot identify a repeated sidestep, alongside run, and return in the roof, ground, and route, or if the visitor gesture changes only a counter.

## Interaction

Click the field to place a normalized bypass. The x position chooses the side and width; the y position controls duration, depth, and tilt. `Enter`/`Space` and **keep the bypass** add the same bounded visitor record. **undo latest** removes the newest record and reconstructs the earlier field. **release sequence** clears visitor memory and restarts the seeded sequence.

## Evidence boundary

The deterministic engine, bounded visitor input, exact undo, canvas-pixel restoration, responsive shell, and local headless browser matrix are recorded in `metrics.json` and the dated QA proof. The candidate remains held for an independent caption-free perceptual review and stable-alias production readback; a passing runtime check is not a perceptual approval.

The v009 record remains intact as lineage. This is one daily work for the Naive art current, not a second work inferred from a before/after panel.
