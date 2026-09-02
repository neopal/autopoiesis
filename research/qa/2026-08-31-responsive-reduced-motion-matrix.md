# Responsive and reduced-motion matrix — 2026-08-31

## Scope

This is the exact viewport gate for the five current autonomous candidates:

- Handwriting v002 — `/chantiers/typographie-manuscrite/v002/?preview=1`
- Self portrait v001 — `/chantiers/self-portrait/v001/?preview=1`
- Pure SVG v001 — `/chantiers/pure-svg/v001/?preview=1`
- Naive art v001 — `/chantiers/naive-art/v001/?preview=1`
- Brush v002 — `/chantiers/p5-brush/v002/?preview=1`

Each route was loaded through a local Chrome CDP target. `Emulation.setDeviceMetricsOverride` was used before navigation, and `Emulation.setEmulatedMedia` selected `prefers-reduced-motion: no-preference` or `reduce`.

## Matrix

| Viewport | Normal | Reduced motion | DOM viewport verified |
|---:|---:|---:|---:|
| 320 × 568 | 5/5 | 5/5 | 10/10 |
| 390 × 844 | 5/5 | 5/5 | 10/10 |
| 768 × 1024 | 5/5 | 5/5 | 10/10 |
| 1280 × 800 | 5/5 | 5/5 | 10/10 |
| 1920 × 1080 | 5/5 | 5/5 | 10/10 |

Total: **50/50 captures**.

## Observed technical results

- Requested and observed `innerWidth`/`innerHeight` matched for all 50 runs.
- `document.documentElement.scrollWidth` never exceeded the requested width.
- Preview pages were measured as isolated surfaces; their document height was contained by the preview shell. Documentary routes are intentionally scrollable and are not judged against viewport height.
- All 50 renders were visually non-uniform; no blank work surface was observed.
- All 50 isolated routes exposed zero `button`, `input`, `select`, or `textarea` controls.
- All 25 reduced-motion runs reported `matchMedia('(prefers-reduced-motion: reduce)').matches === true`.
- Pure SVG v001 renders an SVG rather than a canvas; the probe therefore counts its visible SVG surface, not a canvas pixel length.

## Visual read

The five works remain composed at the narrowest tested view. Naive art keeps the house, door, tree, path, and status inside the 320px surface. Brush keeps its four strokes, current wound, return label, and status inside the same surface. Handwriting, Self portrait, and Pure SVG retain their central compositions without visible edge loss in the inspected 320px captures. Reduced-motion retains a complete still state for all five works.

The 50 generated image proofs are stored under `research/qa/proofs/viewport-cdp/`. The machine-readable preview probe result is `research/qa/proofs/viewport-cdp/results.json`.

## Direct-route mobile exit audit

After the first mobile pass identified sub-44px masthead/footer exits, `galerie/wayfinding.css` was hardened with shared `44px` minimum width and height rules for both current `.studio-*` markup and the older `.masthead` / `body > footer` markup.

The direct routes were then reloaded through the same CDP probe at `320 × 568` and `390 × 844`, in normal and reduced-motion modes:

- 20/20 exact DOM viewports;
- 0 horizontal overflow cases;
- 0 blank artwork surfaces (canvas or SVG);
- 0 visitor controls on autonomous works;
- 0 visible links below `44 × 44`;
- 0 reduced-motion emulation mismatches.

The machine-readable direct-route result is `research/qa/proofs/viewport-cdp/direct-mobile-results.json`.

## Console and runtime gate

An earlier browser run exposed anonymous exceptions from timeline previews. A targeted CDP exception probe traced them to a first-rAF negative stage: Pure SVG, Self portrait, and Naive were calling `render(undefined)`; Brush already had the bounded `stageIndexAt` helper. The four autonomous timeline sketches now clamp their stage index to a valid frame.

Post-fix verification: the cache-disabled CDP probe on `/courants/` and all five embedded previews returned `exceptions: []` and `logs: []`; a cache-busted Hermes browser navigation returned `0` console messages and `0` JavaScript errors. This is a clean local console/runtime pass, not deployed evidence.

## Decision

**Responsive composition gate: PASS for the tested local candidates.**

**Reduced-motion composition gate: PASS for the tested local candidates.**

This does not promote any candidate to validated work. Independent perceptual critique and deployment truth remain separate gates.

## Next falsifiable move

Independent perceptual verdicts are now separated by revision: Brush v002 is **KEEP locally** with release verification open; Naive art v001 remains **HOLD** after three reviews because its accepted/refused relation still merges at narrow sizes. The next Naive move is one deliberately separated composition, or deletion/continued hold if the rule still depends on caption support. No candidate is promoted by this QA pass.
