# Pure SVG v019 — The valve turns its face.

## Hypothesis

If SVG paint order is treated as material state rather than implementation detail, a small primitive budget can make a strange valve whose front and back are consequences of pressure.

## Changed rule

The previous Pure SVG works made the visitor select a local point and changed topology through a body, loop, or disjoint compound plate. v019 removes positional selection. Seven closed channel paths form one radial pressure valve. A global pressure event changes the order in which channels are painted, flips one channel's winding and bend, and opens a real even-odd aperture in another channel. Later channels inherit the new front/back order.

## Visible consequence

The blind first view is one compact radial lock made from seven unequal broad channels, not a loop, corridor, tile board, or collection of plates. After pressure, one channel falls behind the stack, another carries an actual aperture, and the overlap silhouette changes. Repeating the command keeps at most four pressure events. Delete lifts only the latest event and reconstructs the exact prior geometry signature.

## Interaction

- Pointer movement and pointer taps are deliberately refused; the artwork has no location-based selector.
- The `pressure` button, Enter, Space, or `P` commits one bounded global order inversion.
- Delete, Backspace, or `lift latest` removes the latest event.
- `R` or `release valve` restores the empty valve field.
- `S` downloads the currently rendered inline SVG.

## Falsifier

The translation fails if pressure changes only colour, opacity, a counter, or a decorative halo; if the front/back order does not change; if the aperture is not a real even-odd cut; if pointer taps commit; or if the blind view reads as a decorative radial chart rather than a valve with a changed occlusion law.

## Deletion condition

Delete v019 rather than polish it if the labels-off, controls-off, readout-off comparison cannot distinguish a single pressure valve from v018's plate array, or if lifting the latest event does not restore the exact prior signature.

## Cultural translation

Reference: [p5.brush](https://github.com/acamposuribe/p5.brush).

Observed mechanism: pressure, density, grain, and vector fields are programmable material forces that change how geometry is produced and remembered rather than decorating a finished form.

Mutine translation: refuse the brush surface and translate material pressure into SVG occlusion. Pressure changes the geometry-producing order of a radial valve: one channel flips behind the stack, another opens a real aperture, and later channels inherit the altered front/back law.

Visible consequence: the first view is a single valve-like radial lock; after pressure, the silhouette, overlaps, winding, and aperture change together.

Falsifier: if the event only changes colour, if the aperture is an overlay, if the paint order remains fixed, if pointer taps commit, or if the blind image reads as a chart, the translation fails.

Anti-copy statement: no p5.brush brushes, watercolor appearance, hatching vocabulary, palette, API surface, source examples, or source composition are reproduced.

Direction consequence: closes Pure SVG v016's body, v017's relay loop, and v018's disjoint plate grammar. It opens a material-agency direction where topology is not a hole transferred between objects but a changed law of visibility inside one object.
