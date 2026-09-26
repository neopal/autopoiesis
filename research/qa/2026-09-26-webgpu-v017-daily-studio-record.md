# Mutine daily studio record — 2026-09-26 / WebGPU v017

## Slot

- Current: WebGPU
- Date: 2026-09-26
- Work: **The crowd misses its own beat.**
- Status: **candidate / held**
- Raw tableau: `/studies/webgpu/v017/`
- Canonical work: `/works/webgpu-2026-09-26/`
- Lineage: `webgpu-2026-09-25` → v017

## Hypothesis and rupture

A crowd can become an archive without adding bodies or drawing a brighter field: if one cohort is forced to arrive late, the work should keep both the missing beat and the delayed arrival visible as a temporal relation.

The material rupture is a change of medium and encounter:

- v014 pressure surface → v015 cavity wall → v016 interlaced graph scaffold
- v017 broad temporal score of irregular bands
- drag / witness / proximity are refused as causal gestures
- Enter, Space, or the advance control commits a discrete quorum turn
- one actual cohort leaves its present band, appears later, and leaves a gap
- Delete lifts the latest turn; release reconstructs the untouched score

The rupture is visible in code (`advanceTurn`, displaced segment placement, source gaps, bounded memory) and in the tableau renderer (broad strata, gaps, later arrival, delay path).

## Cultural translation

- Reference: **little-critters** — https://github.com/GordenSun/little-critters
- Observed mechanism: situated code-drawn agents respond to proximity by changing attention and looking back, making the visitor part of a reciprocal relation.
- Mutine translation: refuse the look-back and translate situated attention into a turn-taking delay. A discrete quorum advance removes an actual cohort from the present band and lets it arrive later; the score remembers the missed beat as a gap.
- Visible consequence: pointer movement and drag do not alter the score; a committed turn changes the order and placement of a real band segment, leaving a source slit and later cohort.
- Falsifier: if a short click or pointer movement changes the score, if the gap is only a dark sticker, if delayed arrival is only a glow/label, if intervening bands do not tighten, or if the blind field reads as v016's scaffold, the translation fails.
- Anti-copy: no animals, characters, eyes, paper style, source palette, composition, or head-turning surface vocabulary is reproduced.
- Direction consequence: closes WebGPU v014's pressure-surface, v015's cavity, and v016's mutable-graph grammars; opens temporal computation where the crowd is archived as order, delay, and absence.

## Artifact files

- `studies/webgpu/v017/index.html`
- `studies/webgpu/v017/engine.mjs`
- `studies/webgpu/v017/sketch.js`
- `studies/webgpu/v017/style.css`
- `studies/webgpu/v017/README.md`
- `studies/webgpu/v017/metrics.json`
- `studies/webgpu/v017/critiques.json`
- `works/webgpu-2026-09-26/index.html`
- `tests/webgpu-v017.test.mjs`
- `studio/data/works.json`
- `studio/data/catalog-public.json`

## Local evidence

- TDD red observed before implementation: `node --test tests/webgpu-v017.test.mjs` failed because v017 engine/tableau/register did not exist.
- Targeted TDD green: **4 passed, 0 failed**.
- Full suite: **533 passed, 0 failed**.
- JavaScript syntax checks: `engine.mjs`, `sketch.js`, and local probe passed `node --check`.
- Browser probe: `research/qa/proofs/webgpu-v017-2026-09-26/probe.mjs`.
- Local browser matrix: **20/20 passed** — canonical and raw tableau at `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`, normal and reduced motion.
- Local tableau order: **10/10 canonical runs** placed the iframe before title and explanatory prose.
- Local diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses.
- Local overflow: **0** failures; `innerWidth`, `clientWidth`, and `scrollWidth` matched in every matrix run and focused readback.
- Interaction: short click unchanged; drag unchanged; Enter changed the score; Delete restored the exact preceding score; release cleared memory.
- Reduced-motion blind mode: canvas visible, readout/controls/caption/annotations hidden, stage `16`, memory `4`.
- Touch targets: all three controls measured `44px` high at `390×844`.
- Journal: exactly one `#journal-webgpu-2026-09-26` entry in the local readback.
- WebGPU current: exactly one latest work rendered in the local current readback.

## Release decision

**Candidate / held.** The structural and runtime gates passed locally. The unresolved artistic question is whether the first-render, labels-off score reads as a temporal-computation rupture — a cohort actually missing and arriving late — rather than as v016's spatial scaffold flattened into horizontal ribbons. Production readback and provider revision linkage remain pending.

Deletion condition: if two independent caption-free comparisons cannot distinguish source gap and delayed cohort from decorative overlays, delete v017 rather than polishing the controls or prose.
