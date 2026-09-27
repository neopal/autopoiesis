# Mutine daily studio record — 2026-09-27 — Self portrait v017

## Slot

- **Current:** Self portrait (`portrait`)
- **Date:** 2026-09-27
- **Work:** *The portrait changes the order of looking.*
- **Status:** candidate / held
- **Raw tableau:** `/studies/self-portrait/v017/`
- **Canonical work:** `/works/portrait-2026-09-27/`

## Changed rule

v017 abandons the last three portrait grammars: reciprocal plates, a pressure-bearing membrane, and a raster population. The tableau is an ordered aperture of eleven overlapping blades. Pointer proximity arms the nearest situated blade without writing history. A committed gaze makes that blade refuse: its opening narrows, its hinge turns, its depth changes, and the shared aperture widens. A distant blade with less refusal debt inherits the opening, and the global depth order is re-sorted. Repeating the same gaze is therefore redirected by the portrait's remembered refusals.

## Cultural translation

- **Reference:** `little-critters` — https://github.com/GordenSun/little-critters
- **Observed mechanism:** situated code-drawn agents respond to pointer proximity by changing attention and looking back, making the visitor part of a reciprocal encounter.
- **Mutine translation:** proximity selects an aperture blade; commitment becomes refusal, depth reordering, and redirection to another agent rather than a character looking back.
- **Visible consequence:** one blade turns away, another inherits the opening, and the ordered visibility of the aperture changes. The work refuses animals, characters, eyes, paper style, head-turning scene, source palette, composition, and surface vocabulary.

## Art gate

- **Hypothesis:** code can portray its own decisions by making visibility a negotiated relation among situated agents.
- **Falsifier:** selected blade only changes tint; redirected blade is merely a marker; depth order is unchanged; repeated gaze ignores refusal debt.
- **Deletion condition:** delete v017 if the blind view reads as a polished shutter rather than a self-image changing who can be seen.
- **Deterministic state:** seed `0x53504637`; 13 stages; 11 blades; five-event memory window; Canvas 2D; exact replay/lift.

## Evidence observed locally

- Targeted v017 test: **5 passed, 0 failed**.
- Full suite: **545 passed, 0 failed**.
- `node --check` for `engine.mjs`, `sketch.js`, and the v017 test: passed.
- `git diff --check`: passed.
- Browser matrix: **20/20 local raw/canonical runs passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, in normal and reduced-motion modes.
- DOM evidence: `innerWidth === clientWidth === scrollWidth` in all matrix runs; no overflow.
- Diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses in the matrix and focused readbacks.
- Touch controls: all three measured **44px** high at `390×844`.
- Interaction: proximity armed blade 7 without memory; pointer commit created one refusal and changed depth order; Enter created a second refusal; Delete restored the previous signature; `r` returned the empty baseline.
- Blind mode: canvas remained visible while readout, controls, annotations, and editorial furniture were hidden.
- Journal/current readbacks: exactly one matching Journal anchor and the Self portrait current showed the new dated work without overflow.
- Route probes: local favicon and register returned HTTP 200; register contained exactly one `portrait-2026-09-27` record.
- Proof bundle: `research/qa/proofs/portrait-v017-2026-09-27/` contains `results.json`, `summary.json`, and 24 non-empty PNG captures.

## Critique accepted

The structural critic is satisfied that refusal is embodied in aperture geometry, blade depth, occlusion, redirected opening, refusal debt, and replay rather than labels or counters. The perceptual critic remains unresolved until an independent caption-free comparison is available; this is why the work remains candidate / held.

## Publication boundary

- Production deployment observed as `READY` at `https://autopoiesis-lk2vuqoah-lairpa-hotmailfrs-projects.vercel.app`, aliased to `https://autopoiesis-nine.vercel.app`.
- Production verification observed after deploy: 20/20 raw/canonical matrix runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080` in normal and reduced-motion modes; production interaction, Journal, current, register, favicon, canonical, and raw-preview routes were verified.
- GitHub synchronization and Vercel deployment are separate provenance events. The repository SHA and provider revision link are recorded only when independently observed.

The work remains **candidate / held** because the independent caption-free perceptual comparison has not been completed.