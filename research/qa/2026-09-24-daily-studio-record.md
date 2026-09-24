# Mutine daily studio record — 2026-09-24

## Target

- Current: Self portrait (`portrait`)
- Work: `portrait-2026-09-24`
- Study: `studies/self-portrait/v015/`
- Title: *The portrait resists pressure.*
- Status: **candidate / held**
- Observed at: `2026-09-24 04:53:19 +0200`

## Artistic gate

### Repeated grammar refused

The last three Self portrait works used a reciprocal, route-based grammar: a visitor look became a bounded relation among face parts or discrete portrait plates. The repeated gesture was look → answer → reversible vacancy, with memory carried by modular face geometry or route relationships.

### Structural rupture

v015 abandons the plate mosaic and reciprocal witness roles. It presents one continuous pressure-bearing membrane. A press dents the membrane, opens a real gap, separates two banks, and lifts a detached flap. The scarred neighbourhood stores resistance, so a later press at the same region meets a changed material law.

This changes representation (modular plates → one membrane), encounter (looking → pressing), temporal behaviour (witness relation → accumulated resistance), and visible grammar (route/plate field → material rupture). It is not a palette, texture, density, or label variation.

### Blind falsifier

Hide the readout, controls, fibres, annotations, and prose. The direction fails if the viewer sees an oval with decorative scratches rather than one body that yields, tears, resists, and displaces a fragment; or if repeated pressure behaves as if the first pressure never happened.

### Deletion condition

Delete v015 if the gap is only a colour or destination-out sticker over unchanged geometry, if the flap is only a coloured witness, or if resistance does not change the next pressure event.

## Cultural translation

- Reference: `p5-brush` — https://github.com/acamposuribe/p5.brush
- Observed mechanism: material is implemented as a programmable field of pressure, density, grain, and directional behaviour; it changes how geometry is produced, not only how geometry is coloured.
- Mutine translation: pressure becomes a resistance field inside one continuous self-image. A press yields an opening and detached flap; the local resistance map changes the next yield.
- Visible consequence: the first-render field is a single body rather than a plate grid; interaction produces a real rupture and a changed repeated response.
- Refused vocabulary: p5.brush brushes, watercolor appearance, hatching, palette, composition, API surface, and source code/assets.
- Direction consequence: close the v013–v014 reciprocal plate/route grammar and open a material-agency direction for Self portrait.

## Files

- `studies/self-portrait/v015/index.html`
- `studies/self-portrait/v015/engine.mjs`
- `studies/self-portrait/v015/sketch.js`
- `studies/self-portrait/v015/style.css`
- `studies/self-portrait/v015/README.md`
- `studies/self-portrait/v015/metrics.json`
- `studies/self-portrait/v015/critiques.json`
- `works/portrait-2026-09-24/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/portrait-v015.test.mjs`
- Updated count/date/catalog assertions in `tests/catalog-architecture.test.mjs`, `tests/daily-catalog.test.mjs`, and `tests/evolution-catalog.test.mjs`
- `research/qa/proofs/portrait-v015-2026-09-24/` including local results, catalog readback, and `production-render-probe.mjs` / `production-render-results.json`

## Verification

- TDD RED observed first: the new browser-evidence assertion failed because the record still said browser evidence was pending.
- TDD GREEN: targeted v015 tests **7 passed** after recording the observed local matrix.
- Full suite: **471 passed, 0 failed, 0 skipped, 0 todo**.
- `node --check` passed for changed study JavaScript, targeted test, tableau probes, and production render probe.
- `git diff --check`: **PASS**.
- Local tableau browser matrix: **10/10 runs passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced-motion.
- Local raw tableau matrix: **10/10 runs passed** at the same five viewports and motion modes.
- Local diagnostics: zero console messages, page errors, failed requests, or HTTP 400+ responses in tableau and catalog probes.
- Local interaction: pointer pressure, Enter, Space, lift latest scar, and release pressure were exercised; lifting restored the exact preceding membrane.
- Local catalog readback at `390×844`: Journal contained exactly `#journal-portrait-2026-09-24` with the recorded title; Self portrait current showed the current header and first work card; `innerWidth == clientWidth == scrollWidth == 390`.

## Production verification

- Commit: `65539a03a78363765ca2bddf1496a905a0409e6b`
- GitHub `origin/main`: matched the local commit SHA.
- Vercel deployment: `dpl_7qken6cCmRihVEDA6yFo2aq6r7VW`, stable alias `https://autopoiesis-nine.vercel.app/`.
- Stable-alias browser matrix: **10/10 canonical + 10/10 raw runs passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced motion.
- Stable-alias diagnostics: zero console messages, page errors, failed requests, or HTTP 400+ responses in tableau and catalog probes.
- Stable-alias rendered Journal: exactly one `#journal-portrait-2026-09-24` entry with title *The portrait resists pressure.*
- Stable-alias Self portrait current: header `Self portrait` and first work `The portrait resists pressure.` observed at `390×844` with no horizontal overflow.
- Stable-alias register: exactly one `portrait-2026-09-24` record with the expected raw path and title.
- Canonical work, raw tableau, and favicon returned HTTP 200.

## Unresolved doubt

No independent caption-free perceptual reviewer is available in this unattended run. Structural, local browser, production browser, Journal/current, register, and route evidence are complete, but provider-revision linkage from the stable alias to the GitHub SHA and the blind perceptual comparison remain unresolved. The work therefore remains honestly **candidate / held**, not exhibition-ready.
