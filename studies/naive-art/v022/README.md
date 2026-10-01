# Naive art v022 — The picture learns the wrong slot

Status: daily candidate, held for independent caption-free perceptual review.

## Hypothesis

A naive picture can remember a mistake as a change in document order. If a visitor drags one cut-out toward a different slot and releases it there, the browser should leave the original slot vacant, move the former occupant into a real margin rail, and keep the wrong arrangement visible. The memory must live in DOM-like layout geometry, not in a counter, tint, or overlay.

## Cultural translation

The selected reference is `p5-brush`. Its observed mechanism is material agency: pressure, density, and fields change how the next geometry is produced rather than decorating a finished drawing. v022 refuses brush appearance and translates pressure into browser layout. A traveled drag is a pressure event that changes actual slot occupancy; the next picture is produced with a vacancy and a displaced margin piece. No brushes, watercolor, hatching, source palette, API surface, or source composition is reproduced.

## Changed rule

v019 used one continuous panorama, v020 one pressure print sheet, and v021 one inline-SVG topology map. v022 changes representation, composition, encounter, and memory together:

- the drawn field becomes a browser-native paper register made from nine actual DOM cut-outs;
- the visitor must travel with a piece; a short tap is refused;
- releasing in a different occupied slot moves the piece into that slot and sends its former occupant to a visible margin rail;
- the source slot remains an actual vacancy, so the layout carries the error;
- lifting the latest misfile reconstructs the exact preceding arrangement.

The gesture is `drag → wrong address → vacancy → reflow remembers`.

## Visible consequence

- the blind first view is an irregular cut-paper picture, not a map, panorama, or print plate;
- pointer movement alone does not write history;
- a committed drag changes three geometric facts at once: one piece moves, one slot empties, and one former occupant is filed in the margin;
- the bounded four-event memory window retains wrong arrangements, while undo removes only the latest and release restores the seeded picture.

## Art gate

- **Seed/state:** `0x4e413232`, eighteen deterministic stages, four-event visible memory window; reduced motion/static preview settles on the final retained state.
- **Expected consequence:** one committed drag changes actual occupancy and layout in a way that remains legible without prose.
- **Falsifier:** if the drag only moves a temporary cursor, if the vacancy is an overlay, if the margin piece is only a duplicate, or if the blind field reads as a generic dashboard, the translation fails.
- **Deletion condition:** delete v022 if caption-free comparison cannot distinguish `drag → wrong slot → reflow` from v020's pressure transfer and v021's wrong-room topology, or if the slot/vacancy/margin relation requires labels and readout.

## Interaction

Drag a cut-out farther than the threshold and release it over a different occupied slot. A short tap is refused. The **misfile a piece** control, `Enter`, and `Space` commit the seeded event; `Delete`/ **lift latest** removes only the newest remembered misfile; `R`/ **release picture** clears visitor memory. `S` saves the measured state as JSON.

## Evidence boundary

The deterministic DOM-layout engine, traveled drag threshold, exact undo, responsive shell, and browser evidence are recorded in `metrics.json` and the dated QA proof. The candidate remains held for independent caption-free perceptual review and provider revision linkage; runtime evidence is not perceptual approval.
