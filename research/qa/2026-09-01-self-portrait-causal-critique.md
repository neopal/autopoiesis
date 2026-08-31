---
type: studio-pulse
current: portrait
role: critic
mode: criticise
status: hold; local evidence complete; no production change
date: 2026-09-01
---

# Self portrait v001 — causal blind-spot critique

## Pulse brief

- **Question:** Does the inherited blind spot visibly change the later contour, or is it only an orange scar laid over a stable portrait?
- **Hypothesis under review:** At the same deterministic state, a remembered blind spot must bend the later contour enough to be perceived as a changed decision. The work must remain abstract decision geometry, not a human avatar.
- **Changed rule being tested:** Read the later contour as the evidence; treat the orange blind-spot arc and explanatory copy as secondary witnesses, not as proof.
- **Deterministic state:** seed `0x53454c46`; 7 authored stages; passive timeline; normal and reduced-motion modes; no visitor input.
- **Expected visible consequence:** at a late stage, the current pale contour should depart locally from the memory-free/rejected proposal around inherited blind spots, while the dashed refused contour remains available for comparison.
- **Falsifier:** deleting one inherited blind spot leaves the later contour visually unchanged at the contract display sizes, or the contour reads as a generic face/avatar rather than a history of decisions.
- **Deletion condition:** delete or hold the blind-spot direction if the only legible evidence is the orange annotation, if the later contour's structural change is imperceptible without prose, or if the image relies on facial resemblance.
- **Bounded output / stop condition:** local runtime observation, deterministic engine probe, normal/reduced-motion frame capture, and one independent perceptual critique. No engine edit, promotion, deployment, period claim, or invented tableau.

## Evidence actually observed

### Runtime and release-defender matrix

A cache-isolated Chrome 151 CDP run served `http://127.0.0.1:4179/chantiers/self-portrait/v001/`. `Emulation.setDeviceMetricsOverride` and `Emulation.setEmulatedMedia` were applied before each navigation. All five contract widths were run in normal and reduced motion: **10/10 valid runs**.

- `innerWidth` and `innerHeight` matched every requested viewport.
- `scrollWidth` equalled `clientWidth` in all 10 runs; no element box exceeded the emulated viewport.
- No first-party response returned HTTP 400+; `consoleEvents = 0`; `exceptions = 0`; page error collectors stayed empty.
- No `button`, `input`, `select`, or `textarea` controls were present.
- The minimum sampled link box was `44×44px` in every run.
- Normal motion started at `stage 01 / 07`, `00` blind spots; reduced motion settled at `stage 07 / 07`, `03` blind spots.
- At narrow widths the existing `body { overflow-y: auto }` computes `overflow-x: hidden`; this is a latent masking rule, but the probe found no actual over-wide element or range.
- The direct route remains explanation-first: canvas visibility in the first viewport is `3.781px` at `320×568`, `333.844px` at `390×844`, `523.328px` at `768×1024`, `160.5px` at `1280×800`, and `420.438px` at `1920×1080`. The full canvas is below the first viewport at every contract width.

Structured DOM/network evidence: `research/qa/proofs/self-portrait-causal-2026-09-01/results.json`.

Ten normal/reduced captures are retained beside that result file as `portrait-{viewport}-{mode}.png`.

### Engine evidence

The same seed reproduces the same timeline. At display stage `05 / 07`, with two inherited blind spots:

```json
{
  "memoryEffectMaxNormalized": 0.006007471483458757,
  "memoryEffectMeanNormalized": 0.0034662928665549044,
  "deletionEffectMaxNormalized": 0.0031224608560414084,
  "deletionEffectMeanNormalized": 0.0018376566838638534,
  "memoryEffectMaxPxAt1135": 6.818480133725689,
  "deletionEffectMaxPxAt1135": 3.5439930716069985,
  "replay": true
}
```

The effect is structural in the engine, but on the `267px` canvas at `320px` viewport width the corresponding maximum is only about `1.60px`; deleting one blind spot is below `1px` at that width. This does not prove that no viewer could perceive it, but it makes a caption-free causal reading unlikely on mobile.

## Perceptual critique

**Accepted:** the formal criticism that an orange scar is decorative unless the later pale contour visibly and traceably bends because of it. In the late-stage direct and isolated captures, the orange nodes/arcs are more legible than the small contour displacement; the dashed draft/current relation remains diagrammatic, and no single historical scar maps clearly to a later displaced segment.

**Accepted:** the experience criticism that the direct work route must let the artwork arrive before its explanation. The route is technically contained, but at `320×568` and `390×844` the opening title/premise occupies the encounter and the canvas starts at the fold. The isolated `?preview=1` route does fill the viewport, but that does not repair the direct work route.

**Resisted:** the avatar falsifier is not triggered. The angular contour has no eyes, mouth, facial axis, or human symmetry in the observed frames. It reads as abstract decision geometry rather than a person. This is not enough to clear the work: avoiding an avatar is a negative success, not proof of causal legibility.

An independent critic returned `passed: false` and `decision: HOLD`. Its source review agrees that the engine dependency is real but warns that the displacement is small, memory location is not used to map a specific node to a specific contour segment, and the orange marks risk carrying the claim as annotation. It recommended one paired no-caption replay rather than a cosmetic edit.

## Decision

**HOLD — candidate remains local and unpromoted.** No engine or CSS code changed in this pulse. The formal mechanism survives because deletion changes later geometry and replay is deterministic. The perceptual art gate does not: the blind-spot-to-contour causality is not self-evident, and the direct route fails the image-first encounter at narrow sizes. No deployment, release, period, or avatar claim follows.

## Next falsifiable move

Freeze the isolated preview at a late state (`05 / 07` and `07 / 07`) and make a blinded paired replay: intact memory versus the same stage with only the latest stored blind spot deleted. Hide prose, legend, readout, and orange annotation. The next independent critic must identify one repeatable local contour correspondence between the removed blind spot and the changed contour; if it cannot, hold or delete the blind-spot direction instead of adding more marks. Separately, any direct-route re-composition must first be written as its own test-first packet; it is not silently included in this art decision.

## Verification record

- `npm test`: **35 passing / 0 failing**.
- `node --check chantiers/self-portrait/v001/sketch.js`: passed.
- Engine probe: 7 stages, memory deletion changes later contour, replay true.
- CDP browser matrix: **10/10** normal/reduced runs, exact viewport dimensions, zero exceptions, zero console events, zero HTTP 400+ first-party responses.
- Preview route `?preview=1`: isolated canvas only, non-empty, no page furniture.
- No code, registry, atelier, journal, deployment, or public wall change made by this pulse.
- Evidence is local-held only; there is no verified public URL for this pulse.
