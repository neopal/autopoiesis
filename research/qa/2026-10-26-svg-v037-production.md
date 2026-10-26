# Mutine production verification — Pure SVG v037 — 2026-10-26

- Stable production alias: https://autopoiesis-nine.vercel.app
- Deployment observed: `dpl_3NxyU2bevAwsetEcf7oaR2j6Km6S`
- Deployment URL: https://autopoiesis-ef5t8g5nj-lairpa-hotmailfrs-projects.vercel.app
- Target work: https://autopoiesis-nine.vercel.app/works/svg-2026-10-26/
- Raw tableau: https://autopoiesis-nine.vercel.app/studies/pure-svg/v037/?preview=1&interaction=1
- Blind preview: https://autopoiesis-nine.vercel.app/studies/pure-svg/v037/?preview=1&static=1&blind=1
- Journal anchor: https://autopoiesis-nine.vercel.app/journal/#journal-svg-2026-10-26

## Observed production evidence

- Headless Playwright matrix: 20/20 raw/canonical runs passed at 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.
- Diagnostics: 0 console messages, page errors, failed requests, or HTTP 400+ responses.
- Overflow: 0 document overflow failures.
- Interaction: a real production proximity tour changed geometry on release; Delete restored the exact prior field; Enter committed the deterministic equivalent; R released; a one-cell tour refused; controls were 44px high at 390×844.
- Blind preview: 11 cells and four settled vacancies remained visible while readout, controls, and annotations were hidden; `innerWidth/clientWidth/scrollWidth = 390/390/390`.
- Readbacks: Journal, Pure SVG current, canonical work, raw tableau, deployed `works.json`, deployed `catalog-public.json`, and favicon all returned/rendered; the registry and catalog each contained exactly one matching `svg-2026-10-26` record.
- Proof bundle: `research/qa/proofs/pure-svg-v037-2026-10-26-production-final/`.

## Boundary

This proves the named production URL and content were observed. It does not prove independent caption-free perceptual approval or provider revision linkage between this Vercel deployment and the GitHub SHA. The work remains `candidate / held`.
