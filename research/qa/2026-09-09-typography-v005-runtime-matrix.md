# Handwriting v005 — 2026-09-09 deployed runtime QA

## State

- Current: Typography / handwriting (`typography`)
- Work: `typography-2026-09-09`
- Status: `candidate / held`
- Study: `/studies/handwriting/v005/`
- Canonical route: `/works/typography-2026-09-09/`
- Deployment under test: `https://autopoiesis-nine.vercel.app`

## Artistic rule

v005 replaces a private lost beat with a social constraint: a remembered refusal becomes a borrowed baseline. Nearby later routes converge toward its local height, share a phase handoff, and peel away together. The expected consequence is structural route migration, not a witness dot, dashed line, or colour change carrying the explanation.

The deterministic source state is `MASTER_SEED = 0x6d757469`, 9 stages, 12 routes, 18 passage points, and a memory window of 48. The deletion condition remains: hide witnesses, baseline, labels, and readout; delete the direction if several downstream routes do not visibly share the wrong line, or if lifting the latest refusal leaves their coordinates unchanged.

## Deployed route evidence

Google Chrome headless, executable at the installed system Chrome path, loaded the canonical work route at all requested viewport sizes in both media modes:

| Mode | 320×568 | 390×844 | 768×1024 | 1280×800 | 1920×1080 |
|---|---:|---:|---:|---:|---:|
| Normal | PASS | PASS | PASS | PASS | PASS |
| Reduced motion | PASS | PASS | PASS | PASS | PASS |

All 10 runs recorded exact target `innerWidth`, `clientWidth`, and `scrollWidth` on the catalogue route; all embedded study frames were also overflow-free. The canonical work id was `typography-2026-09-09` and the tableau was above the explanatory heading in every run. Each embedded interaction button measured 44 CSS px high. Each run rendered a canvas; the captures are archived beside the machine-readable report.

The run recorded zero console messages, zero page errors, zero failed requests, and zero HTTP 400+ responses. The interaction page repeated the console/page-error/network listeners before the meaningful actions and remained empty after them.

## Interaction evidence

At 390×844 on the canonical route, the iframe state transitions were observed from the real controls:

- Initial: stage `0`, memory `0`, borrowed routes `0`.
- Pointer/button `Place refusal`: memory `1`, paused `true`, borrowed routes `10`.
- Focused canvas + keyboard `Space`: memory `2`; the changed route field remained active.
- `Lift latest`: memory `1`, visitor marker cleared, and the route signature exactly matched the post-button frame.
- A second placement followed by `Restore baseline`: visitor marker cleared and the deterministic settled frame returned.

The raw preview exception was also loaded directly at `/studies/handwriting/v005/?preview=1&interaction=1`; it retained preview mode, canvas, controls, and exact 390px overflow-free geometry without catalogue furniture.

## Evidence files

- `research/qa/proofs/typography-v005/results.json`
- `research/qa/proofs/typography-v005/canonical-normal-320x568.png`
- `research/qa/proofs/typography-v005/canonical-normal-390x844.png`
- `research/qa/proofs/typography-v005/canonical-normal-768x1024.png`
- `research/qa/proofs/typography-v005/canonical-normal-1280x800.png`
- `research/qa/proofs/typography-v005/canonical-normal-1920x1080.png`
- `research/qa/proofs/typography-v005/canonical-reduced-320x568.png`
- `research/qa/proofs/typography-v005/canonical-reduced-390x844.png`
- `research/qa/proofs/typography-v005/canonical-reduced-768x1024.png`
- `research/qa/proofs/typography-v005/canonical-reduced-1280x800.png`
- `research/qa/proofs/typography-v005/canonical-reduced-1920x1080.png`
- `research/qa/proofs/typography-v005/canonical-interaction-390x844.png`
- `research/qa/proofs/typography-v005/raw-preview-interaction-390x844.png`

## Verification and release decision

The browser, responsive, interaction, console, network, and production-route gates observed in this run pass. The register, study metrics, and README now record this evidence without promoting the work.

The candidate remains **candidate / held**. The unresolved gate is independent caption-free perceptual critique: witnesses, dashed baseline, labels, and readout must be hidden to determine whether the borrowed downstream route family carries the mutation on its own. These runtime captures prove execution and causality paths; they do not by themselves prove that the image reads as intended.
