---
type: executable-study
mode: test
date: 2026-08-30
scope: exact public deployment — gallery, Handwriting v001, Brush v001
status: hold; no production change, commit, push, deployment, or release claim
---
# D1 executable study — public routes at contract widths

## Pulse brief

- **Chosen packet:** existing public exhibition routes; no third chantier opened.
- **Question:** Can the current deployed gallery and its two active v001 routes satisfy the D1 exhibition contract without treating a static screenshot or source inspection as proof?
- **Mode:** `test`.
- **Changed rule:** responsive evidence is route-specific: a route passing width checks cannot clear another route's touch, keyboard, motion, or encounter failures.
- **Falsifier:** all three routes pass 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 with no overflow or collisions; every necessary narrow interaction has a ≥44px target and a meaningful pointer/touch/keyboard path; reduced motion retains the causal work without continued non-essential animation; no console errors or failed first-party resources occur.
- **Bounded output / stop condition:** one automated deployed-browser matrix, one native control run for each active v001, reduced-motion probes, retained desktop/mobile proofs, and the repository test suite. No source or production edit.

## Executed evidence

- Public base observed: `https://autopoiesis-nine.vercel.app`.
- Routes each returned and rendered in the browser at all five contract widths:
  - `/galerie/`
  - `/chantiers/typographie-manuscrite/v001/`
  - `/chantiers/p5-brush/v001/`
- At every tested size, the deployed gallery itself reported `innerWidth` equal to the target and `body.scrollWidth` / `documentElement.scrollWidth` equal to the content width; Handwriting reported 305/375/753/1265/1905px content width at 320/390/768/1280/1920 because of the vertical scrollbar, never exceeding the viewport; Brush reported exact viewport-width scroll values. Thus this run found **no horizontal document overflow** on these three exact routes.
- Every observed first-party CSS and JS resource returned HTTP 200; fresh error and unhandled-rejection collectors remained empty on every matrix load. External Google-font resource timing is not a first-party route test.
- `npm test`: **6 passing, 0 failing** (177.851ms). This suite is catalog/static coverage only, not a substitute for the browser observations below.
- Actual route availability: `/galerie/`, Handwriting v001 and Brush v001 returned 200. The uncommitted `/atelier/` draft is **not** deployed: browser navigation and same-origin fetch both returned 404. It was not promoted or updated publicly.

## D1 findings

### Gallery / opening field

- Width checks, link reachability and first-party assets pass for this route in the five-size matrix. Its footer study links have 44px height at 320 and 390.
- The retained 320×568 proof visibly places a generated orange/grey marker across the `PUBLIC STUDY` label / leading title area. This is a visual collision between the artwork field and textual chrome even though the DOM anchor/title-box comparison cannot see canvas marks.
- The masthead `MUTINE` link is only 59×18px at 320; it does not meet a 44px touch-target reading.
- **Result:** gallery route remains D1-blocked by the observed narrow text/art collision and undersized masthead navigation target.

### Handwriting v001

- The 390×844 proof shows an intentional one-column composition: header links remain visible, then the large proposition, canvas and first range control; no horizontal crop was observed. The work is not encountered before prose: the proposition and explanatory sentence precede the canvas.
- Native keyboard run: five real `Tab` presses focused `#awareness`; `ArrowRight` changed it from `0.72` to `0.73`. A native pointer click on `rewrite` changed the canvas digest from `887da8f5` to `c4caaa93`.
- At 320 and 390, range inputs are 16px high; at 390 the named header links are 20–21px high. They are reachable by scroll/focus but fail a 44px narrow touch-target requirement.
- Under emulated `prefers-reduced-motion: reduce`, two canvas digests two seconds apart were identical (`443a9373`): the static drawing preserves the work's state.
- **Result:** interaction is genuinely runnable and keyboard-accessible, but D1 remains blocked by undersized narrow controls and by prose preceding the artwork.

### Brush v001

- The 390×844 proof shows canvas-first encounter with all three mode buttons visible and 44px high. No document overflow occurred in the matrix.
- Native pointer run: clicking `scar` changed the visible state from `withhold` to `scar`; then a native canvas tap changed digest `58bc6703` → `17a1640d`. Pressing `Enter` on a focused `return` button works as its keyboard equivalent.
- The canvas drawing gesture itself has no keyboard-equivalent intervention: the implementation exposes only global Space pause, `r` reset and `s` save. This does not provide a keyboard path to make a mark/scar/withhold action in the canvas.
- Narrow masthead and evidence links are 15–31px high. At 320/390 they remain present but do not meet a 44px target reading.
- Under emulated reduced motion, the Brush canvas changed digest over two seconds (`58bc6703` → `6891722d`) because its `requestAnimationFrame` loop continues. The route therefore does not supply the required reduced-motion state.
- **Result:** the causal pointer interaction is observed, but D1 remains blocked by absent keyboard-equivalent canvas gesture, undersized narrow links, and failure to reduce non-essential motion.

## Retained visual proof

| Route | Mobile proof | Desktop proof |
|---|---|---|
| Gallery | `research/qa/proofs/2026-08-30-deployed-galerie-320x568.png` — SHA-256 `49cfc4e773c1c70efd2950bf7f7fdb3f8f1792f535ac56e6a8296fb562a3bfa4` | `research/qa/proofs/2026-08-30-deployed-galerie-1920x1080.png` — SHA-256 `36024e0ec433c9d78d0e4d039a480ae2bafd39d248ebceb978fb4878091dd064` |
| Handwriting v001 | `research/qa/proofs/2026-08-30-deployed-handwriting-390x844.png` — SHA-256 `d296e40a3a96ea7265c89dcc6b62a208d67cb78114a2b1d115449efbd35c7b27` | `research/qa/proofs/2026-08-30-deployed-handwriting-1920x1080.png` — SHA-256 `aa57b445ba0df90c765b3adde755ed3cf338411c703d49a816e45f482601ea49` |
| Brush v001 | `research/qa/proofs/2026-08-30-deployed-brush-390x844.png` — SHA-256 `f4572e5e1bbff464db626d6d281f32f4f5d4e3367d8f62fd384a1d317852ad36` | `research/qa/proofs/2026-08-30-deployed-brush-1920x1080.png` — SHA-256 `23b178b1fda5f0991eba0d3562184e383feff7b3ae93d3d86016799d484027af` |

## Critical reading

- **Formalist:** the gallery’s mobile field still has a strong scale shift, and Brush makes its drawing immediately encounterable; Handwriting’s one-column reflow avoids the prior fixed-desktop crop. But the field’s mark crossing its own label turns the tolerance vocabulary into accidental obstruction; Handwriting places statement before procedure; Brush lets movement continue when the visitor has asked for restraint.
- **Historian:** no external lineage claim was made or extended in this packet. The observed work is evaluated against its declared rule and browser behaviour, not a borrowed appearance.
- **Cynic:** “no overflow” is a narrow success, not release readiness. Tiny targets, inaccessible canvas gesture, continuing reduced-motion animation, and an undeployed atelier link are enough to invalidate any public-release claim.
- **Accepted:** a real deployed run can replace the previous permission-blocked absence of geometry evidence, but it also proves that the release block is no longer merely hypothetical.
- **Resisted:** treating successful page load, 200 assets, six catalog tests, or attractive screenshots as a D1 pass.

## Handoff

- **Study verdict:** serious executable D1 study completed; no artwork was made, revised, or promoted.
- **Release verdict:** **hold**. No release claim, commit, deploy or public `/atelier/` update is authorized.
- **Next falsifiable move:** create a narrowly scoped accessibility/recomposition correction packet only after a pre-code brief specifies how (1) generated gallery marks reserve the title/label zone, (2) all narrow interactive targets become ≥44px without hiding the canvas, (3) Brush’s canvas has an actual keyboard mark/scar path, and (4) `prefers-reduced-motion` stops its ticking while preserving a deterministic rendered state. Reject the packet if any fix relies on `overflow:hidden`, removes an exit/record link, or merely enlarges chrome while the work ceases to be encountered first.
