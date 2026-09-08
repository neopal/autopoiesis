# Daily studio record - 2026-09-07

## Scope and source boundary

This scheduled rotation targeted Naive art (`naive`) on `2026-09-07`; the pre-run slot was empty. The canonical sources were `studio/data/studio.json` (`mutine-studio/v2`) and `studio/data/works.json` (`mutine-works/v1`). Field tests and stimuli were not treated as work records.

A real candidate tableau was implemented at `/studies/naive-art/v004/` and recorded once as `naive-2026-09-07`. No duplicate current/date record was created. The candidate remains `candidate / held`; it was not promoted, committed, pushed, or deployed.

## Candidate record

**Title:** The house forgets where away is.

- **Changed rule:** v003 moved the threshold around the house. v004 instead moves one shared vanishing point; the kept roof edge, side plane, ground rays, and route all inherit that wrong destination while the house and door stay in place.
- **Visible consequence:** the refused panel is flat and front-facing; the kept panel recedes toward a common false point, with the path entering the unchanged door and continuing along the altered perspective.
- **Deterministic state:** seed `0x4e413034`, 10 stages, 30-shape budget, 9 remembered points at the settled state, deterministic SVG path geometry.
- **Interaction:** pointer/tap or Enter/Space adds a bounded visitor vanishing point; `undo last` removes the latest point and reconstructs the prior frame; `release sequence` returns to the seeded timeline.
- **Falsifier:** if hiding the vanishing-point witness leaves the roof, ground, and route without a shared changed destination, the memory rule is ornamental.
- **Deletion condition:** delete v004 if a caption-free observer cannot identify the shared wrong direction twice, or if the perspective reads as a decorative skew.

## Changed files for this slot

- `studies/naive-art/v004/README.md`
- `studies/naive-art/v004/critiques.json`
- `studies/naive-art/v004/engine.mjs`
- `studies/naive-art/v004/index.html`
- `studies/naive-art/v004/metrics.json`
- `studies/naive-art/v004/sketch.js`
- `studies/naive-art/v004/style.css`
- `tests/naive-art-v004.test.mjs`
- `studio/data/works.json`
- `works/naive-2026-09-07/index.html` (generated canonical shell)
- `tests/catalog-architecture.test.mjs`, `tests/daily-catalog.test.mjs`, `tests/evolution-catalog.test.mjs` (updated 22-record expectations to include this real daily record)
- `research/qa/2026-09-07-daily-studio-record.md`

## Record and route checks

- `studio/data/studio.json`: PASS - valid JSON; six current records found.
- `studio/data/works.json`: PASS - valid JSON; 23 work records found.
- Current/date uniqueness: PASS - no duplicate `currentId/date` pairs.
- Target canonical page: PASS - `works/naive-2026-09-07/index.html` exists and is generated from the new register record.
- Target raw tableau: PASS - `studies/naive-art/v004/index.html` exists with engine, sketch, style, metrics, critiques, and README.
- Target journal relation: PASS - record anchor is `journal-naive-2026-09-07`; canonical shell points to the Journal route.
- Target critique condition: PASS - four named critiques are recorded; status remains held.
- Auth/throttling/challenge: not encountered - this run used local repository and local test-server checks only.

## Verification evidence

- RED test: PASS as process evidence - the new test initially failed with `ERR_MODULE_NOT_FOUND` before v004 production code existed.
- Target test before the guide fix: one expected failure - the new shared-vanishing-point invariant exposed a missing `scene.house.vanishingPoint` property.
- `node --test tests/naive-art-v004.test.mjs`: PASS - 7/7 tests passed after the minimal fix.
- `npm run test`: PASS - 112/112 tests passed, 0 failed, 0 skipped, 0 todo.
- Changed JavaScript syntax: PASS - `node --check` passed for `studies/naive-art/v004/engine.mjs`, `studies/naive-art/v004/sketch.js`, `scripts/generate-work-pages.mjs`, and `studio/catalog.js`.
- `git diff --check`: PASS - no whitespace errors; Git emitted only expected LF-to-CRLF working-copy warnings.
- Added-line security scan: not run as a separate staged-diff scan because this unattended run did not stage or commit changes; source review found no credentials, shell execution, eval/exec, unsafe deserialization, or SQL construction.
- Independent reviewer subagent: not run - this scheduled runtime does not expose `delegate_task`; no independent approval is claimed.

## Browser evidence actually obtained

Local `python -m http.server 8123` returned HTTP 200 for the target tableau. The canonical local route rendered in the default Hermes headless browser at:

`http://127.0.0.1:8123/works/naive-2026-09-07/`

The observed clean visual pass (captured before the minimal guide-point property fix) showed the tableau before explanation, a distinct refused/consequence diptych, a flat proposal beside a receding kept house, a visible shared roof/ground/path direction, controls, timeline, Journal relation, critique, and evidence. The guide-point fix only made the visible guide source use the same scene point already driving the geometry; a final screenshot after that fix was not obtained because browser probing had already stopped at the no-progress guardrail. The canonical DOM exposed the title, full-artwork iframe, `MISPLACE AWAY`, `UNDO LAST`, and `RELEASE SEQUENCE` controls, plus previous-daily navigation.

One real `MISPLACE AWAY` button click was accepted. The following iframe accessibility snapshot returned the same tree and triggered the browser tool `idempotent_no_progress` guardrail; the post-click state change is therefore not claimed as observed. Browser probing stopped at that point as required. No browser console probe was run after the guardrail.

A direct raw preview attempt at `/studies/naive-art/v004/index.html?preview=1&static=1` returned the browser adapter error `utf-8 codec can't decode byte 0x82 in position 233: invalid start byte`; a second interaction-preview attempt returned the same class of error. Byte checks confirmed the new v004 source files are ASCII-safe after removing non-ASCII punctuation. The raw-preview route remains held as an adapter/route evidence gap, not declared fixed.

The five-viewport browser matrix (`320x568`, `390x844`, `768x1024`, `1280x800`, `1920x1080`), reduced-motion browser pass, post-click DOM state, console probe, and independent caption-free perceptual comparison were not completed in this unattended run. Engine/layout tests passed, but they do not substitute for those browser/perceptual gates.

The repository names the intended production route as:

`https://autopoiesis-nine.vercel.app/works/naive-2026-09-07/`

That production URL was not fetched or deployed in this run; public visibility is not claimed. No commit, push, or deployment was performed.

## Lifecycle and unresolved doubt

The new record is active and explicitly `candidate / held`. The accepted direction is pending an independent caption-free comparison with the vanishing-point witness, guide lines, labels, and readout hidden and restored at the five required viewports. The unresolved artistic doubt is whether the shared wrong destination remains legible without the witness and explanatory prose. The unresolved technical doubts are the raw preview decoding failure and the unverified post-click state change.

## Archive decision

**Record, do not promote.** The Naive art daily slot is now a real, canonical, navigable work record with deterministic structural memory and a visual canonical-route pass. It remains held until independent perceptual, responsive, reduced-motion, and deployment evidence is available.

---

## WebGPU rotation — 2026-09-07

### Scope and candidate

This scheduled rotation targeted WebGPU (`webgpu`) on `2026-09-07`; the pre-run slot was empty. The canonical sources remained `studio/data/studio.json` (`mutine-studio/v2`) and `studio/data/works.json` (`mutine-works/v1`). No duplicate `currentId/date` record was created, and no stimulus or field test was promoted into the daily register.

A real candidate tableau was implemented at `/studies/webgpu/v003/` and recorded once as `webgpu-2026-09-07`. It remains `candidate / held`; it was not promoted, committed, pushed, or deployed.

- **Title:** The crowd keeps a place open.
- **Changed rule:** v002's temporal debt becomes a vacancy in local order. Downstream agents queue in two lanes around the open place, then rejoin with an order offset carried by their coordinates.
- **Visible consequence:** the 432-agent field forms a measurable vacancy braid/order shear instead of only changing a witness marker; the final deterministic state carries four vacancies.
- **Deterministic state:** seed `0x57475033`, 11 stages, 432 agents, memory cap 4, Canvas 2D fallback with WebGPU detection.
- **Interaction:** pointer/tap or Enter/Space reserves a bounded vacancy; Delete/Backspace lifts the latest; `release crowd` returns to the seeded sequence.
- **Falsifier:** hide vacancy witnesses, order threads, labels, readout, and prose; if the braid or changed order is not identifiable, the direction fails.
- **Deletion condition:** delete v003 if the two lanes read as decoration, if a vacancy only changes colour, or if lifting it does not alter the downstream field.

### Changed files for this rotation

- `studies/webgpu/v003/README.md`
- `studies/webgpu/v003/critiques.json`
- `studies/webgpu/v003/engine.mjs`
- `studies/webgpu/v003/index.html`
- `studies/webgpu/v003/metrics.json`
- `studies/webgpu/v003/sketch.js`
- `studies/webgpu/v003/style.css`
- `tests/webgpu-v003.test.mjs`
- `studio/data/works.json`
- `works/webgpu-2026-09-07/index.html` (generated canonical shell)
- `tests/catalog-architecture.test.mjs`, `tests/daily-catalog.test.mjs`, `tests/evolution-catalog.test.mjs` (24-record register expectations)
- `research/qa/2026-09-07-daily-studio-record.md`

### Record and verification evidence

- `studio/data/studio.json`: PASS — valid JSON; six current records found.
- `studio/data/works.json`: PASS — valid JSON; 24 work records found; target appears exactly once.
- Current/date uniqueness: PASS — no duplicate pairs.
- Target raw tableau and supporting files: PASS — v003 index, engine, sketch, style, metrics, critiques, and README exist.
- Target canonical page: PASS — `works/webgpu-2026-09-07/index.html` exists and carries `data-catalog-work-detail="webgpu-2026-09-07"`.
- Target journal relation and lineage: PASS — anchor `journal-webgpu-2026-09-07`; lineage `webgpu-2026-09-04`.
- Structural metrics from the actual engine: final memory 4; 209 queued agents; order shear `59.94210420500629`; vacancy load `39.09180168613418`; affected agents `[191, 142, 23, 41]`.
- TDD RED evidence: PASS as process evidence — the new target test first failed with `ERR_MODULE_NOT_FOUND` before v003 production code existed; the first engine run then failed the intended field-delta assertion (`0.341353003733271` below the threshold) before the downstream effect was strengthened.
- `node --test tests/webgpu-v003.test.mjs`: PASS — 6/6.
- `npm run test`: PASS — 118/118, 0 failed, 0 skipped, 0 todo.
- Changed JavaScript syntax: PASS — `node --check` passed for v003 engine/sketch, `scripts/generate-work-pages.mjs`, and `studio/catalog.js`.
- `git diff --check`: PASS — no whitespace errors; only expected LF-to-CRLF working-copy warnings.
- Independent reviewer subagent: not run — no `delegate_task` tool is exposed in this scheduled runtime; no independent approval is claimed.
- Commit/push/deploy: none performed.

### Browser evidence actually obtained

The local server returned HTTP 200 for the canonical route:

`http://127.0.0.1:4173/works/webgpu-2026-09-07/`

The default Hermes headless browser rendered the canonical tableau-first shell with the v003 title, full-artwork iframe, `RESERVE A PLACE`, `LIFT LATEST`, and `RELEASE CROWD` controls, a status region, same-current timeline, Journal link, four critiques, working-condition metrics, and previous-daily navigation. The v003 status region exposed `STAGE … / 11`, open-place count, and `WEBGPU READY / VACANCY`.

The visual screenshot showed a black canvas in v003. The existing v002 control rendered the same black canvas in the same headless environment, so this is recorded as a browser/canvas capture limitation rather than claimed as a v003 visual pass. The surrounding frame, title, controls, and reading path were legible without observed clipping at the captured desktop viewport.

One `RESERVE A PLACE` button click was accepted by the browser adapter. The subsequent accessibility snapshot still showed the autonomous sequence (`STAGE 06 / 11`, `2 OPEN PLACES`) rather than the expected `visitor vacancy / paused` state; no interaction state change is claimed. A single post-load console probe returned an empty message/error buffer. A bounded DOM expression probe confirmed the iframe was complete with a 714×720 canvas, but did not prove pixels or visitor state.

The raw preview route `/studies/webgpu/v003/?preview=1&static=1` and the canonical isolated-preview route both returned the browser adapter error `'utf-8' codec can't decode byte 0x82 …`; those routes remain an adapter evidence gap and were not retried identically. The five required viewports (`320x568`, `390x844`, `768x1024`, `1280x800`, `1920x1080`), reduced-motion browser matrix, reliable post-click DOM state, independent network-failure log, and caption-free perceptual comparison were not completed.

The intended production alias remains unverified for this candidate:

`https://autopoiesis-nine.vercel.app/works/webgpu-2026-09-07/`

No public visibility is claimed.

### Lifecycle and archive decision

**Record, do not promote.** The WebGPU slot is a real, deterministic, canonical daily work with green structural and repository-wide tests. It remains held because the headless canvas capture is black, the iframe interaction state was not observed, the raw/isolated preview routes hit the adapter decoding failure, and responsive/reduced-motion/public/perceptual gates remain unresolved.
