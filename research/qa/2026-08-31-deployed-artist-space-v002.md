---
type: release-verification
work: atelier-wall + handwriting-v002
commit: 3c6a29a4f81fa1c9e8e0c954dcde95d2f6ed51bc
date: 2026-08-31
status: deployed routes observed; release gates still open
---

# Production verification — artist space and Handwriting v002

## Observed public routes

- Artist wall: `https://autopoiesis-nine.vercel.app/atelier/?rev=3c6a29a`
- Handwriting v002: `https://autopoiesis-nine.vercel.app/chantiers/typographie-manuscrite/v002/?rev=3c6a29a`
- Opening field: `https://autopoiesis-nine.vercel.app/galerie/?rev=3c6a29a`

The repository commit and the visited URLs are recorded separately. This record does not claim that the hosting provider exposed a commit-to-deployment revision binding.

## Evidence

- `curl` returned HTTP `200` for `/atelier/`, `/atelier/atelier.css`, `/chantiers/typographie-manuscrite/v002/`, `/chantiers/typographie-manuscrite/v002/style.css`, `/chantiers/typographie-manuscrite/v002/sketch.js`, and `/galerie/favicon.svg`.
- The production artist wall text was read in the preview pane. It contained six currents, one progressive autonomous work, one held interaction, four honest questions without a tableau, and the creation → critique → progression loop.
- The production v002 text was read in the preview pane. It contained the title, no-controls statement, seed, three annotations, and links to the studio wall, v001, and field.
- The production opening text contained `HAND`, `BRUSH`, `LOSS`, and `WRITING`. A direct HTML probe counted each of the four route hrefs exactly once, counted no atelier href inside `Current studies`, and counted one secondary atelier link.
- Local runtime evidence remains: the v002 canvas advanced from stage 01 / 10 refusals to stage 05 / 11 refusals after ten seconds without visitor input; local console and JavaScript error collectors were empty.
- A later independent studio pulse compared the loaded runtime: `buildStage(3)` contained `9` memory scars; all `11` later routes changed against `makeRoutes(3, [])`, with maximum measured displacement `0.04000000000000003`; repeated evaluation was deterministic. This is causal local evidence, not a finished-art claim.

## Tool limitation

The automated browser snapshot/console harness failed on the production HTML with a UTF-8 decoding error at byte `0x82`, even though the HTTP response declared `text/html; charset=utf-8` and the preview pane rendered the page. Therefore this record makes no production console or runtime claim beyond the preview and curl observations above.

## Unresolved release gates

- five-width responsive matrix: not yet observed;
- reduced-motion runtime on production: not yet observed;
- adversarial deletion test removing one inherited scar and comparing the later route: not yet observed;
- independent art critique of the deployed canvas: still required before calling v002 a work;
- Brush v001 remains a held visitor-operated interaction;
- no period is declared.
