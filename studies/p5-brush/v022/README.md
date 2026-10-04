# Mutine Brush v022 — The brush seals a pause.

## Creative concept

v022 leaves the brush's recent family of things that are removed, fractured, or cut. The first encounter is a continuous wet pigment field: not a lattice, register, coil, or route bundle, but a deep chromatic surface whose density rolls into soft ridges and whose material is only partially set. The mood is suspended pressure. The viewer is asked to wait with the material instead of drawing on it.

A press that ends quickly is refused. A sustained hold thickens the binder inside the field until the pigment makes a cusp. The cusp is not a halo placed over the picture: it changes density, coordinates, heat, and the response available to later holds. The work turns time spent touching into a material state.

## Hypothesis

If a dwell changes binder density in the field that produces later geometry, rather than adding a mark on top of finished geometry, then paint can remember pressure as a change in its future resistance without representing memory as a missing object.

## Changed rule

v022 makes one primary structural rupture relative to Brush v019–v021:

- representation: continuous interpolated pigment field instead of hanging parts, a suspended coil, or a discrete grain lattice;
- encounter: press-and-hold instead of wheel step, pulse, or traveled rake;
- memory: pressure increases binder and forms a cusp; later pressure is computed through the altered field instead of removing material or attaching an answer object.

The engine keeps a bounded sequence of four pressure events. Each event is stored as point, duration, load, and rule, then replayed from the deterministic base field. Lifting the latest event rebuilds the exact preceding geometry.

## Expected visible consequence

Blind, labels-off viewing should first read as a single continuous, turbulent pigment surface with broad colour masses rather than a grid. After a hold, a constricted cusp and its contour should be visible in the field. A second hold elsewhere should not be a copy of the first: it should meet the modified binder field and bend through it.

## Cultural translation

Reference: [p5.brush](https://github.com/acamposuribe/p5.brush)

Observed mechanism: p5.brush treats pressure, density, grain, and directional fields as programmable material forces. Material changes how geometry is produced, rather than decorating a finished shape.

Mutine translation: refuse the source's brush surface and translate its material agency into a dwell threshold. A sustained hold increases binder density in a continuous field, produces a real cusp through altered sample geometry, and changes the material law encountered by the next hold.

Visible consequence: a tap leaves the field unchanged; a hold makes a thickened cusp that bends density and coordinates; a later hold inherits those changed values instead of merely adding a second coloured sticker.

Falsifier: if holding only changes a cursor halo, if the underlying field remains the same outside a cosmetic ring, if a second hold behaves exactly like the first, or if the blind image reads as a generic noise texture, the translation fails.

Anti-copy: no p5.brush brushes, watercolor appearance, hatching vocabulary, API surface, palette, source examples, or source composition is reproduced.

Direction consequence: this closes Brush's recent absence / fracture / cut grammar and opens a material-resistance direction in which time is a force and the field's future geometry is the memory.

## Interaction and replay

- Press and hold on the raw tableau. A dwell shorter than 360ms is refused.
- Enter, Space, and “hold the pigment” use the same deterministic default dwell.
- Delete or “lift latest” removes only the newest event and rebuilds the exact preceding field.
- R or “release field” clears visitor memory and restarts the deterministic sequence.
- S exports a PNG from the raw tableau.

Seed: `0x42525542`. The engine uses a local seeded PRNG and a 54 × 34 continuous sample field. Memory is bounded at four dwells. Reduced motion settles the autonomous sequence, while the visitor can still make and lift a dwell.

## Falsifier and deletion condition

Delete v022 if the labels-off, controls-off, readout-off image cannot communicate a continuous material surface and a visibly changed cusp; if a tap commits; if the second pressure event is indistinguishable from the first; or if the field reads as decorative noise whose causal rule exists only in the annotation.

## Evidence boundary

This is a candidate / held daily work until the local headless browser matrix, interaction readback, route/readback checks, and an independent caption-free perceptual comparison are observed. Engine tests prove deterministic behaviour; they do not prove that the cusp is legible without the caption.
