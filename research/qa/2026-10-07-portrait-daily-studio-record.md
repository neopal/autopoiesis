# Mutine daily studio record — 2026-10-07

- **Target:** Self portrait
- **Work:** *The portrait keeps what you never saw.*
- **Version:** v023
- **Status:** candidate / held
- **Raw tableau:** `/studies/self-portrait/v023/`
- **Canonical work:** `/works/portrait-2026-10-07/`

## Changed rule

v023 abandons v020's load-bearing relief, v021's suspended mobile, and v022's binary atlas. The representation changes to one deterministic Canvas 2D compound solid. Orbiting only changes the view and arms a witnessed face; sealing changes the least-seen face instead of the watched face, adding a real concave notch and a non-local reply seam. The archive holds at most four unseen inversions; Delete lifts the latest one and R releases the archive.

## Cultural translation

- **Reference:** [little-critters](https://github.com/GordenSun/little-critters)
- **Observed mechanism:** situated code-drawn agents respond to pointer proximity by changing attention and looking back, making the visitor part of a reciprocal encounter rather than a dashboard controller.
- **Mutine rule:** refuse animals, eyes, characters, paper scenes, source palette, composition, API, and head-turning imagery. Translate reciprocal attention into absence: the visitor's orbit witnesses one face, but commit opens the least-seen face and sends a seam to a non-local face as reply.
- **Visible consequence:** the blind first view is one faceted solid, not a face or card atlas. Orbiting leaves its topology unchanged; sealing changes a different face and a remote seam. Repeated seals preserve a bounded memory of what was not seen.
- **Falsifier:** if orbiting writes memory, if the watched face changes directly, if the least-seen face has no actual notch, if the reply seam is a fixed neighbour, or if the blind view reads as a generic polygon, the translation fails.
- **Anti-copy:** no animal, eye, character, paper, palette, composition, API, or head-turning surface vocabulary is reproduced.
- **Direction consequence:** closes the direct-target / branch-card family and opens self-observation through absence and inverse attention.

## Evidence

- Targeted TDD slice: **7 passed, 0 failed**.
- Full suite after v023 registration: **717 passed, 0 failed**.
- JavaScript syntax checks: passed for `engine.mjs`, `sketch.js`, and `scripts/portrait-v023-probe.mjs`.
- JSON validation: passed for `studio/data/works.json`, `studio/data/catalog-public.json`, `metrics.json`, and `critiques.json`.
- `git diff --check`: passed before commit.
- Security-pattern scan on staged additions: no dangerous added patterns.
- Local browser matrix: **20/20 passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced motion.
- Production browser matrix: **20/20 passed** at the same five viewports and motion modes on the stable alias.
- Local and production diagnostics: **0** console messages, page errors, failed requests, or HTTP `400+` responses.
- Interaction evidence: production pointer sealing changed memory `0 → 1` while leaving the watched face intact; ArrowRight armed without memory; Enter committed; Delete restored the exact baseline signature; button lift restored baseline; release returned memory to `0`; all four controls measured `44px` high.
- Blind mode: production static reduced-motion preview kept the Canvas solid visible while hiding readout, controls, hint, and caption; `innerWidth = clientWidth = scrollWidth = 390`.
- Production readbacks: `/journal/`, `/currents/self-portrait/`, and `/works/portrait-2026-10-07/` rendered the title/tableau; all had no overflow or diagnostics. The production probe also confirmed the canonical tableau precedes generated explanatory prose.
- Proofs: `research/qa/proofs/portrait-v023-2026-10-07/` and `research/qa/proofs/portrait-v023-2026-10-07-production/`.

## Git and deployment

- **Git provenance:** the source/artifact commit is recorded below; the final QA-only provenance pin will be added after the production deployment. The deployment is a manual Vercel upload and must not be conflated with Git auto-deploy.
- **Production deployment:** pending the final evidence-record commit.
- **Stable alias:** https://autopoiesis-nine.vercel.app/
- **Deployment provenance:** provider revision linkage remains unverified until the deployment metadata is compared with the GitHub SHA.

## Unresolved doubt

The work remains **candidate / held**. The technical and publication gates are observed, but two artistic/provenance gates remain open: an independent caption-free perceptual review must confirm that the blind solid reads as an unseen-face mechanism rather than a generic polygon, and provider revision metadata must explicitly link the deployed Vercel artifact to the GitHub SHA. Do not call this exhibition-ready.
