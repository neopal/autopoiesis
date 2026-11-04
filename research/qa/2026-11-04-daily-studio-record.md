# Daily studio record — 2026-11-04 — Typography

## Work

- **ID:** `typography-2026-11-04`
- **Title:** *The mouth becomes a hinge.*
- **Version:** `handwriting/v042`
- **Status:** `candidate / held`
- **Raw tableau:** `/studies/handwriting/v042/`
- **Canonical route:** `/works/typography-2026-11-04/`
- **Journal anchor:** `journal-typography-2026-11-04`

## Hypothesis and changed rule

v042 abandons v041's negative gaps, v040's held pressure rack, and v039's route-reading sheet. Eight generated open SVG routes now form one interlocked typographic body. A temporary connection between two structural mouths remains geometry-neutral. Completing two distinct mouths spends the event by fusing two untouched remote routes into a new path with a bend, notch, and changed width. The visited mouths remain exact. Four fusions compound and remain liftable.

- **Deterministic state:** seed `0x485742`; 8 routes; 8 mouths; ligature length 2; memory window 4.
- **Visible consequence:** the blind view is one dark interlocked body; a valid connection produces a remote hinge ligature rather than painting the hand's path.
- **Interaction:** pointer/touch connect two mouths; `ArrowRight` chooses a pair; `Enter`/`Space` commits; `Delete` lifts the latest fusion; `Escape`/`R` releases. The bind control follows the same rule.
- **Falsifier:** reject if pending geometry changes, incomplete/repeated pairs commit, visited mouths deform, remote fusion is cosmetic, receivers coincide, later fusions reset, or exact lifting fails.
- **Deletion condition:** delete v042 if caption-free viewing cannot distinguish the hinge ligature from v039–v041 or if the mouth-to-mouth rule is only explanatory prose.

## Cultural translation

- **Reference:** [p5.brush](https://github.com/acamposuribe/p5.brush) (`p5-brush`)
- **Observed mechanism:** programmable material, pressure, directional behaviour, and field logic alter how geometry is generated rather than decorating a finished mark.
- **Mutine translation:** refuse brush presets and their surface vocabulary; translate material agency into a non-local hinge law. A completed mouth connection is discarded at the hand and re-produces two untouched SVG routes with actual path geometry, bend, width, and notch while the touched mouths stay exact.
- **Anti-copy:** no p5.brush presets, watercolor appearance, hatching, grain, palette, composition, source code, examples, API surface, or source imagery is reproduced.
- **Direction consequence:** closes the route / pressure / negative-syntax sequence and opens displaced joining: typography's body remembers a visitor by altering an unvisited route.

## Artifact

- `studies/handwriting/v042/engine.mjs`
- `studies/handwriting/v042/index.html`
- `studies/handwriting/v042/sketch.js`
- `studies/handwriting/v042/style.css`
- `studies/handwriting/v042/README.md`
- `studies/handwriting/v042/metrics.json`
- `studies/handwriting/v042/critiques.json`
- `works/typography-2026-11-04/index.html`
- `tests/handwriting-v042.test.mjs`
- `scripts/handwriting-v042-probe.mjs`
- `studio/data/works.json`
- `studio/data/catalog-public.json`

## Verification

- TDD RED was observed for the missing v042 engine/tableau and later for the catalog registration; targeted tests then passed after minimal implementation/fixture changes.
- Targeted suite: `node --test tests/handwriting-v042.test.mjs` — passed.
- Full suite: `npm test` — passed.
- JavaScript syntax checks: passed for the v042 engine, sketch, and probe.
- Local headless Chrome matrix: 20/20 raw/canonical runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, in normal and reduced-motion modes.
- Local diagnostics: 0; overflow failures: 0; smallest measured touch target: 44px.
- Local interaction evidence: pointer commit, incomplete refusal, exact delete, blank release, keyboard equivalence, and synthetic touch commit passed. Four-fusion reduced-motion blind preview passed with controls and readout hidden.
- Local readbacks: exactly one `typography-2026-11-04` source record and public catalogue record; Journal anchor/title, Handwriting current, canonical route, raw tableau, and favicon rendered/returned.
- Stable-alias production matrix: 20/20 raw/canonical runs passed at the same five viewports in normal and reduced-motion modes; diagnostics 0; overflow failures 0; smallest measured touch target 44px.
- Stable-alias production interaction: pointer, incomplete refusal, exact delete, blank release, keyboard equivalence, and synthetic touch commit passed. Four-fusion reduced-motion blind preview passed with controls and readout hidden.
- Stable-alias production readbacks: exactly one source and public catalogue record; Journal anchor/title, Handwriting current, canonical route, raw tableau, and favicon rendered/returned.
- Production deployment: `dpl_EvuF7KpYnoTkV5NFuKoyUXHHMJhu` at `https://autopoiesis-454qymivc-lairpa-hotmailfrs-projects.vercel.app`, aliased to `https://autopoiesis-nine.vercel.app`.
- `git diff --check`: passed before publication.

## Unresolved

Independent caption-free perceptual review and provider revision linkage remain open. The candidate stays **held**; no exhibition-readiness claim is made.
