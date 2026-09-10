# Daily studio record — 2026-09-10

## Scope and continuation

Continuation of the unattended daily rotation in `C:/Users/ASUS/autopoiesis`.
The previous run audited the registers but could not obtain browser evidence and
left the Brush slot unrecorded. This run worked only on the supplied target:
Brush (`brush`), local date `2026-09-10`.

The active catalogue sources remain `studio/data/studio.json` and
`studio/data/works.json`. Both parse as valid JSON. The catalogue now contains
38 records, with unique IDs and unique `currentId/date` slots. Seven historical
records still have a null or missing raw `lifecycle` field; that schema anomaly
remains held and was not silently repaired.

## Today's coverage

| Current | Today's record | Status / lifecycle | Tableau |
|---|---|---|---|
| Handwriting (`typography`) | `typography-2026-09-10` | `candidate / held` / `active` | `/studies/handwriting/v006/` |
| Self portrait (`portrait`) | `portrait-2026-09-10` | `candidate / held` / `active` | `/studies/self-portrait/v006/` |
| Pure SVG (`svg`) | `svg-2026-09-10` | `candidate / held` / `active` | `/studies/pure-svg/v008/` |
| Brush (`brush`) | `brush-2026-09-10` | `candidate / held` / `active` | `/studies/p5-brush/v008/` |
| Naive art (`naive`) | none | held / no record | — |
| WebGPU (`webgpu`) | none | held / no record | — |

No record was invented for the two absent currents.

## Brush v008 artifact

- Work: `brush-2026-09-10`, title **The brush shares the pigment.**
- Lineage: `brush-2026-09-09` → `v008`.
- Changed rule: a remembered removal becomes a porous membrane; later strokes
  exchange signed pigment sideways across it, changing route, width, and wetting
  in an opposite gain/loss pair.
- Interaction: pointer, `Enter`, and `Space` add one bounded membrane; `lift
  latest` rebuilds the exact previous deterministic frame; `release sequence`
  clears visitor memory and restarts the sequence.
- Falsifier and deletion condition are recorded in
  `studies/p5-brush/v008/README.md`, `critiques.json`, and the work register.
- Canonical page: `works/brush-2026-09-10/index.html`.

## Browser and visual evidence

Local headless Playwright evidence is recorded in
`research/qa/proofs/brush-v008-2026-09-10/`:

- 10/10 canonical runs passed at `320x568`, `390x844`, `768x1024`, `1280x800`,
  and `1920x1080`, in normal and reduced-motion modes.
- Canonical tableau rendered before prose; outer and embedded documents had no
  horizontal overflow; all three raw controls measured 44 CSS px.
- Pointer changed memory `0 → 1`; `Enter` changed it `1 → 2`; lifting returned
  it to `1` and restored the exact prior canvas PNG SHA-256; release returned to
  stage 01 with `0 membranes remembered`.
- Static reduced-motion blind preview at `390x844` hid editorial furniture,
  controls, and readout without overflow.
- All observed console/page-error/request-failure/HTTP-400+ arrays were empty.
- 12 PNG captures plus compact `results.json` are present.

The artifact remains **candidate / held**: the independent caption-free
perceptual review with membrane witnesses, labels, notation, and readout hidden
was not available in this unattended run. The independent reviewer subagent
was also unavailable in this Hermes session; no independent approval is claimed.

## Automated verification

- TDD red observed before implementation: missing v008 engine/tableau and
  missing daily record failed the new tests.
- TDD green: targeted Brush v008 tests passed.
- `npm run test`: **PASS — 200/200 tests, 0 failed, 0 skipped, 0 todo**.
- `node --check`: v008 sketch and QA probe passed.
- JSON parse: studio register, works register, v008 metrics/critiques, and QA
  results all passed.
- `git diff --check`: pass.

## Publication state at record time

This QA record is a factual pre-publication snapshot. Git commit/push and
production deployment are performed only after the remaining release checks;
production URLs are not claimed here until separately fetched and read back.
