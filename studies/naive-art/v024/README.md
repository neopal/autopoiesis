# Naive art v024 — The picture misreads its own shadow

Status: daily candidate, held for independent caption-free perceptual review.

## Hypothesis

A naive picture can keep a mistake as a wrong reconstruction rather than a damaged piece. If a visitor approaches one plane and then departs, the plane should hinge and change depth while a distant plane rebuilds itself from the wrong cast shadow. The error must live in spatial geometry, not in an annotation, counter, or cursor effect.

## Cultural translation

The selected reference is [`little-critters`](https://github.com/GordenSun/little-critters). Its observed mechanism is that situated agents respond to pointer proximity by changing attention and looking back, making the visitor part of a reciprocal encounter rather than a dashboard operator. v024 refuses animals, eyes, character design, paper scene, source palette, and head-turning imagery. It translates reciprocal attention into a paper-theatre rule: proximity only arms a plane; departure commits a hinge/depth change and makes a non-adjacent plane reconstruct itself from the wrong shadow.

## Changed rule

v021 used disjoint SVG rooms, v022 used browser-native cut-out slots, and v023 used a continuous Canvas route. v024 changes representation, composition, encounter, and memory together:

- the picture becomes one p5.js WebGL paper theatre of nine faceted planes, not a map, register, or route;
- pointer proximity arms a situated plane without writing memory;
- leaving the field commits the event: the approached plane changes depth and hinge;
- a non-adjacent plane inherits the changed cast shadow and changes its own depth, hinge, and shadow offset;
- later departures use the remembered shadow state to choose a different reply;
- lifting the latest misread reconstructs the exact preceding theatre.

The gesture is `approach → depart → wrong shadow → reconstruction`.

## Visible consequence

- the blind first view is a layered paper theatre with actual depth cues, faceted silhouettes, seams, and cast shadows;
- pointer movement alone and a short pointer tap do not write history;
- a committed departure changes two plane geometries: a local hinge/depth shift and a distant answering shadow;
- the bounded four-event window retains misread reconstructions, while undo removes only the newest and release restores the seeded theatre.

## Art gate

- **Seed/state:** `0x4e413234`, nineteen deterministic stages, four-event visible memory window; reduced motion/static preview settles on the final retained state.
- **Expected consequence:** one approach-departure changes local and non-local plane geometry, visibly before any explanation is read.
- **Falsifier:** if the event only changes a marker, if the distant plane does not move, if proximity commits, or if the blind theatre reads as a generic 3D card wall, the translation fails.
- **Deletion condition:** delete v024 if caption-free comparison cannot distinguish `wrong shadow → reconstruction` from v021's rooms, v022's slots, and v023's wrong-landing route, or if the relation needs the readout and controls to be understood.

## Interaction

Move into a plane to arm it. Leave the theatre to commit one shadow misread. A short tap is refused. The **misread a shadow** control, `Enter`, and `Space` commit the seeded event; `Delete`/ **lift latest** removes only the newest remembered misread; `R`/ **release theatre** clears visitor memory. `S` saves the measured state as JSON.

## Evidence boundary

The deterministic p5.js WebGL scene engine, approach/departure threshold, exact undo, responsive shell, and browser evidence are recorded in `metrics.json` and the dated QA proof. The candidate remains held for independent caption-free perceptual review and provider revision linkage; runtime evidence is not perceptual approval.
