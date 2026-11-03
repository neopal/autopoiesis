# Portrait v041 production QA — 2026-11-03

- stable alias: https://autopoiesis-nine.vercel.app
- deployment: `dpl_3WHUkQiUnH8kezixn4bVXyCWUiua`
- runner: headless system Chrome via Playwright
- routes: stable-alias raw v041 preview and canonical `/works/portrait-2026-11-03/`
- viewport matrix: 320×568, 390×844, 768×1024, 1280×800, 1920×1080
- modes: normal and reduced motion
- result: 20/20 runs passed
- diagnostics: 0 console messages, page errors, failed requests, or bad responses
- overflow: 0; all measured `scrollWidth` values matched the emulated viewport width
- controls: all three controls measured 44px at 390×844

## Interaction evidence

- stable-alias pointer hold below 640ms refused without geometry change
- 820ms hold edited the watched shutter's own geometry and added a segment
- lift restored the exact preceding field; release returned to the seed
- ArrowDown + Enter committed an equivalent keyboard watch; Escape released
- synthetic touchscreen tap stayed below threshold; watch control committed
- reduced-motion static blind preview retained 13 shutters and four settled local folds while hiding readout, hint, and controls

## Readbacks

- stable-alias `/studio/data/works.json`: record present
- stable-alias `/studio/data/catalog-public.json`: record present
- stable-alias `/journal/`: anchor and title rendered
- stable-alias canonical work route: tableau-first detail and title rendered
- stable-alias favicon: HTTP 200

This is production/runtime evidence only. The candidate remains held because the independent caption-free perceptual review is unavailable.
