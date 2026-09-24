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

---

# Scheduled archive audit — 2026-09-24

- Audit root: `C:/Users/ASUS/autopoiesis`.
- Observed at: `2026-09-24 09:02:34 +0200` local host time.
- Active catalogue sources read: `studio/data/studio.json` (`mutine-studio/v2`) and `studio/data/works.json` (`mutine-works/v1`) only.
- Field tests and stimuli remained separate from the daily work register.
- No browser automation, GUI/CUA, Chrome, DevTools, CDP, remote debugging, or window launch was used.

## Today's coverage register

| Current | Registry state | 2026-09-24 slot | Record |
|---|---|---|---|
| Handwriting (`typography`) | active | held / no record | — |
| Self portrait (`portrait`) | active | recorded / candidate-held | `portrait-2026-09-24` |
| Pure SVG (`svg`) | active | held / no record | — |
| Brush (`brush`) | active | held / no record | — |
| Naive art (`naive`) | active | held / no record | — |
| WebGPU (`webgpu`) | dormant | held / no record | — |

The only recorded 2026-09-24 slot is `portrait-2026-09-24`, titled *The portrait resists pressure.*, with raw tableau `/studies/self-portrait/v015/`, catalogue status `candidate / held`, and lifecycle `active`. The other five current/date slots are held because no work record exists.

## Register and filesystem checks

- JSON parsing: **PASS** for both active catalogue sources.
- Register size: **91 work records** across **6 currents**.
- Current IDs: **PASS** — all 91 records reference a registered current; no unknown current IDs.
- Duplicate current/date slots: **PASS** — none found anywhere in the register, including 2026-09-24.
- Canonical pages: **91/91 present** at `works/<workId>/index.html`.
- Raw tableau indexes: **91/91 present** under the recorded `/studies/` paths.
- Journal anchors: **91/91 canonical pages contain** `/journal/#journal-<workId>`.
- Critique gate: **91/91 records have at least one critique**; no explicit no-critique hold was needed.
- Field-test separation: field-test IDs were not counted as works.

## Schema anomaly and lifecycle gate

The lifecycle check is **held globally** because seven legacy records omit `lifecycle`:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

The working register therefore contains **84 active**, **0 complete**, and **7 missing lifecycle values**. No lifecycle value was inferred or written. The affected lifecycle acceptance audit stopped at this schema anomaly; the independent page, tableau, Journal-link, duplicate-slot, current-ID, and critique checks completed for all 91 records.

Complete-work immutability is vacuous: there are no complete records in either the working register or `HEAD`, so there is no complete record to compare and no complete-work mutation to report.

## Automated checks

- `npm run test`: **471 passed, 0 failed, 0 skipped, 0 todo**.
- Changed JavaScript syntax: **not applicable**; no changed `.js`, `.mjs`, or `.cjs` paths were present in the working tree.
- `git diff --check`: **PASS** after the report update.
- No auth, throttling, challenge, missing tableau, or catalogue/path mismatch was observed in the permitted local audit.
- Browser/visual/perceptual gates were not rerun under the unattended-run restriction and remain held; no browser result is claimed by this audit.

## Pre-existing working-tree state

Before this audit, the worktree already contained modifications to the 2026-09-21 and 2026-09-22 QA reports and 18 canonical HTML pages, plus the untracked `research/qa/2026-09-18-daily-studio-record.md`. This run changed only this dated QA report; no catalogue, artwork, study, or JavaScript file was changed.

## Held gates and next actions

- Supply explicit `lifecycle` values for the seven legacy records; do not infer them.
- Keep `portrait-2026-09-24` held because its catalogue status is `candidate / held`.
- Keep the five unrecorded 2026-09-24 slots held; no work record was present for them.
- Keep browser/visual/perceptual claims held unless separately evidenced by a permitted local or HTTP check.

---

# Fresh daily work run — Pure SVG / 2026-09-24

## Slot and status

- Current: Pure SVG (`svg`)
- Work: `svg-2026-09-24`
- Study: `studies/pure-svg/v015/`
- Title: *The void changes host.*
- Status: **candidate / held**
- Lineage: `pure-svg-v014`

## Artistic gate

v015 makes a structural and perceptual break from v012–v014. The previous three works used threshold routes, reciprocal radial cells, and horizontal gate corridors. v015 refuses routes and gates entirely: five blunt compound SVG territories hold separate negative spaces.

The changed rule is void ownership. Situated attention, translated from the source's proximity-based reciprocal looking and then inverted, closes the nearest territory around its actual compound-path hole while a distant territory receives the opening. The interaction is proximity-based rather than a generic control panel. The host and receiver change contour scale, position, rotation, role, and actual hole topology. Lifting the latest attention reconstructs the exact preceding field.

- Hypothesis: absence can become the moving subject of a Pure SVG work without a route or responding agent.
- Visible consequence: the blind field begins as five separate bodies with open voids; after attention one body closes around its void and another visibly receives an opening.
- Falsifier: if the host hole is only hidden by colour, if the receiver opening is only a witness mark, or if proximity changes no compound-path geometry, the translation fails.
- Deletion condition: delete v015 if caption-free viewing reads only decorative blobs, if the work still reads as a gate/route field, or if exact undo fails.

## Cultural translation / anti-copy

- Reference: `little-critters` — https://github.com/GordenSun/little-critters
- Observed mechanism: situated code-drawn agents respond to pointer proximity by changing attention and looking back.
- Mutine translation: remove the agents and invert the reply. Proximity transfers a vacancy between compound bodies.
- Anti-copy statement: no animals, characters, eyes, paper style, head-turning scene, source palette, composition, or surface vocabulary is reproduced.
- Direction consequence: closes the threshold, reciprocal-gaze, and gate-corridor grammars; opens constraint-and-topology as ownership of negative space.

## Files

- `studies/pure-svg/v015/index.html`
- `studies/pure-svg/v015/engine.mjs`
- `studies/pure-svg/v015/sketch.js`
- `studies/pure-svg/v015/style.css`
- `studies/pure-svg/v015/README.md`
- `studies/pure-svg/v015/metrics.json`
- `works/svg-2026-09-24/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/pure-svg-v015.test.mjs`
- `research/qa/proofs/svg-v015-2026-09-24/`

## Verification

- TDD RED observed: missing v015 engine/tableau caused the targeted suite to fail with `ERR_MODULE_NOT_FOUND`; after the first implementation, missing tableau/record failures were observed.
- TDD GREEN: targeted v015 suite **6 passed, 0 failed**.
- JavaScript syntax checks: `node --check` passed for `engine.mjs` and `sketch.js`.
- Local headless browser QA: **10/10 raw + 10/10 canonical** viewport/motion runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080` in normal and reduced-motion modes.
- Local diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses in the matrix and focused readbacks.
- Local interaction: pointer move changed topology, click changed it again, Enter changed topology/hole count, Delete restored the exact pointer signature, and release returned to stage `00 / 16` with `0` remembered attentions.
- Local blind preview: SVG remained visible while readout, controls, void marks, attention marks, labels, and count were hidden; no overflow at `390×844`.
- Local Journal/current readback: exactly one matching Journal anchor/title/link and one Pure SVG current header/first artwork; no overflow.
- Proofs: `research/qa/proofs/svg-v015-2026-09-24/results.json`, `probe.mjs`, and 24 PNG captures.

## Unresolved doubt

The structural and runtime gates pass. The work remains **candidate / held** because no independent caption-free perceptual critic was available in this unattended run. The unresolved question is whether the blind first-render and post-attention state communicate *void ownership* rather than merely a polished family of abstract blobs. Provider revision linkage from the stable production alias to the eventual GitHub SHA is also unverified until after deployment.

---

# Fresh daily work run — Brush / 2026-09-24

## Slot and status

- Current: Brush (`brush`)
- Work: `brush-2026-09-24`
- Study: `studies/p5-brush/v018/`
- Canonical route: `/works/brush-2026-09-24/`
- Title: *The brush keeps the back.*
- Status: **candidate / held**

## Artistic gate

### Repeated grammar refused

The previous three Brush works repeatedly used guided trails, tiled pressure, and discrete material islands. Their shared gesture was approach → pressure trace → reversible surface response. v018 refuses that front-facing trail grammar and returns to one continuous membrane with a new temporal rule: pointer departure, not pointer arrival, commits the material event.

### Structural rupture

On departure, the membrane opens an actual aperture through the front skin, the surrounding contour buckles, and the displaced load rises as a far-side fold. The latest departure is exactly reversible. Repeated departures are capped memory, not decorative recolouring.

This changes representation (trails/islands → continuous membrane), encounter (approach/hover → consequential departure), temporal behaviour (reversible response → bounded memory), and visible grammar (front marks → front aperture plus non-local back fold). It is a new causal engine, not a palette, texture, density, title, or annotation change.

- Hypothesis: departure can become a material operation; the brush surface can keep what leaves it by moving the load to the back.
- Visible consequence: hovering leaves the membrane unchanged; leaving creates an aperture, a changed contour, and a distant back-fold.
- Falsifier: if leaving is indistinguishable from hovering, if the aperture is a dark sticker, or if the fold is only a line or colour shift, the translation fails.
- Deletion condition: delete v018 if the blind field reads as decorative scratches, if the aperture does not remove front fill and buckle the contour, or if exact undo/release cannot restore the prior state.

## Cultural translation / anti-copy

- Reference: `little-critters` — https://github.com/GordenSun/little-critters
- Observed mechanism: situated agents change attention through proximity and reciprocal looking; the visitor becomes part of the encounter.
- Mutine translation: invert the reply. The material refuses to answer an approach; only departure causes the surface to open and lift its displaced load to the back.
- Visible consequence: hover leaves the membrane stable; departure commits an aperture, contour buckling, and a non-local fold; later departures accumulate within a bounded memory window.
- Anti-copy statement: no animals, characters, eyes, head-turning scene, source palette, composition, or surface vocabulary is reproduced.
- Direction consequence: closes the recent Brush trail/island grammar and opens delayed material consequence, departure memory, and front/back membrane logic.

## Files

- `studies/p5-brush/v018/index.html`
- `studies/p5-brush/v018/engine.mjs`
- `studies/p5-brush/v018/sketch.js`
- `studies/p5-brush/v018/style.css`
- `studies/p5-brush/v018/README.md`
- `studies/p5-brush/v018/metrics.json`
- `studies/p5-brush/v018/critiques.json`
- `works/brush-2026-09-24/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/p5-brush-v018.test.mjs`
- Updated count/date/catalog assertions in `tests/catalog-architecture.test.mjs`, `tests/daily-catalog.test.mjs`, and `tests/evolution-catalog.test.mjs`
- `research/qa/proofs/brush-v018-2026-09-24/` including local results, probe, and 24 PNG captures

## Verification

- TDD RED observed first for the v018 engine contract; the targeted suite failed before the implementation existed. GREEN: targeted v018 tests passed after the minimal engine and tableau were added.
- Full suite: **480 passed, 0 failed, 0 skipped, 0 todo**.
- `node --check` passed for changed study JavaScript, the targeted test, and the browser probe.
- `git diff --check`: **PASS**.
- Local tableau browser matrix: **10/10 canonical + 10/10 raw** runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced motion.
- Local diagnostics: zero console messages, page errors, failed requests, or HTTP 400+ responses.
- Local interaction: departure changed memory `0 → 1`, Enter changed it `1 → 2`, Delete restored `2 → 1` with the exact preceding canvas signature, and release returned memory to `0`.
- All three raw controls measured `44px` high at `390×844`; blind preview kept the canvas visible while hiding readout, controls, header, and annotations.
- Local Journal/current readback: exactly one matching Journal anchor/title/link and one Brush current header/first artwork; no horizontal overflow at `390×844`.

## Production verification

- Commit deployed: `68bb316d95f5cda66633270cb25b1b488fa76e3c`.
- GitHub `origin/main`: matched the local commit SHA.
- Vercel deployment: `dpl_Htpw1Pp6THrwcG5a2XS4derqKULu`; stable alias `https://autopoiesis-nine.vercel.app/`.
- Stable-alias browser matrix: **20/20 canonical + raw** runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced motion; zero console messages, page errors, failed requests, or HTTP 400+ responses.
- Stable-alias interaction at `390×844`: departure changed memory `0 → 1`, Enter changed it `1 → 2`, Delete restored `2 → 1` with the exact preceding canvas signature, and release returned memory to `0`.
- Stable-alias rendered Journal: exactly one `#journal-brush-2026-09-24` entry titled *The brush keeps the back.* with canonical link `/works/brush-2026-09-24/`.
- Stable-alias Brush current: header `Brush` and first work `brush-2026-09-24` observed at `390×844`; no horizontal overflow.
- Stable-alias register: exactly one `brush-2026-09-24` record with the expected title and raw path.
- Public catalog: exactly one matching record for `brush-2026-09-24`.
- Canonical work, raw tableau, and `/studio/favicon.svg` returned HTTP 200; favicon content type was `image/svg+xml`.

## Unresolved doubt

No independent caption-free perceptual reviewer is available in this unattended run. Structural, local browser, production browser, Journal/current, register, catalog, and route evidence are complete. Provider revision linkage from the stable alias to the GitHub SHA remains unverified, and the blind perceptual question remains open: does the membrane read as departure-held material rather than polished abstract texture? The work therefore remains honestly **candidate / held**, not exhibition-ready.

---

# Fresh daily work run — Naive art / 2026-09-24

## Slot and status

- Current: Naive art (`naive`)
- Work: `naive-2026-09-24`
- Study: `studies/naive-art/v017/`
- Canonical route: `/works/naive-2026-09-24/`
- Title: *The pile mistakes your shadow.*
- Status: **candidate / held**
- Lineage: `naive-2026-09-23`

## Artistic gate

v017 makes a material break from v014-v016. The previous three works used a punctured single scene, distributed picture panels, and isolated SVG forms; their recent causal vocabulary was cut/copy/departure. v017 refuses that grammar and builds one lopsided Canvas 2D pile of ten irregular blocks.

The changed rule is misaddressed sustained attention. Pointer movement arms a witness but does not mutate the image. A held attention event makes the attended block mistake the visitor for a distant block: a false face is cut into the target, a distant block inherits the wrong identity, and a shifted support exposes a real gap. Lifting the latest attention reconstructs the exact preceding pile.

- Hypothesis: a naive picture can remember a mistake as a wrong assignment inside one load-bearing object.
- Visible consequence: the blind field begins as one assembled pile; after sustained attention, target geometry, distant inheritance, support displacement, and gap geometry change together.
- Falsifier: if movement changes the pile before a hold, or if false face/inheritance/gap are only recolouring or annotation, the translation fails.
- Deletion condition: delete v017 if caption-free comparison cannot distinguish sustained attention from departure, or if the blind view collapses back into panels, routes, isolated forms, or an explanatory diagram.

## Cultural translation / anti-copy

- Reference: `little-critters` — https://github.com/GordenSun/little-critters
- Observed mechanism: situated code-drawn agents make proximity legible as attention and reciprocal looking.
- Mutine translation: explicitly invert v016's refusal of presence. Sustained presence is accepted, but the reply is a material misaddress: the pile assigns the visitor to the wrong block and rebalances its supports.
- Visible consequence: one held event produces a false face, a distant inherited identity, and an exposed support gap in one assembled pile.
- Anti-copy statement: no animals, characters, eyes, head-turning scene, paper style, source palette, composition, or surface vocabulary is reproduced.
- Direction consequence: closes Naive art v014-v016's puncture, picture-panel, and departure-is-absence grammar; opens a load-bearing misaddress direction.

## Files

- `studies/naive-art/v017/index.html`
- `studies/naive-art/v017/engine.mjs`
- `studies/naive-art/v017/sketch.js`
- `studies/naive-art/v017/style.css`
- `studies/naive-art/v017/README.md`
- `studies/naive-art/v017/metrics.json`
- `studies/naive-art/v017/critiques.json`
- `works/naive-2026-09-24/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/naive-art-v017.test.mjs`
- Updated count/date/catalog assertions in `tests/catalog-architecture.test.mjs`, `tests/daily-catalog.test.mjs`, and `tests/evolution-catalog.test.mjs`
- `research/qa/proofs/naive-art-v017-2026-09-24/` including local results, summary, probe, and 24 PNG captures

## Verification

- TDD RED observed: the new v017 test initially failed because `engine.mjs` was absent.
- TDD GREEN engine slice: v017 material mutation and exact undo test passed after the minimal engine implementation.
- Local and production tableau browser matrices: **10/10 canonical + 10/10 raw** runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced motion.
- Tableau-first canonical runs: **10/10 local + 10/10 production**.
- Local and production diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses.
- Overflow: **0**; `innerWidth == clientWidth == scrollWidth` in all local and production matrix runs.
- Local and production interaction at `390×844`: pointer movement only armed; held pointer changed memory `0 → 1`, Enter changed `1 → 2`, Delete restored `2 → 1` with the exact preceding pile signature, and release returned memory to `0`.
- Reduced-motion/static blind preview locally and in production kept the canvas visible while hiding readout, controls, header, and annotations; no overflow.
- All three raw controls measured `44px` high and at least `118px` wide locally and in production at `390×844`.
- Local and production Journal readback rendered exactly one `#journal-naive-2026-09-24` entry with the recorded title and canonical work link.
- Local and production Naive art current readback rendered exactly one current header and first artwork at `390×844` with no overflow.
- Production routes `/works/naive-2026-09-24/`, `/studies/naive-art/v017/`, `/journal/`, and `/studio/favicon.svg` returned HTTP 200 under deployment `dpl_3kAangEZQh4Py1ESpX4RWb9tHRYD`.
- Proofs: `research/qa/proofs/naive-art-v017-2026-09-24/summary.json`, `results.json`, `probe.mjs`, and 24 local PNG captures.

## Unresolved doubt

No independent caption-free perceptual reviewer is available in this unattended run. Structural, local browser, production browser, Journal/current, register, catalog, and route evidence are complete. Provider revision linkage from the stable alias to the GitHub SHA remains unverified, and the blind perceptual question remains open: does the block pile read as one load-bearing misaddress rather than a polished arrangement of coloured abstract blocks? The work therefore remains honestly **candidate / held**, not exhibition-ready.
