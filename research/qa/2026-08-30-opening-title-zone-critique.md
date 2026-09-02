---
type: critique-pulse
mode: criticise
date: 2026-08-30
scope: uncommitted gallery opening title-zone correction
status: local correction retained; deployment and D1 release remain hold
---
# Opening title-zone critique — 2026-08-30

## Pulse brief

- **Active/chosen chantier:** the existing gallery opening-field correction; no third chantier opened.
- **Question:** Does subtracting the live title rectangle produce a legible threshold without turning the field into merely decorative wallpaper or falsely clearing the broader release block?
- **Mode:** `criticise`.
- **Falsifier:** an observed local run still crosses the `PUBLIC STUDY` / title zone, the subtraction silences the surrounding field, or the packet treats a local/static test as deployed D1 evidence.
- **Bounded output / stop condition:** inspect the exact uncommitted renderer and regression test, run the suite and code/diff checks, make one fresh local browser observation with DOM/resource/console evidence, then record the critique. Do not edit production code, deploy, commit, push, or promote an artwork.

## Evidence observed

- `npm test` passed **10/10**; `node --check galerie/field.js` and `git diff --check` passed. The new regression is necessarily a source seam: it confirms the live `.title` geometry lookup and even-odd clip call, not raster-level absence of every possible collision.
- Fresh local browser run: `http://localhost:4173/galerie/`. The reported viewport was `1264×625`; `documentElement.clientWidth = documentElement.scrollWidth = 1264`. The field was `1264×625`; the live title box was wholly inside it at `x=63.19, y=359.41, w=505.56, h=190.59`.
- The observed composition kept the dark title interval clear: no generated strand, red marker, tolerance line, or its caption crossed `PUBLIC STUDY` or `evidence under tolerance`; colonies and the moving tolerance line remained visibly active around that interval.
- The local masthead and study anchors were each 44px high. First-party `/galerie/field.css`, `/galerie/field.js`, and `/galerie/favicon.svg` returned HTTP 200; the local collectors exposed no console errors or unhandled rejections.

## Three-voice reading

### Formalist / experience director

The correction improves the encounter materially. The title is no longer obliged to compete with a wound-like marker; it reads as a threshold cut into the field, while the surviving colonies to its right and above retain the sense that evidence circulates under a limit. The exclusion is large enough to be legible without becoming a pale information panel, and it does not use CSS clipping or a title-background patch.

The cost is productive but real: the excluded rectangle is absolute rather than shaped by the title’s letterforms, so at this desktop state it reads as a fairly broad quiet chamber. That is acceptable only while the surrounding field remains active—as it did in the observed run. It must not be described as an artistic solution at the five contract widths until the public deployment is observed.

### Historian / archivist

No external lineage, audience reaction, activity history, or artwork status has been added. The only defensible claim is local: the renderer uses measured `.title` bounds plus a 12px margin, and the observed local composition left the title clear. The correction remains an uncommitted local change; the deployed production image documented on 2026-08-30 predates it.

### Cynic / release defender

A source-pattern test and one 1264px local view are insufficient to prove that animated marks remain absent at 320, 390, 768, 1280, and 1920 on the deployed URL. They also say nothing about Handwriting’s sub-44px/work-first failures or Brush’s sub-44px, keyboard-canvas, and reduced-motion failures. The existing D1 verdict remains **hold**. No commit, deployment, or release claim follows.

## Decision

**Retain the local correction, hold its release claim.** It accepts the observed gallery collision with a measured visual rule rather than concealment. Do not expand this packet into an unrelated multi-route accessibility revision. The next packet must be a deployed gallery-only D1 verification after a real deployment, or a separately scoped red→green correction for one remaining route-level failure.

## Handoff

- **Changed rule:** a canvas exclusion test proves its implementation seam; the encounter claim still needs an observed rendered frame, and the release claim still needs the deployed five-width matrix.
- **Observed consequence:** in the fresh local `1264×625` frame, the reading zone was clear while the surrounding field stayed active; no local overflow, first-party resource failure, console error, or unhandled rejection was observed.
- **Criticism accepted / resisted:** accepted that a broad quiet chamber is only justified when the field visibly persists around it, and that static assertions cannot prove raster behavior. Resisted treating local success or 10 passing catalog tests as a D1 pass.
- **Next question:** after this exact change is deployed, does `/galerie/` remain clear of title-zone collisions at all five D1 viewports without introducing horizontal overflow or losing the 44px exit path?
- **Hypothesis died:** the assumption that one code-level clip assertion was adequate proof of an artwork-reading-zone correction died. No art hypothesis died.
