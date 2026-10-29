# MUTINE daily studio record — 2026-10-29

## Slot

- **Current:** typography / Handwriting
- **Work:** *The line learns where to break.*
- **Version:** `v037`
- **Status:** `candidate / held`
- **Raw tableau:** `/studies/handwriting/v037/`
- **Canonical work:** `/works/typography-2026-10-29/`
- **Journal anchor:** `journal-typography-2026-10-29`

## Artistic direction

- **Last three repeated grammar to break:** v036's distributed phoneme ecology, v035's depth-staggered letter molds, and v034's two-register field all treated language as multiple situated units. Their interaction either attended, held a source, or left a witness; the strongest consequence was repeatedly displaced into a remote or neighboring unit.
- **Primary rupture:** change representation and encounter from a population/rack/register to one continuous inline SVG sentence. A pressure sweep is geometry-neutral while held; release makes the sentence's own local weak hinge break rather than sending an answer elsewhere.
- **Changed rule:** a complete sweep cuts the folded sentence at a material hinge: one glyph opens, another hollows, and a third drifts. Four cuts remain liftable and later pressure inherits the broken seam.
- **Blind visible consequence:** a single carrier sentence of 32 glyphs crosses a dark field as one folded line. No labels or readout are required for the produced cut, hollow letter, drift, and seam scar to exist.
- **Falsifier:** delete if holding changes glyph geometry, if the input point is merely selected, if the cut is only colour/readout/prose, if the blind field reads as a generic type specimen or decorative SVG, if later cuts reset, or if exact lifting fails.
- **Deletion condition:** delete v037 if caption-free viewing cannot distinguish the local pressure-seam grammar from the last three Handwriting works or if the weak hinge is not materially produced.

## Cultural translation

- **Reference:** [p5.brush](https://github.com/acamposuribe/p5.brush)
- **Observed mechanism:** programmable pressure, density, and directional fields participate in producing geometry rather than styling a finished mark.
- **Mutine translation:** refuse brush appearance, watercolor, hatching, grain, source palette, composition, code, examples, and API surface. Translate pressure production into a sentence seam: a held sweep stores force and direction, then release produces a cut, a hollow, and a drift at the line's own weak hinge.
- **Direction consequence:** closes the Handwriting ecology / casting-rack / double-register family and opens sentence-as-material; no remote receiver is needed for the next break.

## Artifact and evidence

- `studies/handwriting/v037/index.html`
- `studies/handwriting/v037/sketch.js`
- `studies/handwriting/v037/engine.mjs`
- `studies/handwriting/v037/style.css`
- `studies/handwriting/v037/README.md`
- `studies/handwriting/v037/metrics.json`
- `studies/handwriting/v037/critiques.json`
- `works/typography-2026-10-29/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/handwriting-v037.test.mjs`
- `scripts/handwriting-v037-probe.mjs`
- `research/qa/proofs/handwriting-v037-2026-10-29/`

## Local gate

- Targeted tests: **4/4 passed**
- Full suite: **1165/1165 passed**
- JavaScript syntax checks: passed
- `git diff --check`: passed
- Browser matrix: **20/20 local runs passed**
- Viewports: `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`
- Modes: normal and reduced motion
- Local diagnostics: **0**
- Overflow failures: **0**; `innerWidth/clientWidth/scrollWidth` stayed equal in the blind `390×844` run
- Minimum touch target: **44px**
- Pointer path: held sweep left the glyph signature exact, release produced a cut/hollow/drift event, Delete restored the exact sentence
- Keyboard path: ArrowRight + Enter committed an equivalent deterministic pressure event
- Release path: control returned to the quiet seed
- Blind preview: inline SVG sentence visible with 32 glyphs and four settled cuts; controls, readout, note, and hint hidden
- Readbacks: local works registry, public catalog, Journal anchor/title, Handwriting current/card, canonical work/tableau, raw tableau, and favicon passed

## Honest boundary

The work remains **candidate / held**. Production browser verification, independent caption-free perceptual review, and provider revision linkage are not yet observed. No claim of exhibition readiness is made.
