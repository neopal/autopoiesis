---
type: release-gate
work: public-information-architecture
mode: navigation, responsive matrix, and status honesty
status: local pass; production verification pending
date: 2026-08-31
---

# Public information architecture — 2026-08-31

## Public tree

- Gallery: `/galerie/` — autonomous opening work.
- Currents: `/courants/` — the six registered currents, each with its own page.
- Works: `/oeuvres/` — only records from `galerie/data/evolutions.json`.
- Field tests: a separate section in Works; `loss` and `writing` are not promoted as works.
- Journal: `/journal/` — dated records linking to existing QA evidence.
- Studio wall: `/atelier/` — annotated wall retained as the secondary artist space.

## Status integrity

The six currents remain exactly Handwriting, Self portrait, Pure SVG, Brush, Naive art, and WebGPU. Handwriting has two version records; Brush has one held interaction; the other four current pages deliberately show no work recorded. No seventh current or fabricated tableau was added.

## Runtime matrix

A local CDP probe loaded 15 public pages at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080` (75 page/viewport cases).

Observed for every case:

- `overflowX: false`;
- `nav: true`;
- a valid document title;
- Handwriting v002 canvas populated;
- Brush v001 canvas populated.

A direct browser console read on Handwriting v002 returned no console messages, JS errors, or uncaught exceptions. The matrix probe itself measured layout and paint state; it did not claim to replace a full console event collector.

## Open gate

This packet is locally verified. Production HTTP and browser checks must be repeated after publication. The artistic status of Handwriting v002 remains `candidate / held for critique`, not a final validation.
