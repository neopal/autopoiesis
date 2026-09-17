# Handwriting v013 — The sentence passes its cadence.

## State

`v013` is a daily work candidate, recorded as **candidate / held**. It is not a finished period or an exhibition-ready claim.

## Hypothesis

v012 made collective voice visible as a finite chorus. This version asks whether the phrase can have a consequence after the meeting: can handwriting pass its cadence between routes, so that the next line is temporarily carried by a neighbour rather than simply returning to its own lane?

## Changed rule

A remembered chorus now creates a finite cadence relay. A local family approaches one displaced phrase and occupies it together. At the next point, each affected route temporarily inherits the neighbouring route's draft cadence, then settles into its own downstream path with a small carried offset. The handoff is encoded in route coordinates and is replayed from explicit memory; it is not a coloured band drawn over unchanged handwriting.

## Visible consequence

Twenty-four imperfect horizontal passages cross a dark ruled field. At each remembered handoff, a family compresses into a short phrase, passes a neighbour's rise and fall across the next interval, and returns with an altered exit. The relay should read as a travelling kink: a local line does not merely bend toward a marker, it carries another line's cadence before letting go. Timeline relays arrive at deterministic even stages; pointer placement chooses the phrase and family.

## Visitor action

In an interactive preview, touch or click the field, or use **pass cadence**. Enter and Space repeat at the last pointer position. The latest cadence is inserted into memory and later route geometry is recomputed. **Lift latest** removes only the latest handoff and reconstructs the preceding route field; **release sequence** returns to the deterministic empty sequence. The focused canvas also supports `P` pause, `R` release, and `S` still export.

## Deterministic state

- Seed: `0x57563133` (`mutine-handwriting-v013-cadence`)
- Renderer: deterministic Canvas 2D
- Stages: 17, final frame index 16
- Routes: 24, 60 points each, 18 nominal lanes
- Memory window: 6 cadence events
- No external assets or image inputs

## Falsifier

Hide the cadence witnesses, labels, readout, captions, controls, and editorial furniture. If the lines do not still show approach → shared phrase → neighbour handoff → changed exit, the relay is only a diagram. If the handoff cannot be perceived at 320px-wide and 390px-wide viewports, this mutation fails its mobile test.

## Deletion condition

Delete v013 if a caption-free comparison finds only parallel drift, if the neighbour handoff is carried by an accent overlay instead of route coordinates, if edge placement has no structural consequence, or if lifting the latest event leaves the later route signature unchanged.

## Critique response

The structural critic asked for a consequence after the chorus rather than another convergence effect; the engine now uses each affected route's neighbour draft cadence as a finite relay input. The interaction critic asked for a bounded, reversible field; visitor events are clamped, replayed through the same builder as timeline memory, and removed through the preserved prior memory. The perceptual and cynical critiques remain release gates, not claims: this record stays **candidate / held** until caption-free comparison, responsive browser evidence, and public readback are observed.
