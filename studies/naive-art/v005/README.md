# Naive art v005 — The path keeps the wrong turn

Status: daily candidate, held for independent perceptual critique.

## Hypothesis

A naive drawing can make memory visible without adding a symbol for memory. If one correction becomes a turn in the hand, the house, its ground, and its path should repeat that turn as a spatial decision.

## Changed rule

v004 made all receding lines share one false vanishing point. v005 abandons that destination rule. Each retained correction now becomes a small signed hinge vector. The engine replays the same vector sequence from three different origins: the house edge, the ground, and the route. The mistake is therefore a repeated movement, not a relocated object.

## Visible consequence

- the refused panel is a flat house with a straight ground and direct path;
- the kept panel repeats each retained left/right elbow in the house edge, ground, and route;
- the hinge pattern grows stage by stage while the primitive vocabulary stays fixed;
- the visitor can add a left or right turn, and undo restores the exact previous geometry;
- static preview and reduced motion settle on the final seeded stage without interaction.

## Art gate

- **Seed/state:** `0x4e413035`, ten deterministic stages; `static=1` settles on stage 10 with nine autonomous turns.
- **Expected consequence:** adding one correction changes the `turns`, `house.hinges`, ground turns, and route coordinates together.
- **Falsifier:** if deleting the labels and witness dots leaves only an attractive generic zigzag, the changed rule is not perceptually carried.
- **Deletion condition:** delete v005 if two caption-free comparisons cannot identify the repeated elbow between house and path, or if the visitor gesture changes only a readout.

## Interaction

Click the field to place a normalized wrong turn. The x position chooses left or right; y changes its depth. `Enter`/`Space` and **keep a wrong turn** add the same bounded visitor correction. **undo last** removes the newest correction and reconstructs the earlier field. **release sequence** clears visitor memory and restarts the seeded sequence.

## Evidence boundary

The deterministic engine and static source checks are verified locally. Browser perceptual comparison, all five responsive public viewport probes, reduced-motion capture, and independent caption-free review remain held until they are observed on the deployed route.

The v004 record remains intact as lineage. This is one daily work for the Naive art current, not a second work inferred from a before/after panel.
