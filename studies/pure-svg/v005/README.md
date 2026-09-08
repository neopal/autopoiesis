# Pure SVG / v005

## Status

**Candidate / held.** This is a real daily tableau, not a placeholder. It is the fifth mutation of the Pure SVG current and stays held until an independent caption-free perceptual comparison confirms that the changed axis survives without its hinge witnesses.

## Creative record

- **Hypothesis:** a refusal should change the animal's coordinate system instead of adding a wound or removing a room.
- **Changed rule:** every remembered refusal becomes a hinge. The downstream contour rotates around its joint, and every later leg inherits the same fold axis.
- **Visible consequence:** the animal's rear silhouette kinks as one body and its folded feet arrive under the same new axis. The lime hinge pins and fold trace are witnesses only.
- **Deterministic state:** `SEED = 0x53564735`; `STAGES = 9`; `PRIMITIVE_BUDGET = 14`; memory is capped to five hinges. Pointer input is bounded to `x: 0.04..0.96`, `y: 0.12..0.88`.
- **Interaction:** click or tap the field, press Enter/Space after focusing it, or use `make a hinge`. `unhinge latest` recomputes the preceding body and routes; `release the body` returns to the autonomous sequence.
- **Falsifier:** hide the hinge pins, fold trace, labels, and readout. If the body does not read as one animal whose rear half and feet share a changed axis, the direction fails.
- **Deletion condition:** delete this version if unhinging the latest memory leaves downstream contour points or route coordinates unchanged, or if the hinge reads as a decorative joint.

## Lineage

`pure-svg-v004` → v005: from negative anatomy (a missing chamber) to an altered coordinate system (a remembered hinge).

## Evidence state

The deterministic engine, bounded visitor input, exact undo, tableau-first contract, and daily register are covered by `tests/pure-svg-v005.test.mjs`. The browser evidence and independent caption-free review are recorded in `metrics.json` after the local run; any unresolved viewport or network item keeps this candidate held.
