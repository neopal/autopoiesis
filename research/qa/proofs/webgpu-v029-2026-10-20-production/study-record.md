# WebGPU v029 production verification — 2026-10-20

- Stable alias: `https://autopoiesis-nine.vercel.app`
- Production route: `/works/webgpu-2026-10-20/`
- Raw route: `/studies/webgpu/v029/`
- Status: `candidate / held`

## Browser matrix

- `20/20` route/viewport/motion runs passed.
- Viewports: `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`.
- Routes: raw preview and canonical work page.
- Modes: normal and reduced-motion.
- Diagnostics: `0` console messages, page errors, failed requests, or HTTP 400+ responses.
- Screenshots: `22`.

## Interaction evidence

- Short traverse stayed memory-neutral.
- A bounded valid traverse committed one compression and changed three remote material roles.
- `Delete` restored the exact geometry signature.
- Keyboard compression, lift, release, and blind preview paths passed.
- Controls measured at least `44px` high.
- Blind preview kept the canvas visible, hid readout/status/controls, and measured `innerWidth/clientWidth/scrollWidth = 390/390/390`.

## Public readback

- `/journal/`: `200`, Journal anchor and title present.
- `/currents/webgpu/`: `200`, current target present.
- `/works/webgpu-2026-10-20/`: `200`, canonical target present.
- `/studio/data/works.json`: `200`, exactly one `webgpu-2026-10-20` record.
- `/studio/data/catalog-public.json`: `200`, record present and QA/source evidence omitted.
- `/studio/favicon.svg`: `200`.

## Remaining doubt

Production runtime and route gates pass. The work remains held because an independent caption-free perceptual comparison has not been observed. The result is not called exhibition-ready.

Proof: `results.json` and the PNG captures in this directory.
