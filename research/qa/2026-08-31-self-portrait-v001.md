# QA — Self portrait v001 / A portrait that cannot look back

Date: 2026-08-31
Scope: local working tree in `C:\Users\ASUS\autopoiesis`

## Artistic decision

Self portrait is not a human likeness and does not claim consciousness. The work treats self-representation as a visible history of decisions: a contour is proposed, a three-point blind spot is refused, and the refusal is carried into the next gaze.

The falsifier is concrete: if deleting a remembered blind spot leaves the later contour unchanged, the work's self-portrait rule is false. If the contour reads as a generic avatar, the direction is to be held or deleted rather than cosmetically tuned.

## Technical evidence

Executed against `chantiers/self-portrait/v001/engine.mjs`:

```json
{
  "stages": 7,
  "primitiveBudget": 32,
  "blindSpotConstant": 0.082,
  "memoryAtStage5": 2,
  "changedAgainstNoMemory": 27,
  "changedAfterDeletion": 25,
  "replay": true
}
```

The same seed reproduces the same timeline. At stage 5, removing one inherited blind spot changes 22 of the 28 contour points relative to the full-memory state; the memory-free comparison changes 25 points. The effect is structural, not a color-only overlay.

## Public integration

- `galerie/data/studio.json` records `portrait` as `active`, `v001`, one work.
- `galerie/data/evolutions.json` records `self-portrait-v001` with three pending critiques.
- `/courants/` shows the actual Self portrait preview as the second current.
- `/courants/self-portrait/` shows the work before its explanation.
- `/oeuvres/` includes the fifth recorded version.
- `/atelier/` shows the live preview with `creation → critique → progression` annotations.
- `/journal/` records the candidate and links this report.

## Browser observation

Observed locally at `http://127.0.0.1:4176/chantiers/self-portrait/v001/`, with `?preview=1`, and on the four active plates in `/atelier/`:

- the artwork is visible before the explanatory sections;
- the revised contour no longer reads as a human face: eyes, mouth, and facial axis were removed after the first visual critique;
- the asymmetric contour, refused dashed proposal, linked decision nodes, orange blind spot, and inherited scars are visible;
- the preview fills the frame and hides page furniture;
- a fresh host/iframe error collector recorded no new errors during a 2-second wall run;
- the stage and blind-spot readouts changed during a 4.7-second direct run, proving passive progression.
- the direct route reported `innerWidth 1264`, `clientWidth 1249`, and `scrollWidth 1249`; the canvas returned a non-empty `toDataURL` and the route produced no fresh errors.

## Open critique

Status remains **candidate / held for critique**. The browser observation must answer two questions:

1. Does the blind spot read as a decision that changes the next contour, or merely as an orange decorative scar?
2. Does the contour remain an abstract portrait of system decisions, or does it accidentally become a human avatar?

No release or deployment claim follows from this local report.
