---
type: critique-pulse
mode: criticise
date: 2026-08-29
scope: P0 responsive compatibility evidence
status: evidence-invalidated; no production change
---
# Compatibility evidence critique — 2026-08-29

## Pulse brief

- **Active/chosen chantier:** P0 responsive compatibility for the period field and the two active v001 routes; no third chantier opened.
- **Question:** Does the 2026-08-29 deployed compatibility record establish a reproducible root cause that can responsibly sponsor a red→green regression fix?
- **Mode:** `criticise`.
- **Falsifier:** the prior record includes valid target viewport geometry and identifies an element whose geometry exceeds that same viewport.
- **Bounded output / stop condition:** audit the evidence and current field implementation; write an accepted/resisted critique and handoff. Do not alter behavior, deploy, commit, or claim release.

## Material inspected

- D1 contract in `STUDIO-OPERATING-SYSTEM.md` and the browser-exhibition viewport-diagnosis procedure.
- The deployed public root and stylesheet were reachable by HTTP `200` at the prior tested URL.
- Current `galerie/index.html`, `galerie/field.css`, and `galerie/field.js`.
- `npm test`: **5/5 passing**. The suite is catalogue/content-oriented; it does not establish DOM geometry or touch-target dimensions.

## Accepted criticism: the prior overflow evidence is not valid enough to diagnose

The previous matrix reports declared viewport dimensions and `scrollWidth`, but it does **not** record the required paired values `innerWidth` and `document.documentElement.clientWidth`. The browser-exhibition procedure explicitly treats a probe as invalid when the declared target width and `innerWidth` differ.

The reported field values—320→650, 390→792, 768→1170, 1280→1682, 1920→2322—therefore do not identify a 320px/390px document geometry. They may be a real overflow, but they may also be a viewport-emulation/scaling mismatch. Without the omitted geometry values, neither proposition is demonstrated. The prior release block remains prudent, but its claimed root-field overflow at *every* contract width is now **unproven**, not confirmed.

The record also names no offending element. This fails the necessary causal bridge from a document-wide width to a responsible CSS or DOM correction. A global `overflow-x:hidden` is present on `body`; it masks visible spill rather than proving that the layout is bounded. It must not be used as a fix.

## Resisted criticism: “the current CSS itself proves the 650px overflow”

The inspected field CSS has several risks—desktop header/footer flex lines, 112px room-column minima, a 330px mobile title, and closed inspector geometry that needs a state-specific check—but none statically explains a 650px `scrollWidth` at a verified 320px viewport. The closed inspector is right-anchored and has no off-screen transform in the current source. Claiming a single root cause from source inspection would repeat the evidentiary error.

## Consequence for the next packet

No production fix is justified yet. The next **test** packet must first restore a valid deployed browser probe and capture, for every contract viewport:

1. declared viewport, `innerWidth`, `clientWidth`, and `scrollWidth` in the closed state;
2. the same geometry with inspector, help sheet, and a room selection opened where applicable;
3. the complete list of elements with `right`, `width`, or `scrollWidth` beyond `clientWidth`;
4. a real touch gesture and keyboard path, plus actual narrow-screen control boxes;
5. reduced-motion state and console/network evidence.

If the valid probe still finds overflow, only then write one narrow failing browser regression test naming the particular element/state, observe red, and make the smallest red→green fix. The existing `overflow-x:hidden` cannot count as that fix.

## Handoff

- **Changed rule:** a `scrollWidth` table without viewport self-report and offender geometry is diagnostic evidence incomplete, not a root-cause finding.
- **Observed consequence:** P0 remains release-blocked, but the breadth of the stated field-overflow defect is downgraded from observed fact to unresolved hypothesis.
- **Criticism accepted / resisted:** accepted the missing viewport-validity and offender-identification criticism; resisted attributing the numbers to the inspector or any single CSS rule without a valid probe.
- **Next question:** can a permission-available browser session produce a valid deployed closed/open geometry matrix before any implementation change?
- **Hypothesis died:** the assumption that the prior `scrollWidth` matrix alone proved the field root cause died. No art hypothesis died.
