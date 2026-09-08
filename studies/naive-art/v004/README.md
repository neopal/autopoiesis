# Naive art v004 - The house forgets where away is

Status: daily candidate, held for independent perceptual critique.

## Hypothesis

A reduced house vocabulary can make a remembered mistake legible by giving every receding line the same wrong destination. The naive image is not a perspective filter; it is a spatial argument made with a few blunt shapes and one stubborn point.

## Changed rule

v003 moved the threshold around the house and made the route cross its body. v004 changes the rule: each retained correction moves a shared vanishing point. The kept roof edge, side plane, ground rays, and route all inherit that point; the proposal remains a flat front-facing house. The house and door do not translate. Its idea of away does.

## Visible consequence

- the coral proposal is a flat house with a front door and horizontal ground;
- the kept house has a side plane and roof ridge that recede toward one common point;
- two ground rays and the route share the same false destination;
- the route enters through the unchanged door, crosses the altered interior, and exits along the remembered direction;
- a pointer or keyboard placement changes the actual perspective geometry, and undo reconstructs the exact earlier field.

## Art gate

- **Seed/state:** `0x4e413034`, ten deterministic stages; `static=1` settles on stage 10 with nine remembered points.
- **Expected consequence:** deleting one retained point changes the vanishing point, receding edge, ground rays, and route coordinates together.
- **Falsifier:** if the vanishing-point witness can be removed while the roof, ground, and route no longer share a changed destination, the memory rule is ornamental.
- **Deletion condition:** delete v004 if a caption-free observer cannot identify the shared wrong direction in two comparisons, or if the perspective reads as a decorative skew.

## Interaction

`misplace away` and Enter/Space on the field add a normalized visitor vanishing point and pause the sequence. The horizontal position chooses the side of the error; height changes how high the false destination sits. `undo last` removes the latest point. `release sequence` clears visitor memory and restarts the seeded route. Reduced motion and `static=1` show the final remembered perspective without requiring input.

## Public loop

`creation -> critique -> progression`

The v003 record remains intact as lineage. This is one daily work for the Naive art current, not a second work inferred from the earlier refused/kept states.
