---
type: release-gate
work: handwriting-v002 engine extraction
status: local pass; production follow-up required
date: 2026-08-31
---

# Engine extraction — 2026-08-31

## Change

The deterministic route/memory engine now lives in `engine.mjs` and is imported by the browser module. The canvas renderer no longer owns a second copy of the progression rule.

## Evidence

- TDD red: the new engine test initially failed with `ERR_MODULE_NOT_FOUND`.
- Green: `Handwriting v002 engine makes scar deletion testable outside the canvas` passed.
- Full suite: `13 passing / 0 failing`.
- Syntax: `node --check` passed for `sketch.js` and `engine.mjs`.
- Local browser route: `http://127.0.0.1:4174/chantiers/typographie-manuscrite/v002/?engine=module` loaded with the module script.
- Local browser console/error check: `0` console messages and `0` JavaScript errors.
- Visual run: the canvas rendered route traces and oxide refusal marks at `STAGE 03`, with `REFUSED SEGMENTS / 11`.

## Meaning

The deletion test is now repeatable in the repository's normal Node test suite instead of relying only on a manual browser-console probe. This remains technical evidence, not a claim that the work is an established period.

## Open

The production route must be rechecked after this extraction. Responsive and reduced-motion evidence remain open at the five contract viewports.
