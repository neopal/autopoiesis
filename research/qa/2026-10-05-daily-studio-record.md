# Mutine daily studio record — 2026-10-05

## Scope and decision

- Audit root: `C:/Users/ASUS/autopoiesis`; observed at `2026-10-05 09:00:36 +0200`.
- Active catalogue sources were only `studio/data/studio.json` (`mutine-studio/v2`) and `studio/data/works.json` (`mutine-works/v1`). Both parsed successfully as JSON.
- The registers contain **6 currents** and **137 work records**.
- Field tests remained separate from works: **2** entries (`disobedient-writing`, `subtractive-ecology`); they were not counted as works.
- The initial audit wrote this QA record only. The subsequent Brush v024 and WebGPU v023 runs added real tableaux, catalogue records, canonical pages, evidence, and public-catalog updates documented below.
- Local validation used Playwright with installed Chrome in headless mode; no GUI/CUA, headed browser, real browser profile, CDP, remote debugging, or window launch was used.

## Today's coverage

| Current | Register state | 2026-10-05 slot | Record |
|---|---|---|---|
| Handwriting (`typography`) | active | recorded / candidate-held | `typography-2026-10-05` — *Pressure changes the word.* |
| Self portrait (`portrait`) | active | recorded / candidate-held | `portrait-2026-10-05` — *The portrait keeps a blind side.* |
| Pure SVG (`svg`) | active | recorded / candidate-held | `svg-2026-10-05` — *The sheet refuses a quick touch.* |
| Brush (`brush`) | active | recorded / candidate-held | `brush-2026-10-05` — *The paint keeps the endpoints.* |
| Naive art (`naive`) | active | held / no record | — |
| WebGPU (`webgpu`) | dormant | recorded / candidate-held | `webgpu-2026-10-05` — *The crowd keeps the unspoken.* |

The four initially recorded slots have status `candidate / held` and lifecycle `active`:

- `typography-2026-10-05` → `/studies/handwriting/v022/`.
- `portrait-2026-10-05` → `/studies/self-portrait/v021/`.
- `svg-2026-10-05` → `/studies/pure-svg/v023/`.
- `brush-2026-10-05` → `/studies/p5-brush/v024/`.

No current/date slot has more than one work record anywhere in the register. Duplicate slots: **0**. Unknown current IDs: **0**.

## Recorded-work integrity

- All **137** work records were checked against their registered filesystem paths and Journal contract:

- Canonical pages: **137/137 present** at `works/<workId>/index.html`.
- Raw tableau indexes: **137/137 present** under the registered `/studies/.../` paths.
- Journal field anchors: **137/137** match `journal-<workId>`. The static `/journal/` shell is data-driven; `studio/catalog.js` renders each record's `journal.anchor` as the runtime element id.
- Canonical Journal links: **137/137** contain the exact `/journal/#journal-<workId>` target.
- Critique gate: **137/137** have at least one critique. No explicit no-critique hold was needed.
- Lifecycle gate: **130 active, 0 complete, 7 missing lifecycle fields, 0 invalid lifecycle values**.

The lifecycle schema anomaly affects these seven legacy records; their lifecycle gate is held and no value was inferred:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

No missing tableau, canonical page, Journal anchor, canonical Journal target, critique, or catalogue-to-filesystem mismatch was found.

## Complete-work immutability

There are **0 complete records in the working register and 0 complete records in `HEAD`**. No complete-work mutation was detected; the comparison is vacuous because there are no complete records to compare.

## Automated checks

- `npm run test`: **675 total; 675 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo**; exit code **0**.
- Changed JavaScript syntax: `studies/webgpu/v023/engine.mjs` and `studies/webgpu/v023/sketch.js` passed `node --check`; no syntax failures were reported.
- `git diff --check`: **PASS**.
- The subsequent v024 run added the Brush study, daily record, canonical page, public catalog, targeted tests, and browser proofs; `.hermes/portrait-v016-probe.mjs` remained unrelated and unstaged.

## Held gates and next actions

1. Keep the one no-record slot held; create no catalogue entry without a real work and its filesystem evidence.
2. Resolve the seven missing `lifecycle` fields as a schema task; do not infer `active` or `complete` in QA prose.
3. Keep all five 2026-10-05 candidate-held works pending the independent caption-free perceptual gate and any remaining production/provider-revision evidence declared by their records.
4. Local and production browser, interaction, responsive, routing, and deterministic gates passed for Brush v024 and WebGPU v023; independent caption-free perceptual review and provider revision linkage remain open for both.

## Evidence summary

The active JSON registers parsed successfully. All six currents were accounted for on 2026-10-05: five real candidate-held records and one held/no-record slot in the target rotation's remaining work. Duplicate detection, current-ID validation, canonical pages, raw tableaux, Journal anchors and links, critique coverage, JavaScript syntax, the full Node test suite, whitespace checks, and the Brush v024 and WebGPU v023 local and production browser matrices passed. The lifecycle audit remains incomplete for seven legacy records, and provider revision linkage plus the independent caption-free perceptual gate remain open.

## Brush v024 execution record

- Changed rule: one suspended p5.js pigment bridge accepts two discrete endpoint touches; the first touch only arms, the second keeps both endpoints and removes the actual middle interval, with later-bank stress inherited.
- Cultural translation: `little-critters` reciprocity became a material endpoint pact, with no animals, eyes, look-back imagery, source palette, composition, or API copied.
- Local browser proof: **20/20** raw/canonical runs across `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal/reduced motion; **0** diagnostics and **0** overflow failures.
- Interaction proof: first touch `0 → 0`; repeated same-segment touch `0 → 0`; distinct pair `0 → 1` with 5 removed segments; Enter and button commit; Delete/lift restore exact signature; release returns memory to `0`.
- Reduced-motion settled state: stage `17`, memory `4`, 8 removed segments. Normal state: stage `0`, memory `0`, 0 removed segments.
- Production browser proof: **20/20** raw/canonical runs at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal/reduced motion; **0** diagnostics, **0** overflow failures, **10/10** tableau-first canonical order checks.
- Production readbacks: stable `/studio/data/works.json`, `/journal/`, `/currents/brush/`, and `/works/brush-2026-10-05/` returned HTTP `200`; Journal rendered `#journal-brush-2026-10-05` and the work title. Stable production alias: `https://autopoiesis-nine.vercel.app/`.
- Candidate remains held pending provider revision linkage and independent caption-free perceptual review.

## WebGPU v023 execution record

- Changed rule: v023 replaces v020's crease sheet, v021's chorus lattice, and v022's adaptive cell field with one continuous triangulated membrane. A typed three-token witness is non-causal until sealed; the seal opens two non-local regions as actual missing triangles, folds their surrounding vertices, and leaves residue for the next witness. Delete lifts the latest witness; R/Escape releases the bounded archive.
- Cultural translation: `little-critters` situated reciprocity became a typed collective witness and a material endpoint relation, with no animals, eyes, look-back imagery, source palette, composition, API, or surface vocabulary copied.
- Local browser proof: **20/20** raw/canonical runs across `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal/reduced motion; **0** diagnostics and **0** overflow failures.
- Interaction proof: partial `A` remained memory-neutral; incomplete seal remained at `0`; `A-C-B` plus Enter committed `0 → 1` with omitted triangles; Delete restored the exact baseline; equivalent token-button path committed; release returned memory to `0`; all controls were at least `44px` high.
- Blind reduced-motion preview: canvas visible, editorial furniture hidden, `scrollWidth = innerWidth = 390`, settled memory `3`, six apertures, and `44` open triangles.
- Production browser proof: **20/20** raw/canonical runs across `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal/reduced motion; **0** diagnostics and **0** overflow failures; **10/10** tableau-first canonical order checks.
- Production readbacks: stable `/studio/data/works.json`, `/journal/`, `/currents/webgpu/`, and `/works/webgpu-2026-10-05/` returned HTTP `200`; Journal rendered `#journal-webgpu-2026-10-05` and the title. Stable production alias: `https://autopoiesis-nine.vercel.app/`.
- Targeted v023 tests: **5 passed**. Full `npm test`: **675 passed, 0 failed**. `node --check` for the v023 engine and sketch passed. `git diff --check`: **PASS**.
- Candidate remains held pending independent caption-free perceptual comparison and provider revision linkage.
