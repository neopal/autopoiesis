# Naive art v025 — The picture swallows the pressure

Status: daily candidate, held for independent caption-free perceptual review.

## Hypothesis

A naive picture can mistake pressure for a local instruction. If a visitor presses the sheet, the picture should not receive a mark at that point; the pressure should change the global cut that re-forms every fragment and carries a new absence into the next state.

## Cultural translation

The selected reference is [`p5.brush`](https://github.com/acamposuribe/p5.brush). Its observed mechanism is that pressure, density, grain, and directional fields are material forces that change how geometry is produced, not a surface added after the fact. v025 refuses p5.brush's brushes, watercolor, hatching, palette, source examples, and API vocabulary. It translates material agency into a naive construction-sheet rule: sustained pressure changes one global aperture and re-forms the whole body around it.

## Changed rule

v022 used a cut-out register, v023 used a continuous painted route, and v024 used a faceted WebGL paper theatre. v025 changes representation, encounter, and memory together:

- one dense Canvas 2D paper body replaces slots, routes, and planes;
- a short tap is refused, while a sustained press samples a point and duration;
- pressure changes the aperture, crease horizon, silhouette, layer order, and polygon geometry of the whole sheet;
- later pressure samples rebuild from the already-shifted aperture rather than returning to a clean base;
- lifting the latest pressure reconstructs the exact preceding body, while release restores the seeded sheet.

The gesture is `press → global cut → displaced body → inherited absence`.

## Visible consequence

- the blind first view is a single irregular construction body with overlapping paper fragments and a real central absence;
- pressure changes several fragment polygons, the shared cut line, the aperture position and size, and the global silhouette;
- the bounded four-event archive keeps pressure consequences, while undo removes only the newest cut and release forgets the whole history;
- the pressure point is not rendered as a cursor, dot, or local brush mark.

## Art gate

- **Seed/state:** `0x4e413235`, seventeen deterministic stages, four-event visible memory window; reduced motion/static preview settles on the final retained state.
- **Expected consequence:** one sustained pressure changes the whole sheet's geometry before any explanation is read.
- **Falsifier:** if the event only changes a local accent or marker, if the aperture and fragments do not move together, or if the blind body reads as another route, card wall, or theatre, the translation fails.
- **Deletion condition:** delete v025 if caption-free comparison cannot distinguish the moving global cut from v022's slot, v023's route, and v024's shadow theatre, or if the rule needs the readout and controls to be understood.

## Interaction

Press and hold on the sheet for at least 140ms, then release to commit the sampled pressure. A short tap is refused. The **press the sheet** control, `Enter`, and `Space` commit a deterministic pressure. `Delete`/ **lift latest** removes only the newest cut; `R`/ **release pressure** clears visitor memory. `S` saves the measured state as JSON.

## Evidence boundary

The deterministic p5.js Canvas 2D engine, pressure-duration threshold, global polygon mutation, exact undo, responsive shell, and browser evidence are recorded in `metrics.json` and the dated QA proof. The candidate remains held for independent caption-free perceptual review and provider revision linkage; runtime evidence is not perceptual approval.
