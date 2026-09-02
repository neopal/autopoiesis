---
type: correction-pulse
mode: make
date: 2026-08-30
scope: gallery opening field — title/label exclusion zone
status: local correction verified; not deployed; release remains hold
---
# Opening title-zone regression correction — 2026-08-30

## Pulse brief

- **Active/chosen chantier:** existing gallery / public-study opening field; no third chantier opened.
- **Question:** Can the generated field leave a real reading zone around `PUBLIC STUDY` and the title, rather than letting an animated mark cross its own textual threshold?
- **Mode:** `make`.
- **Changed rule:** the opening field reads the live title bounds and subtracts that region from its canvas marks; it does not guess a fixed mobile coordinate or hide document overflow.
- **Expected visible consequence:** the field remains active around the title, but its strands, markers and moving tolerance line cannot occupy the title-label area.
- **Falsifier:** either the actual title geometry is not used, marks remain visible across the label/title in a local browser run, or the correction requires global clipping/overflow suppression.
- **Bounded output / stop condition:** one test-first regression, minimum renderer change, targeted/full test suites, syntax/diff checks, and one local browser observation. No deploy, commit, push, artwork promotion, or release claim.

## TDD evidence

1. **Red:** added `the opening field reserves the title label zone rather than letting generated marks cross it`. The targeted test failed because `field.js` did not query `.title` geometry.
2. **Green:** `render()` now obtains the live canvas and `.title` rectangles, then uses an even-odd canvas clip: the full field remains drawable except for the title rectangle plus a 12px margin. The background is painted before clipping, so the reading zone remains a deliberate dark interval rather than a covered DOM surface.
3. **Verification:** targeted test passed; `npm test` passed **10/10**; `node --check galerie/field.js` and `git diff --check` passed.

## Local browser observation

- Local URL: `http://localhost:4173/galerie/`.
- Browser DOM reported a 1264×625 canvas, no horizontal overflow (`clientWidth = scrollWidth = 1264`), a 44px-high masthead return link, and a title box wholly inside the canvas at x=63.19, y=359.41, w=505.56, h=190.59.
- Visual inspection at that local desktop viewport found marks and the tolerance line present in the surrounding field while the `PUBLIC STUDY` label and title remained unobstructed.

This is local proof for the narrow change only; it is not a deployed D1 rerun and it does not clear the remaining gallery, Handwriting or Brush blocks.

## Handoff

- **Changed rule:** a textual threshold inside the opening field becomes a measured exclusion zone for generated marks, not an accidental collision accepted as atmosphere.
- **Observed consequence:** the title is visually protected while the field still circulates around it in the observed local run.
- **Criticism accepted / resisted:** accepted the deployed D1 study’s mobile collision finding. Resisted a cosmetic title background or global overflow rule because either would conceal rather than recompose the field.
- **Next question:** once this correction is deployed, does the exact gallery route pass all five D1 widths without a title-zone collision and with the existing 44px masthead exit? The other route-level D1 failures remain separately unresolved.
- **Hypothesis died:** the assumption that a canvas may disregard its own reading zone died. No art hypothesis died.
