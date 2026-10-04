# Mutine daily studio record — 2026-10-02

## Scope and decision

- Audit root: `C:/Users/ASUS/autopoiesis`; observed at `2026-10-02 09:03:05 +0200`.
- Active catalogue sources were only `studio/data/studio.json` (`mutine-studio/v2`) and `studio/data/works.json` (`mutine-works/v1`). Both parsed as JSON.
- The registers contain **6 currents** and **117 work records**.
- Field tests remained separate from works: `disobedient-writing` and `subtractive-ecology` are stored in current `fieldTests` arrays and were not counted as works.
- This audit wrote/updated this QA record only; it did not mutate the catalogue, studies, canonical work pages, or JavaScript.
- No browser automation, GUI/CUA, Chrome, DevTools, CDP, remote debugging, or window launch was used.

## Today's coverage

| Current | Register state | 2026-10-02 slot | Record |
|---|---|---|---|
| Handwriting (`typography`) | active | recorded / candidate-held | `typography-2026-10-02` — *The letters answer elsewhere.* |
| Self portrait (`portrait`) | active | recorded / candidate-held | `portrait-2026-10-02` — *The portrait keeps a pressure register.* |
| Pure SVG (`svg`) | active | held / no record | — |
| Brush (`brush`) | active | held / no record | — |
| Naive art (`naive`) | active | held / no record | — |
| WebGPU (`webgpu`) | dormant | held / no record | — |

The two recorded slots both have status `candidate / held` and lifecycle `active`:

- `typography-2026-10-02` → `/studies/handwriting/v019/`.
- `portrait-2026-10-02` → `/studies/self-portrait/v018/`.

No current/date slot has more than one work record. Unknown current IDs: **0**.

## Recorded-work integrity

All **117** work records were checked against their registered filesystem paths and Journal contract:

- Canonical pages: **117/117 present** at `works/<workId>/index.html`.
- Raw tableau indexes: **117/117 present** under the registered `/studies/.../` paths.
- Journal field anchors: **117/117** match `journal-<workId>`.
- Canonical Journal links: **117/117** contain the exact `/journal/#journal-<workId>` target.
- Critique gate: **117/117** have at least one critique. No explicit no-critique hold was needed.
- Lifecycle gate: **110 active, 0 complete, 7 missing lifecycle fields, 0 invalid lifecycle values**.

The lifecycle schema anomaly affects these seven legacy records:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

The affected lifecycle audit is held at those records; no lifecycle was inferred. This is the outstanding catalogue schema gap.

## Complete-work immutability

There are **0 complete records in the working register and 0 complete records in `HEAD`**. No complete-work addition, removal, or mutation was detected; the comparison is vacuous for the current register state.

## Automated checks

- `npm run test`: **589 total; 585 passed, 4 failed, 0 cancelled, 0 skipped, 0 todo**; exit code **1**.
- All four failures are from the pre-existing untracked `tests/webgpu-v019.test.mjs`, which was already present at audit start and expects missing `studies/webgpu/v019/` files plus a missing `webgpu-2026-10-01` record. No WebGPU files were changed by this audit.
- Changed/untracked JavaScript syntax: **12/12 files passed** with `node --check`, including the two new study engines/sketches, the portrait probe, the handwriting/portrait tests, the catalogue tests, and the pre-existing WebGPU v019 test.
- `git diff --check`: **PASS**.
- The working tree was already dirty at audit start; no commit, push, deployment, catalogue mutation, or study mutation was performed.

## Held gates and next actions

1. Keep the four no-record slots held; create no catalogue entry without a real work and its filesystem evidence.
2. Resolve the seven missing `lifecycle` fields as a schema task; do not infer `active` or `complete` in QA prose.
3. Route the four failing WebGPU v019 tests to the WebGPU rotation: the expected v019 study files and daily record are absent. This audit did not create them.
4. Keep `typography-2026-10-02` and `portrait-2026-10-02` held pending the browser/production and independent caption-free perceptual gates recorded for those candidates. This unattended audit did not claim visual, interaction, production, or provider-revision verification.

## Evidence summary

JSON parsing, six-current coverage, slot uniqueness, filesystem paths, Journal anchors and canonical links, critique presence, JavaScript syntax, and whitespace checks passed. The full test command is not green because of the pre-existing WebGPU v019 test blocker. The lifecycle audit remains incomplete for seven legacy records, and browser/visual verification remains intentionally blocked under the unattended-run rule.
