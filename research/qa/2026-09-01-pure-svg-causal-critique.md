---
type: studio-pulse
current: svg
role: critic
mode: criticise
status: hold; local evidence complete; no production change
date: 2026-09-01
---

# Pure SVG v001 — causal primitive-budget critique

## Pulse brief

- **Question:** Does the inherited cut materially change the later animal geometry, or is the orange cut only an annotation placed over a stable silhouette?
- **Hypothesis under review:** Under one deterministic primitive budget, refusing the easiest point must force a later silhouette into a visibly different decision. The work must remain an abstract strange animal, not a decorative icon or a caption-dependent diagram.
- **Changed rule being tested:** Read the accepted later silhouette against its refused dashed draft; treat the orange cut and inherited marks as witnesses, not as proof. The critique is about causal legibility, not adding visual polish.
- **Deterministic state:** seed `0x4d555449`; 8 authored stages; 18-primitive budget; passive autonomous timeline; normal and reduced-motion modes; no visitor input.
- **Expected visible consequence:** at a late stage, deleting one inherited cut should change a local point or contour relation enough to identify a changed decision from a caption-free paired replay, while the refused draft remains available for comparison.
- **Falsifier:** deleting an inherited cut leaves the later silhouette visually unchanged at contract display sizes, or the only readable difference is orange/pale marking, scale, or stroke styling.
- **Deletion condition:** delete or hold the primitive-budget memory direction if the later geometry cannot be traced to a prior cut without prose, or if the animal resolves into a generic logo/icon despite the refusal rule.
- **Bounded output / stop condition:** local engine replay/deletion probe, a cache-isolated browser observation at the five contract widths in normal/reduced motion, one visual capture pass, and one independent critique. No engine edit, registry change, promotion, deployment, period claim, or invented tableau.

## Evidence actually observed

### Engine replay and deletion probe

The local engine probe at display stage **05 / 08**, with **2 inherited cuts**, returned:

```json
{
  "seed": "0x4d555449",
  "stages": 8,
  "primitiveBudget": 18,
  "displayStage": 5,
  "memory": 2,
  "replay": true,
  "memoryEffectMaxNormalized": 0.039090172150622604,
  "memoryEffectMeanNormalized": 0.024017950239304947,
  "deletionEffectMaxNormalized": 0.03529873046395202,
  "deletionEffectMeanNormalized": 0.012492796117936387,
  "memoryEffectMaxPxAt267": 10.437075964216236,
  "deletionEffectMaxPxAt267": 9.42476103387519,
  "memoryEffectMaxPxAt1000": 39.09017215062261,
  "deletionEffectMaxPxAt1000": 35.298730463952026,
  "nonzeroMemoryPoints": 9,
  "nonzeroDeletionPoints": 5
}
```

The same seed reproduces the full timeline. Memory shifts all 9 accepted points at the measured stage; deleting the latest inherited cut leaves 5 points shifted above `0.001`. This is real structural dependency in the engine, not a static orange overlay. Machine-readable evidence: `research/qa/proofs/pure-svg-causal-2026-09-01/engine-probe.json`.

### Direct route browser matrix — local-held

A cache-isolated **Chrome 151 CDP** run served `http://127.0.0.1:4179/chantiers/pure-svg/v001/`. Real `Emulation.setDeviceMetricsOverride` and `Emulation.setEmulatedMedia` were applied before each navigation. The matrix covered **320×568, 390×844, 768×1024, 1280×800, and 1920×1080**, each in normal and reduced motion: **10/10 valid runs**.

- All requested `innerWidth × innerHeight` values matched exactly.
- `scrollWidth` equalled `clientWidth` in all runs: no measured horizontal overflow. The existing computed `body { overflow-x: hidden }` is still a latent masking rule and is not treated as a fix.
- The SVG was populated in all runs; the minimum sampled link box was `44×44px`; there were zero form controls.
- Runtime exceptions: `0`; console events: `0`; first-party HTTP `400+` responses: `0`.
- At the first 1.35-second sample, normal and reduced motion both reported `stage 01 / 8`, `0 inherited cuts` at all widths. The reduced-motion query was correctly active in reduced runs, but the authored JavaScript timeline did not settle to a terminal stage.
- The direct route remains explanation-first: SVG top was `588.5px` at `320×568` with `0px` visible in the first viewport; `575.64px` at `390×844` with `235.30px` visible; `533.11px` at `768×1024` with `490.89px` visible; `509.56px` at `1280×800` with `290.44px` visible; and `527.91px` at `1920×1080` with `552.09px` visible.
- Captures and structured matrix: `research/qa/proofs/pure-svg-causal-2026-09-01/results.json` and the twelve PNGs in the same directory.

### Visual observation

The direct 1280px capture shows a restrained dark field with sparse dust strokes, a pale open angular accepted path, a rust dashed refused counter-path, and orange circular cut marks. The two paths are distinguishable, but the geometry reads more as a route diagram or incomplete polygon than as a singular strange animal. The orange marks are more immediately legible than any one cut-to-bend correspondence.

The isolated `?preview=1` route removes the editorial shell and fills the viewport with the artwork. That surface is coherent as a diagrammatic study: the pale path, dashed counter-path, and orange marks share a controlled visual language. It does not yet make the animal premise self-evident, and the open accepted path can look partially disconnected rather than like a deliberate contour.

The exact `320×568` direct capture visibly contains the masthead, navigation, breadcrumb, large title, and premise but no artwork. This is an encounter failure, not a canvas geometry failure.

## Independent critique

An independent critic returned `HOLD` with confidence `0.96`.

- **Accepted:** the changed rule is materially present in the engine: inherited memory shifts the accepted points and deletion changes later geometry. The technical run is robust enough to keep the direction under examination.
- **Accepted:** the work currently coheres as a restrained diagrammatic study, while the animal remains unconvincing and the orange cut marks carry more of the claim than the later bend.
- **Accepted:** the direct route fails work-first encounter at `320×568`, and the reduced-motion path does not settle to a clearly authored terminal state.
- **Resisted:** exact replay, clean runtime, and visible orange marks are not accepted as perceptual proof. They show implementation and state, not that a visitor can identify which inherited cut caused which downstream bend.

## Decision

**HOLD — candidate remains local and unpromoted.** The primitive-budget memory direction survives the engine falsifier because replay is exact and deleting one inherited cut changes later geometry. It does not clear the perceptual art gate: the late field still reads diagrammatically, the specific causal correspondence is not self-evident, the direct route is explanation-first at narrow sizes, and reduced motion remains an intermediate timeline rather than a settled equivalent.

No engine, CSS, registry, atelier, journal, deployment, release, or period change was made by this pulse. WebGPU remains dormant; no tableau was invented.

## Next falsifiable move

Create matched, settled-stage comparisons at `320×568` and `1280×800`: intact memory versus the same stage with only the latest inherited cut deleted, with captions, legend, and orange annotation hidden. Hold every other state constant. An independent observer must identify one repeatable downstream contour correspondence from the field alone; at the same time, reduced-motion must reach the same settled stage as the corresponding normal capture. If either causal identification or settling fails, keep the candidate held and redesign or delete the primitive-budget memory direction rather than adding marks or prose.

## Verification record

- `python research/qa/proofs/pure-svg-causal-2026-09-01/probe.py`: **12/12 captures produced** (10 contract runs plus 2 late-stage captures); all 10 matrix runs recorded zero exceptions, zero console events, zero bad first-party responses.
- `node --input-type=module` engine probe: replay `true`; deletion changes 5 accepted points above `0.001`; max deletion displacement `0.03529873046395202` normalized.
- Browser-tool preview route: isolated canvas-only surface observed; console messages `0`, JS errors `0`.
- Local evidence only. There is no verified public URL or deployment claim for this pulse.
