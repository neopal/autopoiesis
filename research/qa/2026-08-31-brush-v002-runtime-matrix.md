---
type: release-gate
work: brush-v002
role: test / experience director
mode: local five-width runtime and reduced-motion regression
status: runtime pass; D1 touch-target and perceptual art gates remain hold
date: 2026-08-31
---

# Brush v002 — runtime matrix and animation regression

## Pulse brief

- **Question:** Does Brush v002 survive a real five-width browser run, including the first animation callback and reduced motion, without losing its authored consequence?
- **Changed rule under test:** A `requestAnimationFrame` timestamp that arrives before the page's `started` timestamp is treated as stage `0`, never as a negative timeline index.
- **Falsifier:** any runtime exception, empty canvas, horizontal overflow/offending element, or reduced-motion frame that does not land on the authored terminal state.
- **Deletion condition:** this timing helper is unnecessary only if the timeline is no longer driven by browser timestamps; the autonomous wound rule remains deletable if its memory-free/deletion replay stops changing later geometry or the wound reads only as decoration.

## RED → GREEN evidence

The pre-fix clean run reproduced:

```text
TypeError: Cannot read properties of undefined (reading 'stage')
at render (.../chantiers/p5-brush/v002/sketch.js:100:34)
at frame (.../chantiers/p5-brush/v002/sketch.js:128:3)
```

A paused call frame showed `now = 11.4`, `started = 18.9`, `elapsed = -7.5`, and `stage = -1`. The first callback therefore addressed `timeline[-1]`.

A narrow regression was added first and failed because `stageIndexAt` was absent. The minimal green change exports `stageIndexAt()` from `engine.mjs` and clamps pre-start elapsed time in `sketch.js`. No seed, stroke rule, wound geometry, visitor interaction, Brush v001 file, or WebGPU state changed in this packet.

## Verification

- Targeted RED → GREEN test: `node --test tests/evolution-catalog.test.mjs --test-name-pattern='Brush v002 starts at stage zero'` — **pass**.
- Full suite: `npm test` — **26 passed, 0 failed**.
- Syntax: `node --check chantiers/p5-brush/v002/engine.mjs` and `node --check chantiers/p5-brush/v002/sketch.js` — **pass**.
- CDP target: local `http://127.0.0.1:4178/chantiers/p5-brush/v002/`, headless Chrome 151, real `Emulation.setDeviceMetricsOverride`, not a scaled screenshot.

| target | inner | client / scroll | canvas CSS box | motion state | exceptions | canvas |
|---|---:|---:|---:|---|---:|---:|
| 320×568 | 320×568 | 305 / 305 | 267×186.30 | stage 01 / 8; reduced → stage 08 / 8, 7 wounds | 0 / 0 | populated |
| 390×844 | 390×844 | 375 / 375 | 337×235.30 | stage 01 / 8; reduced → stage 08 / 8, 7 wounds | 0 / 0 | populated |
| 768×1024 | 768×1024 | 753 / 753 | 715×499.89 | stage 01 / 8; reduced → stage 08 / 8, 7 wounds | 0 / 0 | populated |
| 1280×800 | 1280×800 | 1265 / 1265 | 754×527.19 | stage 01 / 8; reduced → stage 08 / 8, 7 wounds | 0 / 0 | populated |
| 1920×1080 | 1920×1080 | 1905 / 1905 | 754×527.19 | stage 01 / 8; reduced → stage 08 / 8, 7 wounds | 0 / 0 | populated |

The 15px `innerWidth` → `clientWidth` difference is the vertical scrollbar. `scrollWidth` equals `clientWidth` in every case; the element-offender list is empty in every case. There are zero button/input/select/textarea controls. No console events or first-party responses at HTTP ≥400 were observed in the ten runs.

The probe wrote local-held captures for both motion modes at each target size under `research/qa/proofs/2026-08-31-brush-v002-*{motion,reduced}.png`. These are evidence of this working tree only, not deployment evidence.

## D1 hold that remains

The direct route's internal nav and breadcrumb anchors have 44px-high boxes, but the `MUTINE` exit is `62.31×15px` at 320×568 and the footer links are `89.70×12px` / `58.88×12px`. The narrow-screen 44px exit/link gate is therefore **not clear**, even though geometry and overflow pass. The page's canvas begins at y=525.47px on 320×568 and y=561px on 390×844; the title and premise still precede the artwork, so first-encounter priority remains a live experience question.

## Perceptual reading

At the local direct route, a browser visual run at `1249×625` reached `stage 05 / 8` with `4 autonomous wounds` and a non-empty canvas (`toDataURL()` length `155038`). The broad dark brush routes, dashed refusals, pale cuts, and orange/red return marks read as one coherent material field. The accepted criticism is that the wound shapes can still read as pale overlays or annotation; the later stroke's altered direction is not yet unambiguous from the image alone. Technical cleanliness is not being converted into an art promotion.

## Decision / handoff

**Keep Brush v002 as `candidate / held for perceptual critique`.** Brush v001 remains the separate held visitor interaction. WebGPU remains dormant with no tableau. No deployment, commit, public release, or period claim follows from this local packet.

- **Critique accepted:** a browser timing exception and sub-44px exits are release defects, not atmosphere.
- **Critique resisted:** clean runtime evidence does not prove that autonomous wounds earn their later geometry artistically.
- **Next falsifiable move:** a separate narrow TDD packet should make the direct-route brand/footer exits genuinely 44px without shifting the canvas or adding visitor controls; then an independent perceptual read should compare full-memory and one-wound-deleted captures and reject the rule if the later bend is still indistinguishable without the caption.
