---
type: simplify-pulse
mode: simplify
date: 2026-08-30
scope: gallery opening stylesheet; held atelier record
status: local change verified; no deployment or release claim
---
# Opening navigation simplification — 2026-08-30

## Pulse brief

- **Active/chosen chantier:** existing gallery / held atelier-record seam; no third chantier opened.
- **Question:** Once the atelier record is held outside primary opening navigation, does the opening stylesheet still retain a bespoke route treatment that could silently restore its elevation?
- **Mode:** `simplify`.
- **Falsifier:** the gallery opening stylesheet contains no `.atelier-link` selector, or the selector remains necessary because current `galerie/index.html` uses it.
- **Bounded output / stop condition:** inspect the current HTML/CSS/test seam, write one narrow regression test, remove only unused held-record navigation styling if red, run that test and the suite. Do not change artwork behavior, deploy, commit, push, or claim release.

## TDD evidence

1. `galerie/index.html` contains no `/atelier/` link, while `galerie/field.css` retained desktop and narrow `.atelier-link` selectors. The selector had no current DOM consumer.
2. **Red:** a new test, `the held atelier record leaves no opening-field navigation styling behind`, failed as expected because `field.css` contained `atelier-link`.
3. **Green:** removed only the unused desktop, focus/hover, and narrow `.atelier-link` CSS declarations.
4. Targeted test passed. Full suite: `npm test` → **8 passing, 0 failing** (100.154 ms). `git diff --check` returned successfully.

## Result

The opening field no longer holds a latent primary-navigation visual treatment for the deliberately held atelier record. This removes an orphaned promotion seam; it does not publish, delete, or otherwise change the untracked atelier draft.

No deployment was made. The deployed D1 matrix remains **hold** for the independently observed gallery collision/undersized masthead target, Handwriting target/work-first failures, and Brush keyboard/motion/target failures.

## Handoff

- **Changed rule:** when an accountability record is held out of primary encounter, remove its route-specific opening style as well as its route link; an invisible CSS seam is still latent promotion.
- **Observed consequence:** the current gallery has no `atelier-link` markup or CSS; the hold is now encoded in both places and guarded by a test.
- **Criticism accepted / resisted:** accepted the atelier-record critique that accountability must not compete with a work encounter. Resisted deleting the untracked record itself: its factual inventory remains available as an internal draft, not a public claim.
- **Next question:** can a separate bounded D1 correction packet make the deployed gallery masthead target at least 44px and reserve the title label zone without covering the field or using clipping?
- **Hypothesis died:** the assumption that removing a held route from HTML alone was sufficient died. No art hypothesis died.
