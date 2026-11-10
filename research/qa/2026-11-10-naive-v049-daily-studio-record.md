# Mutine daily studio record — Naive art v049 — 2026-11-10

## Slot and concept

- Target slot: `current_id=naive`, `current_index=5/6`, `existing_work_id=none`, `action=create-and-record`.
- Cultural reference: `p5-brush` — [p5.brush](https://github.com/acamposuribe/p5.brush).
- Observed mechanism: pressure, density, direction, and vector fields participate in producing geometry rather than styling a finished mark.
- Mutine translation: refuse the source's brush vocabulary and invert the material rule into pressure-as-belief. An opposed gesture that turns three times is treated by the naive model as evidence; release reconstructs the whole SVG topology around an unjustified seam.
- Structural rupture: v048's reciprocal Canvas ecology, v047's proof strip, and v046's WEBGL vessel become a generated SVG topology of twelve unequal cells, three actual apertures, and produced joins. The viewer no longer selects a witness, crosses a ledger, or holds a throat; they argue with resistance through a turning pressure path.
- Visible consequence: pressure is provisional; a valid release changes every cell and aperture and creates a real join between a wrong pair. Four folds compound and remain liftable.
- Falsifier: delete if the path is only a cursor trace, any refused gesture commits, only one cell changes, the join is cosmetic, fold order is cosmetic, memory resets, or exact lifting fails.
- Deletion condition: delete if the blind view reads as a generic mosaic/interface or cannot be distinguished from v046–v048 without captions.

## Files

- Tableau: `studies/naive-art/v049/index.html`
- Engine: `studies/naive-art/v049/engine.mjs`
- Runtime: `studies/naive-art/v049/sketch.js`
- Styling: `studies/naive-art/v049/style.css`
- Art record: `studies/naive-art/v049/README.md`
- Metrics: `studies/naive-art/v049/metrics.json`
- Critiques: `studies/naive-art/v049/critiques.json`
- Canonical route: `works/naive-2026-11-10/index.html`
- Register: `studio/data/works.json`
- Public catalog: `studio/data/catalog-public.json`
- Proof screenshots: `research/qa/proofs/naive-v049-2026-11-10-local/`

## Evidence completed

- TDD RED observed: `node --test tests/naive-art-v049.test.mjs` initially failed because `v049/engine.mjs` did not exist.
- TDD GREEN observed: targeted test passed, 7/7.
- Full suite passed: `npm test -- --test-reporter=spec`, 1540/1540 tests passed.
- Syntax and whitespace checks passed: `node --check studies/naive-art/v049/sketch.js`, `node --check studies/naive-art/v049/engine.mjs`, `git diff --check`.
- Local headless browser matrix: 30/30 runs passed with system Chrome via Playwright at `320x568`, `390x844`, `768x1024`, `1280x800`, `1920x1080`, normal and reduced-motion.
- Browser evidence: target `innerWidth`, `clientWidth`, and `scrollWidth` matched at every run; no horizontal overflow, diagnostics, or first-party bad responses; 44px controls observed.
- Interaction evidence: real zigzag pointer path committed one fold; keyboard Enter committed; Delete lifted exactly; four deterministic folds compounded; blind preview retained four folds and twelve cells; Escape released memory.
- Canonical readback: local canonical route rendered the data-driven work mount and eager tableau iframe at every viewport/motion mode.

## Critique and status

- Accepted critique: this is a medium/encounter switch with a distinct causal rule, not a palette or density variation.
- Unresolved doubt: no independent caption-free perceptual reviewer is available in this run. The work remains `candidate / held`; it is not called exhibition-ready.
- Provider/deployment evidence: auth one-shot returned `AUTH_OK`; commit `71bbed914c518c88d97df188db429cabc9b4c24d` matches `origin/main`; Vercel deployment `dpl_FmDkHYDVHchQ7AYkCxXdj2URw1eb` is `READY` at `https://autopoiesis-nine.vercel.app`; production readback found the record in `/studio/data/works.json`, the Journal anchor/title, and the canonical tableau across 20 headless browser runs (all passed). Provider revision linkage remains unresolved because this was a manual local-worktree deployment rather than an explicit Git-linked provider record.
