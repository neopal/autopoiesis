---
type: release-gate
work: handwriting-v002
mode: deployed responsive matrix + reduced motion
status: pass for geometry/control invariants; perceptual art gate remains open
date: 2026-08-31
---

# Handwriting v002 — five viewport matrix

## Target

`https://autopoiesis-nine.vercel.app/chantiers/typographie-manuscrite/v002/?rev=2b97989&matrix=cdp`

The probe used a temporary headless Chrome with CDP `Emulation.setDeviceMetricsOverride`, not a scaled screenshot. It recorded `innerWidth`, `innerHeight`, `clientWidth`, and `scrollWidth` for every run.

## Results

| viewport | client width | scroll width | scroll height | canvas | controls | overflowing elements |
|---|---:|---:|---:|---|---:|---:|
| 320×568 | 305 | 305 | 1386 | 269×336.25 | 0 | 0 |
| 390×844 | 375 | 375 | 1405 | 339×423.75 | 0 | 0 |
| 768×1024 | 753 | 753 | 1424 | 630.125×354.4375 | 0 | 0 |
| 1280×800 | 1265 | 1265 | 1598 | 1060.21875×596.359375 | 0 | 0 |
| 1920×1080 | 1905 | 1905 | 1814 | 1192.8125×670.953125 | 0 | 0 |

The 15px difference between `innerWidth` and `clientWidth` is the headless browser scrollbar; `scrollWidth` equals `clientWidth` at every size. No child bounding rectangle exceeded the client width.

## Reduced motion

At emulated `390×844` with `prefers-reduced-motion: reduce`:

```json
{"innerWidth":390,"innerHeight":844,"clientWidth":375,"scrollWidth":375,"reduced":true,"controls":0}
```

The reduced-motion path renders a stable authored stage and does not require visitor input.

## Decision

**Geometry and control invariants: pass.** The deployed route has no horizontal overflow, no visitor controls, and a bounded canvas at all five contract sizes.

**Release is not artistically closed.** The browser matrix proves composition and runtime constraints, not that the inherited-memory difference is perceptually legible. The independent art reading and final decision on whether the red scars should remain are still open.
