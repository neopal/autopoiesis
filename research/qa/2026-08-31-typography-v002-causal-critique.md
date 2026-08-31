---
type: studio-pulse
mode: criticise
role: critic
current: typography
status: hold; observation-only
date: 2026-08-31
---

# Handwriting v002 — causal critique / local observation

## Question

Does the autonomous route make inherited refusal materially visible, or do the red scars and later bends remain decorative line-work?

## Worktree boundary

The repository was inspected before acting. `git diff --cached --name-status` was empty, while the worktree already contained unrelated unstaged edits in `HANDOFF.md`, `galerie/field.css`, and `galerie/field.js`, plus prior untracked evidence and QA records. No existing file was edited, staged, unstaged, reverted, or committed in this pulse. This record is the only new file.

## Evidence actually observed

- Local server check: `GET /galerie/`, `/galerie/field.js`, and `/galerie/field.css` returned HTTP `200` from `http://127.0.0.1:4173/`.
- Local browser route: `http://127.0.0.1:4173/chantiers/typographie-manuscrite/v002/` loaded as `MUTINE — the route remembers` with the canvas, seed caption, three annotations, and no button/input/select/textarea controls.
- Runtime console/error check: browser console messages `0`; JavaScript errors `0`.
- Runtime geometry at the browser's available viewport: `innerWidth=1264`, `innerHeight=625`, `clientWidth=1249`, `scrollWidth=1249`; the canvas measured `1046.78125 × 588.8125` at x=`101.109375`.
- Visual run: the canvas advanced autonomously from `ROUTE MEMORY / STAGE 02` to `STAGE 03` without visitor input. Pale previous routes remained visible while darker later routes and oxide refusal segments changed the field's crossings.
- Causal runtime probe in the loaded page: `buildStage(3)` contained `9` memory scars; comparing its routes with fresh `makeRoutes(3, [])` altered all `11` routes, with maximum measured point displacement `0.04000000000000003`; two repeated `buildStage(3)` calls were byte-for-byte repeatable (`repeatable=true`).
- `npm test`: `12 passing / 0 failing`. `node --check galerie/field.js` and `git diff --check` passed; these checks cover the existing worktree, not deployment.

## Critique

**Accepted:** the causal rule is present in the observed runtime, not only in the prose: memory is reconstructed deterministically and changes later route geometry. This is stronger than a scar overlay whose deletion would leave the later route unchanged.

**Resisted:** declaring v002 a finished work. The visual capture still reads first as a disciplined route diagram; the causal displacement is subtle at the available frame and requires the runtime probe to become legible as evidence. The five contract viewports, reduced-motion behavior, resize behavior, reload parity, and independent art critique remain unobserved.

## Result / changed rule

No code change. The rule for this pulse is: **a memory claim may advance from intention to trial evidence only when a loaded runtime comparison shows that inherited state changes later geometry and repeated evaluation is deterministic; visible red marks alone do not count.** Typography remains a local autonomous study under critique, not promoted work or a period.

## Doubt

The algorithmic displacement is measurable, but the viewer may not be able to distinguish inherited displacement from fresh route variation without an explicit deletion comparison. The available run also shows `scrollWidth < innerWidth`, but it is not a valid five-width D1 matrix and does not establish release readiness.

## Next falsifiable move

Run an adversarial browser deletion test against the exact study: remove one inherited scar from the stage-3 memory before route construction and compare the resulting later route. Reject the memory rule if the route is unchanged or if the difference cannot be made perceptually legible without explanatory prose. Only proceed with code after the existing worktree is resolved by its owner and a narrow red regression test is written first.
