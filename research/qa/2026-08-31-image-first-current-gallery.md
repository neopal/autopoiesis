# QA — image-first current and work gallery

Date: 2026-08-31
Scope: local working tree in `C:\Users\ASUS\autopoiesis`

## Decision

The public indexes now lead with visual work surfaces instead of text-only rows.

- `/courants/` shows exactly six current cards with a preview frame each.
- Handwriting and Brush use the real recorded work routes as non-interactive previews.
- Self portrait, Pure SVG, Naive art, and WebGPU use an empty `NO WORK / QUESTION HELD` frame. No dormant artwork is fabricated.
- `/oeuvres/` shows the three recorded evolution entries as visual cards.
- The two field tests appear in a separate visual section with `field-preview`, not `work-preview`.
- The `/atelier/` wall uses the real Handwriting v002 and Brush v001 surfaces for its two active plates; its four dormant plates remain honest empty/question states.
- Handwriting and Brush current pages show their recorded versions as large visual work records.
- Related field tests on those pages also retain a visual preview while remaining classified as field tests.

## Preview behavior

The recorded routes accept `?preview=1` for index thumbnails. Preview mode hides the surrounding masthead, annotations, controls, and navigation while preserving the actual canvas/SVG surface:

- Handwriting v001: painted canvas observed.
- Handwriting v002: autonomous route field observed, including refusals/scars.
- Brush v001: painted canvas observed; controls hidden in preview.
- Writing field test: deterministic SVG field observed; time controls hidden in preview.

The preview iframes have `pointer-events: none`, `loading="lazy"`, and an accessible title while the surrounding catalogue link remains the navigation target. Direct work routes retain their full interaction/documentation where applicable.

## Evidence

- `npm run test`: 20 passed, 0 failed.
- `node --check chantiers/typographie-manuscrite/v001/sketch.js`: passed.
- `node --check chantiers/typographie-manuscrite/v002/sketch.js`: passed.
- `node --check chantiers/typographie-manuscrite/v002/engine.mjs`: passed.
- `git diff --check`: passed.
- Browser console on the inspected preview/current routes: 0 messages, 0 JavaScript errors.
- Local HTTP probes returned `200` for the two indexes, all five preview routes, and `/galerie/studio.css`.
- Desktop visual inspection confirmed image-first hierarchy, painted previews, honest dormant frames, and no visible horizontal overflow.

## Responsive gate

The gallery CSS has explicit recomposition at `900px` and `650px`:

- three columns → two columns → one column;
- work records recompose from two columns to one;
- preview aspect ratio changes to a taller mobile frame;
- iframes remain width-constrained by their parent surface.

A fresh CDP viewport matrix was not executed in this run because the historical Chrome endpoint at `127.0.0.1:9228` was unavailable and no local Chrome/Playwright executable was present. This is an open runtime gate, not a claim of full mobile verification.

## Classification hold

This visual pass changes presentation, not artistic status:

- Brush remains a held interaction.
- Handwriting v002 remains a candidate held for perceptual critique.
- Loss and Writing remain field tests.
- Dormant currents remain questions without works.
