# Mutine Naive Art v030 — The paper carries weight to the wrong edge

## Hypothesis

If a naive picture treats correction as material load rather than a visible mark, then a sustained hold should sink one place in a single body and make later material answer at a remote edge. The picture should remember the pressure in its contour and seam field, not in a counter or cursor effect.

## Changed rule

v030 abandons v027's layered registration print, v028's semantic mark strip, and v029's twelve-part false-join picture. The medium changes to one continuous inline SVG slab with a smooth closed contour and five fibrous seams.

Pointerdown is only an offer. Stillness is the causal threshold: a light touch is refused, while a hold of at least 560ms commits a material load. The local contour sinks, a non-local contour bends, and the seam field carries that load into the geometry of the next event. Four loads remain in bounded memory; lifting the latest reconstructs the exact preceding slab and release returns to the seeded body.

The event must live in the actual SVG geometry: boundary coordinates, seam bends, and seam load. The pressure witness, status line, and control labels are witnesses only.

## Cultural translation

The selected reference is [p5.brush](https://github.com/acamposuribe/p5.brush).

- **Observed mechanism:** programmable drawing tools treat pressure, density, grain, and direction as material behavior; the field engine bends how strokes are produced rather than decorating finished lines.
- **Mutine translation:** refuse a brush surface and translate material agency into naive error: a held pressure deposit changes the rule that produces the next silhouette, sending load from the touched zone to a remote edge.
- **Visible consequence:** the first blind view is one warm continuous slab, not a collection of patches. A sustained hold changes the actual closed contour and at least three boundary points, plus a remote seam and the future seam field; a short hold leaves the slab exact.
- **Falsifier:** delete this direction if the hold only changes a glow, if the local and remote contour changes cannot be found without labels, if later loads restart from the seeded slab, or if lift is inexact.
- **Anti-copy:** no p5.brush code, API, brush preset, watercolor appearance, hatching vocabulary, palette, or composition is reproduced.
- **Direction consequence:** this closes naive art's patch / mark / false-join sequence and opens a pressure-memory direction in which the mistake is a force that changes how the next body is made.

## Interaction

- Pointer or touch: hold still on the slab until it yields. `pointerdown` arms without writing; release after the threshold commits.
- `Enter` or `Space`: deterministic pressure load.
- `Delete`: lift latest load.
- `R`, `Escape`, or release control: release all memory.
- A shallow press is explicitly refused.

## Falsifier and deletion condition

Delete v030 rather than polish it if the blind slab reads as a decorative blob, if pressure is indistinguishable from a click, if the remote bend is only a readout effect, if subsequent loads do not inherit the seam field, or if exact lifting fails.

## Deterministic state

- seed: `0x4e413330`
- boundary points: 18
- seam count: 5
- pressure zones: 7
- memory window: 4
- minimum dwell: 560ms
- renderer: inline SVG, no external art assets
