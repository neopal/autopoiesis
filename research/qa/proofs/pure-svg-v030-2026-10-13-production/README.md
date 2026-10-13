# Pure SVG v030 QA — 2026-10-13

- Base URL: https://autopoiesis-nine.vercel.app
- Matrix: 20/20 raw/canonical runs across 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.
- Overflow: 0 failing runs; all recorded innerWidth/clientWidth/scrollWidth values are in qa-summary.json.
- Diagnostics: 0 console/page-error/request/HTTP-400+ entries.
- Drag: armed memory 0; committed memory 1; state remote-reply; changed geometry true.
- Same gate: memory 0; state reply-refused-same-gate.
- Keyboard: Enter armed 1, committed 1; Delete 0; R 0.
- Blind preview: field visible true; readout hidden true; controls hidden true; annotations hidden true; overflow true.
- Readbacks: journal=true, current=true, canonical=true.
- Exact rendered readbacks: `rendered-readbacks.json` confirms the Journal anchor/title, Pure SVG current card/title, canonical work title/tableau, innerWidth/clientWidth/scrollWidth, and no overflow.
- HTTP readback: `/studio/data/works.json` and `/studio/data/catalog-public.json` returned 200 with 168 works and exactly one `svg-2026-10-13` record; `/studio/favicon.svg` returned 200.
- Deployment: `dpl_9KCQo1ezLAEa5DbVHa49suP78aZo` via stable alias.
- Captures: interaction-drag-390.png, blind-static-390.png, canonical-390.png.
