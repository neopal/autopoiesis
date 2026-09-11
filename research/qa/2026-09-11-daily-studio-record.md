# Daily studio record — 2026-09-11

## Scope and decision

Run completed in `C:/Users/ASUS/autopoiesis` for the scheduled target current
`brush` and local date `2026-09-11`. The target slot was empty at dispatch, so
one new candidate was created. No missed historical day was invented.

The catalogue remains explicit and factual: `studio/data/studio.json` is the
`mutine-studio/v2` register with six currents; `studio/data/works.json` is the
`mutine-works/v1` register with 43 daily records. Current/date keys remain
unique. Today's records are Handwriting, Self portrait, and Brush; Pure SVG,
Naive art, and dormant WebGPU remain unrecorded for today.

The Brush candidate remains **candidate / held**. Source, local browser, and
stable-alias browser gates are green; independent caption-free perceptual review
and provider revision linkage remain unresolved. No claim of exhibition-ready
status is made.

## Artwork record

- **Current/date:** Brush / `2026-09-11`
- **Work id:** `brush-2026-09-11`
- **Title:** *The brush settles the braid.*
- **Raw tableau:** `/studies/p5-brush/v009/`
- **Canonical work:** `/works/brush-2026-09-11/`
- **Lineage:** `brush-2026-09-10` → v009
- **Changed rule:** a remembered removal becomes a braid gate; nearby wet
  routes split in opposite directions around it, then settle into one
  downstream deposit where route width and pigment density accumulate.
- **Interaction:** pointer, `Enter`, and `Space` create a bounded gate;
  `lift latest` recomputes the exact preceding field; `release sequence`
  clears visitor memory and restarts the autonomous sequence.
- **Falsifier:** if routes do not divide, settle into a common downstream
  deposit, and carry that deposit in their own geometry, the rule is only a
  diagram.
- **Deletion condition:** delete the split-settle rule if the caption-free
  blind comparison cannot locate the repeated divide and common deposit in the
  strokes themselves.

## Source and engine evidence

- v009 contains `engine.mjs`, `sketch.js`, `index.html`, `style.css`,
  `README.md`, `metrics.json`, and `critiques.json`.
- Seed/state is deterministic: `0x42525539`, 13 stages, 10 strokes per
  stage, 68 points per stroke, bounded memory window 8.
- Targeted RED was observed before implementation: the new v009 tests failed
  with the expected missing-module/missing-tableau errors.
- Targeted GREEN passed: all seven Brush v009 tests pass.
- The full automated suite passed: **229/229 tests, 0 failed, 0 skipped, 0
  todo**.
- `node --check` passed for the changed v009 engine, sketch, and saved browser
  probe.
- `git diff --check` was run after the artifact edits and was clean.

## Local headless browser evidence

Probe: `research/qa/proofs/brush-v009-2026-09-11/probe.mjs`.
Results: `research/qa/proofs/brush-v009-2026-09-11/results.json` plus 12 PNG
captures.

- Canonical route returned HTTP 200 and rendered the embedded tableau before
  generated title, journal, critique, evidence, and neighbouring-work prose.
- **10/10** canonical runs passed at `320x568`, `390x844`, `768x1024`,
  `1280x800`, and `1920x1080`, in normal and reduced-motion contexts.
- Every canonical run had `innerWidth == clientWidth == scrollWidth`; no
  horizontal overflow was observed.
- Initial console, page-error, request-failure, and HTTP 400+ arrays were empty
  for all canonical, raw interactive, and blind runs.
- Raw interactive 390x844 route returned HTTP 200; all three controls measured
  44px high. Pointer changed memory `0 → 1`, Enter changed `1 → 2`, lifting
  returned `2 → 1` and reproduced the exact prior canvas data URL, and release
  returned memory to `0`.
- Raw blind 390x844 route returned HTTP 200 with canvas `390x844`, controls,
  readout, and editorial opening hidden; it had no horizontal overflow.

## Deployment boundary

The requested Vercel CLI production deploy was attempted twice and blocked: the
configured scope was inaccessible, then the local CLI reported no credentials.
The stable alias nevertheless served the pushed catalogue content and was
verified independently at `https://autopoiesis-nine.vercel.app`:

- `/studio/data/works.json` returned HTTP 200 and contained the Brush record,
  title, raw path, and Journal anchor.
- `/works/brush-2026-09-11/` returned HTTP 200; production Playwright rendered
  the tableau before prose across the full ten-run viewport/motion matrix.
- `/journal/` returned HTTP 200 and contained exactly one
  `#journal-brush-2026-09-11` entry with the title and canonical work href.
- `/studies/p5-brush/v009/?preview=1&interaction=1` returned HTTP 200 and
  passed the same pointer/keyboard/lift/release interaction evidence.
- `/favicon.ico` returned HTTP 200.

Stable-alias content is observed, but no provider revision linking it to
GitHub SHA `086aa2d6a7e08dcd6cee0f299a12d420d59dcc1e` was reported by the
blocked CLI. Do not collapse that provenance boundary.

## Files changed for this run

- `studies/p5-brush/v009/` — new tableau and art-gate record.
- `works/brush-2026-09-11/index.html` — canonical daily route.
- `studio/data/works.json` — one new factual daily record.
- `tests/brush-v009.test.mjs` — test-first behavior coverage.
- `tests/catalog-architecture.test.mjs`, `tests/daily-catalog.test.mjs`,
  `tests/evolution-catalog.test.mjs` — expected register totals and ordering
  updated for the new record.
- `research/qa/proofs/brush-v009-2026-09-11/` — local and stable-alias
  browser results, probes, and 25 PNG captures.

## Archive decision

Keep `brush-2026-09-11` in the archive as an honest **candidate / held** record.
The artifact is real, deterministic, structurally interactive, tested, and
locally read back across the required viewport matrix. Do not promote it until
an independent caption-free perceptual comparison and production verification
are recorded.
