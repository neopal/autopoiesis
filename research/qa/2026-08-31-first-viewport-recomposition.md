---
type: studio-pulse
work: handwriting-v002
mode: first-viewport recomposition
status: local pass; awaiting independent review and deployment
date: 2026-08-31
---

# First viewport recomposition — 2026-08-31

## Critique accepted

A deployed `1280×800` capture showed the title and preface occupying the encounter while only the top of the artwork canvas was visible. That violated the work-first rule even though the page was technically valid.

## Change

- desktop opening padding: `12vh 8vw 8vh` → `7vh 8vw 4vh`;
- desktop title: `clamp(52px, 7vw, 112px)` → `clamp(48px, 7vw, 112px)`;
- mobile opening padding: `72px 18px 52px` → `48px 18px 28px`;
- mobile title clamp smoothed to `clamp(48px, 7vw, 52px)`;
- mobile lede reduced to `12px` with a `20px` top margin.

## Evidence

- TDD red: the new first-viewport regression failed against the old `12vh` padding.
- Targeted green: first-viewport test passed.
- Local visual capture at the available desktop viewport showed the canvas entering the first encounter with route memory and refusal marks visible; title and premise remained legible.
- Local CDP matrix after the correction:

| viewport | client width | scroll width | canvas | controls | overflowing elements |
|---|---:|---:|---|---:|---:|
| 320×568 | 305 | 305 | 269×336.25 | 0 | 0 |
| 390×844 | 375 | 375 | 339×423.75 | 0 | 0 |
| 768×1024 | 753 | 753 | 630.125×354.4375 | 0 | 0 |
| 1280×800 | 1265 | 1265 | 1060.21875×596.359375 | 0 | 0 |
| 1920×1080 | 1905 | 1905 | 1192.8125×670.953125 | 0 | 0 |

At emulated `390×844` with reduced motion, `reduced=true`, `scrollWidth=375`, and controls remained `0`.

## Doubt

The breakpoint edge is now continuous in the declared title clamps, but the mobile title is intentionally quieter. A production screenshot at all five sizes remains the next publication check.
