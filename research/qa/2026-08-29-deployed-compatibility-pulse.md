---
type: qa-pulse
mode: test
date: 2026-08-29
url: https://autopoiesis-nine.vercel.app/?rev=d772d62
status: blocked
---
# Deployed compatibility pulse — 2026-08-29

## Pulse brief

- **Active/chosen chantier:** P0 responsive compatibility: period field plus the two active v001 routes.
- **Question:** Does the deployed public surface expose its current routes and evidence without a browser-level failure?
- **Mode:** `test`.
- **Falsifier:** any required route or first-party asset fails, or the browser matrix cannot be evidenced.
- **Bounded output / stop condition:** one deployed probe, DOM/gesture record, and handoff; stop once release blockers are classified. No production change or release claim.

## Observed deployment

Exact tested deployment: `https://autopoiesis-nine.vercel.app/?rev=d772d62`.

- `npm test`: **5/5 passing** locally (catalogue/content assertions only).
- HTTP probes returned `200` for `/`, `/galerie/`, both active v001 routes, and both field-test routes.
- First-party gallery assets (`field.css`, `field.js`, `studio.json`, `evolutions.json`) returned `200`.
- Browser error collectors (window `error` and `unhandledrejection`) recorded no entries on `/`, Brush v001, or Handwriting v001 at 390×844. This is page-event evidence, not a substitute for fixing the failed geometry.

## DOM compatibility matrix — active public routes

Tested on the deployed URL with Chrome DevTools viewport emulation. `scrollWidth` is DOM evidence; target minimum is the smallest rendered `a`, `button`, or input dimension.

| viewport | field `/` scroll width | Brush scroll width | Handwriting scroll width | result |
|---|---:|---:|---:|---|
| 320×568 | 650 | 320 | 320 | field overflows; all routes include sub-44px interactive targets |
| 390×844 | 792 | 390 | 375 | field overflows; all routes include sub-44px interactive targets |
| 768×1024 | 1170 | 768 | 753 | field overflows |
| 1280×800 | 1682 | 1280 | 1265 | field overflows |
| 1920×1080 | 2322 | 1920 | 1905 | field overflows |

The field root failed `scrollWidth ≤ viewport` at **all five** contract sizes. The rendered minimum interactive dimensions were 13px (field), 15px (Brush), and 16px (Handwriting); on narrow screens this fails the 44px requirement. Brush and Handwriting had no horizontal overflow in this sample, but their small text links/navigation still prevent a compatibility pass.

## Interaction evidence

At the mobile field composition, a real pointer click on the visible Handwriting node opened the inspector. A real `j` key event then selected Brush and changed the inspector title to **“A mark must lose something.”** Therefore pointer and keyboard paths exist for field selection. Touch equivalence and meaningful reduced-motion behavior were not independently completed in this bounded packet.

## Consequence

This deployment is **not shippable** under D1. The P0 claim has changed from a small-screen-only hypothesis to an observed root-field overflow at every contract viewport, plus a separate touch-target deficit across the active routes. No work/spike promotion and no release claim follow from this pulse.

## Handoff

- **Changed rule:** none; this was a test-only packet. The enforced reading is now: DOM overflow at one contract width blocks release, and this field fails all five.
- **Observed consequence:** desktop screenshots can look composed while the root DOM is wider than its viewport; the page must be treated as failed, not clipped or cosmetically accepted.
- **Criticism accepted / resisted:** accepted the 2026-08-28 audit’s responsive warning; resisted no criticism because no visual revision was attempted.
- **Next question:** can the period field be recomposed with a viewport-bounded canvas/layout and 44px mobile paths without masking overflow?
- **Hypothesis died:** no art hypothesis died; the release-readiness assumption died.
