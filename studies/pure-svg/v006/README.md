# Pure SVG / v006

## Status

**Candidate / held.** This is a real daily tableau, not a placeholder. It is the sixth mutation of the Pure SVG current and stays held until an independent caption-free perceptual comparison confirms that the changed mass distribution survives without its balance witnesses.

## Creative record

- **Hypothesis:** a refusal can alter the animal's weight instead of rotating its coordinate system.
- **Changed rule:** every remembered refusal becomes a counterweight. Downstream contour mass makes a delayed outward bow and later legs migrate around the counterweight's shared balance point.
- **Visible consequence:** one animal keeps its head and body family while its rear mass bows in sequence and its feet shift around a common displaced load. Lime points and dotted threads are witnesses only.
- **Deterministic state:** `SEED = 0x53564736`; `STAGES = 10`; `PRIMITIVE_BUDGET = 16`; memory is capped to five counterweights. Pointer input is bounded to `x: 0.04..0.96`, `y: 0.12..0.88`.
- **Interaction:** click or tap the field, press Enter/Space after focusing it, or use `place a weight`. `unweight latest` recomputes the preceding body and routes; `release the body` returns to the autonomous sequence.
- **Falsifier:** hide the counterweight points, load threads, labels, and readout. If the body does not read as one animal whose downstream mass and feet share a changed balance, the direction fails.
- **Deletion condition:** delete this version if unweighting the latest memory leaves downstream contour points or route coordinates unchanged, or if the body still reads as a rigid hinge.

## Lineage

`pure-svg-v005` → v006: from a remembered hinge that rotates the body to a remembered counterweight that redistributes mass and footing.

## Evidence state

The deterministic engine, bounded visitor input, exact undo, tableau-first contract, and daily register are covered by `tests/pure-svg-v006.test.mjs`. Browser evidence and the independent caption-free review are recorded in `metrics.json` after the local run; any unresolved viewport or network item keeps this candidate held.
