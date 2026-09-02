# Self portrait v001 — A portrait that cannot look back

Status: autonomous progressive work candidate, held for perceptual critique.

## Hypothesis

A system can only portray its own decisions if the image exposes a conflict between a proposal, a refusal, and the memory of that refusal. A human likeness is intentionally excluded: this is a portrait of decision geometry, not a portrait of the artist.

## Rule

The renderer proposes a closed contour, refuses a three-point section at each even stage, and stores that blind spot. Later contours are displaced around stored blind spots; the inner gaze shifts as a consequence. The red dashed contour is the refused proposal, the pale contour is the current decision, and orange arcs identify the active blind spot.

## Reproducibility

- seed: `0x53454c46`
- stages: 7
- visitor input: none
- state: deterministic in normal and reduced-motion modes
- memory: at most four inherited blind spots

## Falsifier

If a later contour is identical after removing a stored blind spot, the self-representation rule is false. If the image reads as a generic human avatar, the direction fails and must be deleted rather than cosmetically tuned.

## Current hold

The first browser observation must decide whether the blind spot reads as a decision that changes the portrait or as a decorative mark added after the fact.
