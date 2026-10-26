# Mutine — Brush v038 production evidence record

- **Target:** `brush` / `2026-10-26`
- **Work:** *The paint opens between layers.*
- **Status:** `candidate / held`
- **Stable production:** https://autopoiesis-nine.vercel.app
- **Deployment:** `dpl_C9c5j43vk5tDhuyGx5tMADuEz2qn` (`READY`)
- **Git source:** `77d244153ad07c2d602a75f41888a3e228a2d0f1`

## Production browser evidence

- Headless system Chrome via Playwright ran the raw tableau and canonical work at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, in normal and reduced-motion modes: **20/20 passed**.
- Every run returned HTTP 200, matched the emulated `innerWidth`, had no horizontal overflow, rendered nine laminae, rendered no canvas, and reported zero console/page/request/http diagnostics.
- The production interaction run confirmed: first seam selection left geometry exact; a second non-adjacent seam committed one pressure span; adjacent seams refused; Delete restored the exact baseline; Enter committed the deterministic pair; Escape released; seam nodes and controls met the 44px target.
- The production blind preview kept nine laminae and four settled pressure spans visible while hiding seam nodes, readout, controls, and hint.
- Rendered production Journal contained `journal-brush-2026-10-26` and *The paint opens between layers.*.
- Production source registry and public catalog each contained exactly one `brush-2026-10-26` record. The canonical work, raw tableau, and `/studio/favicon.svg` each returned HTTP 200.
- Proof bundle: `research/qa/proofs/brush-v038-2026-10-26-production/` (`21` screenshots plus `qa-summary.json`).

## Publication boundary

The artifact is published and technically verified, but remains held. Independent caption-free perceptual review and provider revision linkage between the Vercel deployment and GitHub SHA remain unresolved. `productionReady` remains `false`; this report does not call the work exhibition-ready.
