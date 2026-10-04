# Naive art v023 — The line forgets where it was going

Status: daily candidate, held for independent caption-free perceptual review.

## Hypothesis

A naive picture can remember a mistake as a wrong *rule of making*, not as a damaged object. If a visitor taps twice within one short interval, a continuous painted route should land at the wrong anchor, leave the intended arrival unpainted, and make later bands inherit that wrong landing. The memory must be carried by rebuilt path geometry, not by a counter, tint, label, or after-the-fact mark.

## Cultural translation

The selected reference is [`p5.brush`](https://github.com/acamposuribe/p5.brush). Its observed mechanism is that pressure, density, and vector fields are programmable material forces: they alter how geometry is produced rather than decorating a finished drawing. v023 refuses its brush surface, watercolor, hatching, and API vocabulary. It translates material agency into a browser Canvas route: a timed double tap changes the landing rule of one band, and later bands are rebuilt from that wrong point.

## Changed rule

v020 used a pressure print sheet, v021 used an inline-SVG room topology, and v022 used browser layout with separate cut-outs. v023 changes representation, composition, encounter, and memory together:

- the picture is one continuous, full-field Canvas route rather than a sheet, map, or slot register;
- one tap only arms a temporal interval; a second tap before the interval expires commits the mistake;
- the committed band lands at a wrong anchor, so the intended arrival is a real gap in the route;
- later bands reuse the wrong landing as their new starting condition;
- lifting the latest slip reconstructs the exact preceding route.

The gesture is `wait → double tap → wrong landing → future route reuse`.

## Visible consequence

- the blind first view is a sweeping chain of broad coloured bands with no rooms, cards, slots, or captions;
- pointer movement and a single tap do not write history;
- a committed double tap changes actual stroke endpoints and a later knot, while an intended arrival remains empty;
- the bounded four-event window retains route mistakes, undo removes only the newest, and release restores the seeded route.

## Art gate

- **Seed/state:** `0x4e413233`, twenty deterministic stages, four-event visible memory window; reduced motion/static preview settles on the final retained state.
- **Expected consequence:** one timed double tap changes path geometry and causes later strokes to inherit the wrong landing without explanatory prose.
- **Falsifier:** if the event only changes colour, if the gap is a marker, if later bands keep the same starting geometry, or if the blind field reads as a line chart, the translation fails.
- **Deletion condition:** delete v023 if caption-free comparison cannot distinguish `wrong landing → reuse` from v020's pressure transfer, v021's wrong-room topology, and v022's vacancy/reflow, or if the relation needs the readout and controls to be understood.

## Interaction

Tap once and wait. Tap again within the short interval to commit a slip at the nearest route anchor. A single tap is refused. The **make a slip** control, `Enter`, and `Space` commit the seeded event; `Delete`/ **lift latest** removes only the newest remembered slip; `R`/ **release picture** clears visitor memory. `S` saves the measured state as JSON. Pointer movement never writes memory.

## Evidence boundary

The deterministic Canvas route engine, temporal double-tap threshold, exact undo, responsive shell, and browser evidence are recorded in `metrics.json` and the dated QA proof. The candidate remains held for independent caption-free perceptual review and provider revision linkage; runtime evidence is not perceptual approval.
