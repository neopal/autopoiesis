# Mutine daily studio record — Naive art v050 — 2026-11-11

## Slot and concept

- Target slot: `current_id=naive`, `current_index=5/6`, `existing_work_id=none`, `action=create-and-record`.
- Cultural reference selected by the slot helper: `little-critters` — [little-critters](https://github.com/GordenSun/little-critters).
- Observed mechanism: situated code-drawn agents make pointer proximity legible as reciprocal attention without a dashboard.
- Mutine translation: refuse animals, eyes, characters, paper, head-turning, and source surface vocabulary. Translate reciprocity into a naive model that records three distinct attended words, then returns a false answer to a station outside the record.
- Structural rupture: v049's SVG pressure topology, v048's reciprocal witness field, and v047's proof strip become browser-native DOM words dispersed as a broken sentence. The viewer approaches and releases rooms rather than pushing a field, selecting a witness, or crossing a ledger.
- Visible consequence: after three distinct attentions, every word reflows and one unobserved station becomes an italic false answer. Four misattributions compound and remain liftable.
- Falsifier: delete if proximity is only a highlight, repeated rooms commit, the false answer lands in an attended station, only a local word changes, order is cosmetic, memory resets, or exact lifting fails.
- Deletion condition: delete if the blind view reads as a generic word grid/interface or cannot be distinguished from v047–v049 without captions.

## Files

- Tableau: `studies/naive-art/v050/index.html`
- Engine: `studies/naive-art/v050/engine.mjs`
- Runtime: `studies/naive-art/v050/sketch.js`
- Styling: `studies/naive-art/v050/style.css`
- Art record: `studies/naive-art/v050/README.md`
- Metrics: `studies/naive-art/v050/metrics.json`
- Critiques: `studies/naive-art/v050/critiques.json`
- Canonical route: `works/naive-2026-11-11/index.html`
- Register: `studio/data/works.json`
- Public catalog: `studio/data/catalog-public.json`
- Proof screenshots: `research/qa/proofs/naive-v050-2026-11-11-local/` and `research/qa/proofs/naive-v050-2026-11-11-production/`

## Evidence completed

- TDD RED observed: `node --test tests/naive-art-v050.test.mjs` initially failed because `v050/engine.mjs` did not exist.
- TDD GREEN observed: targeted test passed, 7/7.
- Full suite passed: `npm test -- --test-reporter=spec`, 1573/1573 tests passed.
- Syntax and whitespace checks passed: `node --check studies/naive-art/v050/sketch.js`, `node --check studies/naive-art/v050/engine.mjs`, `git diff --check`.
- Local headless browser matrix: 20/20 runs passed with system Chrome via Playwright at `320x568`, `390x844`, `768x1024`, `1280x800`, `1920x1080`, normal and reduced-motion across raw and canonical routes.
- Browser evidence: target `innerWidth`, `clientWidth`, and `scrollWidth` matched at every run; no horizontal overflow, diagnostics, or first-party bad responses; 44px controls observed; raw tableau was first on canonical work routes.
- Interaction evidence: real pointer approach-and-release across three distinct words committed one misattribution; repeated attention was refused; keyboard Enter committed; four deterministic attention trios compounded; Delete lifted exactly; release emptied memory; blind preview retained four misattributions and nine DOM words.
- Local readback: `/studio/data/works.json` and `/studio/data/catalog-public.json` each contained exactly one `naive-2026-11-11` record; rendered Journal anchor/title, Naive current title, canonical work, raw v050 tableau, and favicon returned 200.
- Production headless browser matrix: 20/20 stable-alias runs passed at the same five viewports and two motion modes; target widths, no overflow, 44px controls, no diagnostics or bad responses, pointer/keyboard/lift/release/blind checks all passed.
- Production readback: stable alias `https://autopoiesis-nine.vercel.app` returned 200 for the source/public JSON, Journal, Naive current, canonical work, raw v050 tableau, and favicon; source/public JSON each contained exactly one record and rendered Journal/current/work contained the title.
- Proof artifacts: `research/qa/proofs/naive-v050-2026-11-11-local/` and `research/qa/proofs/naive-v050-2026-11-11-production/`.

## Critique and status

- Accepted critique: this is a medium/encounter switch with a distinct absent-station causal rule, not a palette or density variation.
- Unresolved doubt: no independent caption-free perceptual reviewer is available in this run. The work remains `candidate / held`; it is not called exhibition-ready.
- Provider/deployment evidence: Git synchronization, Vercel deployment, and rendered production readbacks remain separate claims and are recorded only after each is observed.
