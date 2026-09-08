# v004 response / evidence ledger

## Work packet

- **Target:** typography / Handwriting
- **Date:** 2026-09-04
- **Title:** The sentence loses its place.
- **Changed rule:** a remembered refusal opens a structural lost beat and displaces the later re-entry; no second branch is generated.
- **Raw tableau:** `/studies/handwriting/v004/`
- **Canonical record:** `/works/typography-2026-09-04/`
- **Status:** candidate / held

## Source and test evidence

- `handwriting-v004` engine test passed: stage `8` contains a remembered refusal, later routes carry `pause` / `gapStart` / `reentryPoints`, no route exposes `branchPoints`, and omitting one refusal changes the downstream route signature.
- Tableau contract test passed: the raw page exposes the canonical raw-work id, canvas, preview mode, lift/restore actions, and a polite live state.
- Deterministic engine probe returned `72` retained refusals, `13` routes, `13` settled lost beats, and a non-zero route delta after omission (`0.716751` in normalized point distance).

## Browser evidence actually obtained

- Local raw preview loaded at the tool viewport `1264×625`; the canvas filled that viewport and `scrollWidth` matched `clientWidth` (`1264`), with a visually layered dark field of pale single routes, visible gaps/re-entries, faint ruled strata, and small coral refusal witnesses.
- The canonical `/works/typography-2026-09-04/` route loaded its data-driven detail page. Its iframe tableau appeared before the timeline in the accessibility snapshot, and the two action buttons were present with `44px` minimum height.
- The bounded embedded-iframe click attempt produced no observable state delta. Direct raw interactive navigation returned a browser-tool UTF-8 decoding error. A subsequent unchanged snapshot triggered the browser tool's idempotent/no-progress guardrail; browser probing stopped as required.

## Critique held open

The visual direction is intentionally held. The useful change is removing the green second hand and making memory one route with a missing beat. The unresolved doubt is whether the gap/re-entry reads as a necessary changed cadence rather than an attractive break, especially without the coral witnesses. Responsive matrix, reduced-motion, confirmed browser interaction, network-failure log, and independent caption-free comparison remain unresolved. No release or deployment claim is made.
