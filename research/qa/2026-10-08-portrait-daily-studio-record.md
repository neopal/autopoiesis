# Mutine daily studio record — 2026-10-08 / Self portrait v024

## Candidate

- **Current:** Self portrait (`portrait`)
- **Work:** *The portrait cannot hold a straight line.*
- **Status:** `candidate / held`
- **Raw tableau:** `/studies/self-portrait/v024/`
- **Canonical work:** `/works/portrait-2026-10-08/`
- **Journal anchor:** `journal-portrait-2026-10-08`

## Changed rule

The last three Self portrait works were a binary atlas (v022), a single observed Canvas solid (v023), and the preceding orbit/approach family. v024 makes a medium and encounter rupture: it replaces the filled object with one browser-native SVG membrane of nine irregular nested contours around a central absence.

The visitor draws a stroke and releases. The stroke is measured, not painted back. The membrane's own resistance chooses which contour ruptures; the remaining strain is relayed to a non-local contour. The bounded four-event strain field alters the next resistance calculation. A short stroke is refused, Delete reconstructs the exact previous membrane, and R releases the memory.

## Cultural translation

- **Reference:** [p5.brush](https://github.com/acamposuribe/p5.brush)
- **Observed mechanism:** programmable pressure modes, directional fields, custom brushes, and drawing state participate in producing geometry rather than decorating finished geometry.
- **Mutine translation:** refuse brushes, watercolor, hatching, palette, examples, and API surface. Translate material agency into a self-measuring SVG membrane: a visitor stroke supplies strain, the portrait's internal resistance selects the rupture, and a non-local ring receives the relay.
- **Visible consequence:** the blind field is nine irregular nested SVG contours around a central absence. A committed stroke opens a real contour gap, changes that contour's geometry, and changes a non-local relay ring; later strokes inherit the changed field.
- **Falsifier:** if the stroke is only an overlay, if pointer location directly selects the ring, if the relay is fixed/cosmetic, if later strokes forget prior strain, or if the blind view reads as another object/atlas/relief/route bundle/generic linefield, the translation fails.
- **Anti-copy:** no p5.brush brushes, watercolor appearance, hatching vocabulary, source palette, composition, examples, or API surface is reproduced.
- **Direction consequence:** closes the direct-target and unseen-face sequence; opens a self-measuring material-agency direction in which the code chooses where a visitor-supplied vector becomes visible.

## Local evidence

- Slot helper: `current_id=portrait`, `current_index=2/6`, `culture_reference_id=p5-brush`, `existing_work_id=none`, `action=create-and-record`.
- Targeted TDD slice: **6 passed, 0 failed**.
- Full suite: **744 passed, 0 failed**.
- JavaScript syntax checks: `engine.mjs`, `sketch.js`, and `scripts/portrait-v024-probe.mjs` passed `node --check`.
- JSON validation: `works.json`, `catalog-public.json`, `metrics.json`, and `critiques.json` parsed successfully.
- `git diff --check`: passed; only existing LF/CRLF normalization warnings were emitted.
- Headless local browser matrix: **20/20 passed** on raw and canonical routes at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced motion.
- Local diagnostics: **0** console messages, page errors, failed requests, or HTTP `400+` responses.
- Local overflow: **0** failures; all runs kept `innerWidth = clientWidth = scrollWidth`.
- Interaction: Enter committed memory `0 → 1`; Delete restored the exact baseline signature; pointer stroke committed a resistance-selected rupture and non-local relay; lift restored baseline; strain control committed; release returned memory to `0`.
- Touch evidence: all three controls measured **44px** high at `390×844`.
- Blind preview: local reduced-motion static preview kept the SVG membrane visible while readout, controls, hint, and editorial furniture were hidden.
- Local readbacks: Journal anchor/title, Self portrait current card/title, canonical work/title/tableau, and local public catalog resolved once.
- Proofs: **25 PNG captures plus `local-results.json`** in `research/qa/proofs/portrait-v024-2026-10-08/`.

## Publication state

- **Git source commit deployed:** `49efd9dc9a552b0899a07771fd5c8c8fd26d4b87`.
- **Remote `origin/main`:** matched `49efd9dc9a552b0899a07771fd5c8c8fd26d4b87` before deployment.
- **Vercel deployment:** `dpl_3ZUFRWkNXBQYUMHAqPX6SxJudL1s`, `READY`.
- **Stable alias:** https://autopoiesis-nine.vercel.app/
- **Production browser matrix:** **20/20 passed** on raw and canonical routes at all five required viewports in normal and reduced-motion modes.
- **Production diagnostics:** **0** console messages, page errors, failed requests, or HTTP `400+` responses.
- **Production interaction:** Enter committed memory `0 → 1`; Delete restored the exact baseline membrane signature; pointer stroke committed a resistance-selected rupture and non-local relay; lift restored baseline; strain control committed; release returned memory to `0`; all three controls measured `44px` high.
- **Production blind preview:** the settled SVG membrane remained visible while readout, controls, hint, and editorial furniture were hidden; no overflow.
- **Production readbacks:** `/studio/data/works.json` and `/studio/data/catalog-public.json` returned HTTP `200` with exactly one `portrait-2026-10-08` record; `/journal/`, `/currents/self-portrait/`, and `/works/portrait-2026-10-08/` rendered the title/tableau in headless Chromium; `/studio/favicon.svg` returned HTTP `200 image/svg+xml`.
- **Production proofs:** **25 PNG captures plus `production-results.json`** in `research/qa/proofs/portrait-v024-2026-10-08-production/`.

## Unresolved doubt

The work remains **candidate / held**, not exhibition-ready, pending:

1. independent caption-free perceptual comparison with labels, readout, controls, hint, annotations, and prose hidden;
2. provider revision linkage between the Vercel deployment and GitHub SHA. `vercel inspect` confirmed Ready state and the stable aliases but returned no Git revision field.

The final evidence commit may follow the deployed release commit; Git and Vercel provenance remain separate claims.
