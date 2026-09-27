# Naive art v020 — The picture keeps the wrong pressure

Status: daily candidate, held for independent caption-free perceptual review.

## Hypothesis

A naive picture can remember a mistake as a changed printing law rather than as a damaged object. If a visitor presses the sheet, one plate should lose a real piece of its silhouette, a distant plate should inherit the force as a displaced relief, and the shared register should keep a gap that changes how later impressions are made. Memory must live in the print geometry, not in a counter or caption.

## Cultural translation

The selected reference is `p5-brush`. Its observed mechanism is material agency: pressure, density, grain, and fields change how geometry is produced rather than decorating finished geometry. v020 refuses brush appearance and translates pressure into a print rule: a discrete press opens a cavity in one source plate, moves a distant relief, and misaligns a register axis that carries the error into later plates. No brushes, watercolor, hatching, source palette, API surface, or compositional vocabulary is reproduced.

## Changed rule

v017 used a load-bearing pile, v018 a connected hinged object, and v019 a continuous weather mural. v020 changes representation, composition, encounter, and temporal behavior together:

- the panorama becomes one paper print sheet with five independent relief plates;
- wheel, drag, and dwell are removed; a discrete press is the only causal visitor action;
- the source plate loses an actual contour through a bounded cavity;
- a distant plate changes its outer relief and carries an offset impression;
- the shared vertical register opens a gap and shifts its red registration trace;
- undo removes only the latest pressure and reconstructs the exact preceding sheet.

The gesture is `press → source cavity → distant relief → register misaligns`.

## Visible consequence

- the blind field is a flat print sheet with stamped forms, crop marks, and a vertical register, not a landscape, hinge, pile, or route field;
- pointer movement, a short click, and wheel motion change no geometry;
- a press changes one source silhouette, one distant silhouette, and the shared register together;
- Enter/Space and **press the wrong plate** commit the same deterministic event; undo restores the exact preceding print; release restarts the seeded sequence.

## Art gate

- **Seed/state:** `0x4e413230`, nineteen deterministic stages, four-event visible memory window; reduced motion/static preview settles on the final retained state.
- **Expected consequence:** one press changes a source cavity, a distant relief, and the register gap together.
- **Falsifier:** if labels/readout are removed and the work reads as a decorated panorama or card pile, if a short click changes the sheet, or if cavity/relief/register changes are only colour or overlay, the translation fails.
- **Deletion condition:** delete v020 if two caption-free comparisons cannot distinguish a discrete pressure press from v019's wheel-stepped weather or if the blind view collapses into a generic stamp sheet whose memory is only textual.

## Interaction

Press **press the wrong plate**, or focus the sheet and use `Enter`/`Space`. A press commits one bounded material misreading. Pointer movement, click, and wheel are refused. `Delete`/**undo latest** removes only the newest event and reconstructs the earlier print. `R`/**release the sheet** clears visitor memory and restarts the seeded sequence. `S` saves a PNG.

## Evidence boundary

The deterministic p5.js pressure engine, discrete press rule, exact undo, responsive shell, and browser evidence are recorded in `metrics.json` and the dated QA proof. The candidate remains held for independent caption-free perceptual review and provider revision linkage; runtime evidence is not perceptual approval.
