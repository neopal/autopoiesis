# Mutine — typography v027 daily studio record

- **Target:** Handwriting / `typography` / `2026-10-13`
- **Work:** *The space takes the weight.*
- **Status:** `candidate / held`
- **Raw study:** `/studies/handwriting/v027/`
- **Canonical work:** `/works/typography-2026-10-13/`
- **Journal anchor:** `journal-typography-2026-10-13`

## Artistic change

v027 breaks the last three typography gestures: v024's direct point pressure on an elastic sentence, v025's literal character offer to a distributed refusal plate, and v026's approach-and-withdraw route rack. Eight oversized word-bands form one stacked typographic pressure loom. A short hold is refused. A sustained global hold followed by release compresses one word's actual tracking/scale/slant/weight and transfers space to a non-local word; later pressure inherits the changed loom. Four events remain in bounded memory and lifting is exact.

## Cultural translation

- **Reference:** [p5.brush](https://github.com/acamposuribe/p5.brush)
- **Observed mechanism:** programmable pressure and density participate in producing geometry rather than decorating finished geometry.
- **Mutine translation:** refuse brushes, watercolor, hatching, palette, examples, and API surface; make duration itself the material force in typography. A global hold tightens one word and gives the displaced room to another word.
- **Visible consequence:** actual word spacing, scale, slant, weight, and nearby baselines change; the event is not a cursor mark or colour-only effect.
- **Falsifier:** if duration has no geometric consequence, if the relief is cosmetic/local, if short pressure commits, if later holds restart from baseline, or if the blind field reads as another route/plate, delete the trial.
- **Direction consequence:** closes the sentence / clause / routed-letter sequence and opens pressure-as-whitespace as a new handwriting grammar.

## Evidence

- TDD red observed: the first engine test failed with the expected missing `studies/handwriting/v027/engine.mjs`; the structure test then failed with the expected missing tableau files.
- Targeted engine tests: **3 passed, 0 failed**.
- Targeted structure/record tests: **2 passed, 0 failed**.
- Full `npm run test`: **822 passed, 0 failed**.
- JavaScript syntax: `node --check` passed for `engine.mjs` and `sketch.js`.
- Local headless browser matrix: **20/20 passed** across `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`, raw/canonical, normal/reduced motion.
- Local interaction: short `140ms` hold refused; deterministic button committed; Enter committed; Delete/lift restored the exact signature; R/release returned baseline; all three controls measured `44px`.
- Local blind preview: Canvas remained visible while controls/readout/hint were hidden; `innerWidth = clientWidth = scrollWidth = 390`.
- Local diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses.
- Local readbacks: Journal anchor, Handwriting current card, and canonical work mount rendered.
- Proof captures: **25 PNGs** in `research/qa/proofs/handwriting-v027-2026-10-13/` plus `results.json`.

## Publication boundary

- Commit: `b5a49ed2e1485f26c5e7f1a11d9a1c88c0f8dabb`.
- `origin/main`: matches the commit.
- Production deployment: `dpl_4FF9QAs8AmgDnsrCwojNBBNRTvvN`; stable alias: `https://autopoiesis-nine.vercel.app`.
- Production headless browser matrix: **20/20 passed** across `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`, raw/canonical, normal/reduced motion.
- Production interaction/readbacks: short hold refused; button/Enter commit; Delete/lift exact; R/release baseline; Journal/current/canonical work rendered; production `works.json` and `catalog-public.json` each contain exactly one target record among 166 works; favicon returned HTTP 200.
- Production diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses.

The candidate stays held. Independent caption-free perceptual comparison and provider-level deployment-to-Git-SHA linkage remain unresolved; no claim of exhibition readiness is made.
