# Mutine daily studio archive — 2026-10-27

**Audit scope:** the six-current daily register, with the scheduled slot executed for `brush / 2026-10-27`.

**Status:** brush candidate recorded and locally verified; production publication remains pending.

The audit used only `studio/data/studio.json` and `studio/data/works.json` as active catalogue sources. Field tests and stimuli were not merged into the work register.

## Today’s six current/date slots

- **Handwriting / typography** — real work record: `typography-2026-10-27`, “The letter is cast elsewhere.”, `/studies/handwriting/v035/`, `candidate / held`, lifecycle `active`.
- **Self portrait / portrait** — real work record: `portrait-2026-10-27`, “The portrait audits the empty centre.”, `/studies/self-portrait/v035/`, `candidate / held`, lifecycle `active`.
- **Pure SVG / svg** — held; no catalogue record for `2026-10-27`.
- **Brush / brush** — `brush-2026-10-27`, “The stain keeps its holes.”, `/studies/p5-brush/v039/`, `candidate / held`, lifecycle `active`.
- **Naive art / naive** — held; no catalogue record for `2026-10-27`.
- **WebGPU / webgpu** — held; no catalogue record for `2026-10-27`; current state is `dormant`.

Duplicate current/date slots: **none**. The full register contains **216** records with unique IDs and unique current/date keys.

## Brush v039

- **Changed rule:** an incomplete pressure loop is geometry-neutral; only a closed loop removes a chamber as an actual inline-SVG even-odd hole, bends surrounding contours, and thickens a suture channel.
- **Rupture:** v038’s lamina stack, v037’s local Canvas incision, and v036’s WebGL slab become one continuous SVG topological field with negative chambers.
- **Cultural reference:** [p5.brush](https://github.com/acamposuribe/p5.brush). Pressure, density, directional behavior, and fields participate in producing geometry; Mutine translates this into a closure threshold and refuses brush presets, watercolor, hatching, grain, palette, composition, source code, examples, and API surface.
- **Local tableau:** `studies/p5-brush/v039/`, seed `0x42523939`, four-wound memory, pointer/touch closed loop, keyboard/control equivalent, lift, release, and reduced-motion blind state.
- **Falsifier/deletion:** delete if open loops commit, holes are cosmetic, the blind view reads as a generic contour map, or later wounds forget.

## Register and route checks

Parsed successfully:

- `studio/data/studio.json` — schema `mutine-studio/v2`, 6 currents.
- `studio/data/works.json` — schema `mutine-works/v1`, 216 records.
- `studio/data/catalog-public.json` — regenerated from the source register; QA-only `browserEvidence` is omitted from the public payload.

Observed structural coverage across all 216 records:

- Canonical `works/<id>/index.html`: **216/216**.
- Raw tableau `rawPath/index.html` under `/studies/`: **216/216**.
- Journal anchor field `journal-<workId>`: **216/216**.
- Canonical pages linking the exact `/journal/#journal-<workId>` route: **216/216**. The journal page’s runtime renderer uses the register anchor as the entry id.
- At least one critique or explicit no-critique hold: **216/216**. No empty critique list or explicit no-critique hold was observed.
- Valid lifecycle (`active` or `complete`): **209/216**.

### Catalogue gap / schema anomaly

Seven historical records have no valid `lifecycle` value, so the lifecycle acceptance criterion is not complete for the catalogue:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

The affected lifecycle audit is therefore blocked; no lifecycle value was inferred or backfilled.

Complete-work mutation check: **0 complete records**, so there is no complete-work mutation to inspect; the check is vacuous. No complete work was marked mutated.

## Verification commands

- TDD targeted suite: **8/8 passed**. The first run failed at the expected missing-module boundary before v039 production code existed.
- `npm run test`: **1117 passed, 0 failed**.
- JavaScript syntax checks: `engine.mjs`, `sketch.js`, and `scripts/brush-v039-probe.mjs` passed `node --check`.
- `git diff --check`: **passed** (exit code 0).
- The JSON registers were parsed by the audit script without errors.
- Local browser matrix: **20/20** raw/canonical runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced-motion. Diagnostics: **0**; overflow failures: **0**; minimum control target: **44px**.
- Interaction evidence: preview kept geometry exact; closed loop changed produced SVG geometry; open loop refused; lift restored the exact baseline; control and Enter committed; Escape released.
- Blind evidence: SVG stayed visible with 16 contours and 4 actual wound holes; readout, controls, hint, and pressure trace were hidden; `innerWidth/clientWidth/scrollWidth = 390/390/390`.
- Local readbacks: works JSON, public catalog, canonical work, raw blind preview, favicon, and rendered Journal anchor/title all returned successfully.

## Evidence limits and next actions

The brush artifact remains **candidate / held** pending production browser verification, independent caption-free perceptual review, and provider revision linkage. No claim of exhibition readiness is made.

Next actions:

1. Resolve the seven historical lifecycle gaps by recording explicit `active` or `complete` values only after confirming their intended state.
2. Re-run the catalogue audit and lifecycle check after that schema repair.
3. Keep `typography-2026-10-27`, `portrait-2026-10-27`, and `brush-2026-10-27` held pending independent caption-free perceptual review and provider revision linkage.

Existing unrelated working-tree changes were preserved; production commit, push, and deployment remain pending.
