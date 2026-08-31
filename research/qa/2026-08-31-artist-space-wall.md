---
type: studio-pulse
mode: make
current: studio-wall
status: local; awaiting independent review and deployment
date: 2026-08-31
---

# Artist space — annotated wall / 2026-08-31

## Question

Can Mutine show the six identified currents, their tableaux or their absence, and the creation → critique → progression loop without asking the visitor to operate a control surface?

## Actual change

- Rebuilt the local `/atelier/` surface as a secondary public studio wall.
- Added one annotated plate for each registry current: `typography`, `portrait`, `svg`, `brush`, `naive`, `webgpu`.
- Active plates link to one progressive v002 work and one held executable v001 interaction.
- Dormant plates explicitly say `NO TABLEAU / QUESTION HELD`; they are not presented as works.
- Each plate carries three short annotations: `creation`, `critique`, `progression`.
- Added a quiet `studio` route from the opening header without adding it to `Current studies`.
- Removed controls from the public wall: no button, input, select, or textarea.

## Evidence

- `npm test`: **12 passing, 0 failing**.
- Local browser navigation to `http://127.0.0.1:4174/atelier/` returned the title `MUTINE — studio wall` and an accessibility tree containing six article headings, two executable-work links, and no visitor controls.
- Local browser navigation to `http://127.0.0.1:4174/chantiers/typographie-manuscrite/v002/` returned the title `MUTINE — the route remembers`; its canvas rendered with `ROUTE MEMORY / STAGE 01` and `REFUSED SEGMENTS / 10`, then progressed after ten seconds to `ROUTE MEMORY / STAGE 05` and `REFUSED SEGMENTS / 11` without input.
- Browser console and JavaScript error collectors were empty for the local wall load.
- Visual inspection of the local wall showed a paper/ink annotated surface with active plates marked in oxide and dormant plates separated as empty questions. v002 showed pale inherited routes and oxide refusal scars rather than a blank canvas.

This packet proves a local page was served and inspected. It does not yet prove Vercel deployment, the five-width D1 matrix, or that any dormant current has produced a work.

## Critique

Accepted: the previous atelier draft was too much accountability prose and made process compete with the work. The new wall gives the artist a visible record while leaving the opening encounter work-first.

Resisted: calling the CSS diagram fields finished artworks. They are annotation surfaces until a current has an executable, observed, critiqued tableau.

## Current doubts

- Brush v001 still exposes visitor-operated controls; the wall records this failure but does not solve it.
- Handwriting v002 is observed locally across two stages, but its causality and reduced-motion behavior still need the release matrix.
- The six plates are documentary compositions, not six newly generated works.
- The local wall has only been inspected at the browser's available viewport; no five-size release claim is made.

## Next falsifiable move

Run Handwriting v002 through the five-width release matrix and an adversarial deletion test. Reject the revision if removing the inherited scar leaves the later route unchanged, or if reduced motion removes the causal evidence.

No period is declared. No dormant current is promoted. No deployment claim is made in this record.
