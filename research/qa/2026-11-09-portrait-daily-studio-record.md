# MUTINE — Self portrait v046 local daily studio record

- Target: Self portrait (`current_id=portrait`, `current_index=2/6`)
- Date: 2026-11-09
- Work: *The portrait leaves its margins.*
- Status: `candidate / held`
- Raw tableau: `/studies/self-portrait/v046/`
- Canonical record: `/works/portrait-2026-11-09/`

## Direction

v046 is a declared medium and encounter switch from the last three real portrait records: v045's faceted WebGL loop/compiler, v044's horizontal Canvas refusal spine, and v042's Canvas absence ledger. Their repeated gesture was a spatial site or object receiving a thresholded visitor action and producing non-local geometry. v046 abandons that field/object grammar for a browser-native typesetting object.

- Changed rule: pressure is not pigment on a finished page. Three distinct marginal claims can rewrite the page's own measure, margin, line gap, phase, and reading direction; the order of claims becomes part of the production rule.
- Visible consequence: the blind view begins as one quiet typeset manuscript. A valid three-word pressure sequence reflows every word, changes the page's measure and margin, and can turn its reading direction. Four revisions compound and remain liftable.
- Falsifier: reject if a local word changes before compilation, if shallow or repeated marks commit, if mark order changes only a label, if later lineations reset, if the page only recolours, or if lifting is inexact.
- Deletion condition: delete v046 if caption-free viewing cannot distinguish a self-rewriting typesetting object from a styled web page or if the page's visible grammar does not change through the encounter.

## Cultural translation

- Reference: [p5.brush](https://github.com/acamposuribe/p5.brush)
- Observed mechanism: a programmable material engine treats pressure, density, directional behaviour, and vector fields as production rules that change how geometry is generated rather than decorating a finished mark. The repository README was inspected on 2026-11-09.
- Mutine translation: refuse brush presets, watercolor appearance, hatching vocabulary, grain treatment, source palette, source composition, source code, examples, and API surface. Translate material agency into typesetting: three distinct pressure marks become line-break claims, and only their compiled order rewrites the manuscript's measure, margin, phase, and reading direction.
- Anti-copy: no brush preset, watercolor, hatching, grain, source palette, source composition, source code, examples, API surface, or source imagery is reproduced.
- Direction consequence: closes the portrait's faceted-loop and pressure-field period and opens self-typesetting: code portrays its decisions by changing the grammar that determines how its own language can fit.

## TDD and local evidence

- RED observed: `node --test tests/portrait-v046.test.mjs` failed before `studies/self-portrait/v046/engine.mjs` existed with the expected `ERR_MODULE_NOT_FOUND`.
- Targeted test: `node --test tests/portrait-v046.test.mjs` — **8 passed, 0 failed**.
- Full suite: `npm test` — **1491 passed, 0 failed**.
- Syntax: `node --check` passed for `engine.mjs`, `sketch.js`, `tests/portrait-v046.test.mjs`, and `scripts/portrait-v046-probe.mjs`.
- Diff hygiene: `git diff --check` passed (only line-ending warnings for tracked JSON).
- Browser runner: headless system Chrome via Playwright using `C:/Program Files/Google/Chrome/Application/chrome.exe`.
- Local matrix: **20/20 passed** across raw preview and canonical work at `320x568`, `390x844`, `768x1024`, `1280x800`, and `1920x1080`, normal and reduced-motion.
- Local diagnostics: **0** console errors, page errors, failed requests, or bad responses.
- Local horizontal overflow: **0**; every target width valid; manuscript and p5 field visible; minimum tested control target `44px`.
- Interaction: three distinct word marks held without changing geometry; repeated mark refused; compile changed the document; Delete lifted exactly; keyboard marking committed an equivalent rewrite; Escape released; four deterministic rewrites compounded.
- Local blind preview: reduced-motion static preview retained four lineation rewrites at `390x844` while hiding readout, controls, hint, and margin furniture; `innerWidth/clientWidth/scrollWidth = 390/390/390`.
- Local proof bundle: `research/qa/proofs/portrait-v046-2026-11-09-local/`
- Production matrix: **20/20 passed** on `https://autopoiesis-nine.vercel.app` across raw preview and canonical work at `320x568`, `390x844`, `768x1024`, `1280x800`, and `1920x1080`, normal and reduced-motion.
- Production diagnostics: **0** console errors, page errors, failed requests, or bad responses.
- Production horizontal overflow: **0**; every target width valid; manuscript and p5 field visible; minimum tested control target `44px`.
- Production interaction: stable alias passed pointer marks, repeat refusal, compile, Delete lift, keyboard commit, Escape release, and four-compound rewrite.
- Production blind preview: stable alias retained four lineation rewrites at `390x844` while hiding readout, controls, hint, and margin furniture.
- Production readback: `works.json`, `catalog-public.json`, canonical work, raw tableau, Journal anchor/title, and favicon returned `200`; the rendered Journal entry was visible.
- Deployment: `https://autopoiesis-gl36gh2ao-lairpa-hotmailfrs-projects.vercel.app`, ID `dpl_5MhGE1frWtmeZAKozdm8jDZd1MAW`, source commit `17bea4a`.
- Production proof bundle: `research/qa/proofs/portrait-v046-2026-11-09-production/`

## Held evidence

The candidate remains held pending an independent caption-free perceptual review and provider-side linkage between the final Vercel deployment and GitHub SHA. The unresolved perceptual question is whether the blind page reads as a self-rewriting typesetting object rather than a styled web page or poster.

The pre-existing untracked `research/qa/2026-11-08-daily-studio-record.md` was not modified.
