# Daily studio record — 2026-09-14

## Scope and decision

Scheduled rotation slot completed in `C:/Users/ASUS/autopoiesis` for the
**Self portrait** current. The run created exactly one new daily work:
`portrait-2026-09-14`, backed by the executable `self-portrait/v009` tableau.
The record remains **candidate / held**. No missing historical date was filled,
and no other current was mutated.

## Creative record

- **Title:** The portrait keeps a seam.
- **Changed rule:** a remembered decision tugs two contour anchors while a
  paired-rail thread crosses the interior and exits elsewhere; the aperture
  shifts under accumulated tension.
- **Visible consequence:** the body geometry, aperture, and interior
  entry → crossing → exit route all change together; the latest seam is exactly
  reversible.
- **Seed / state:** `0x53505639`, 15 stages, 4-seam memory limit, deterministic
  Canvas 2D engine.
- **Interaction:** pointer/tap, Enter, or Space threads a seam; Delete/Backspace
  returns the latest; `release sequence` resumes the seeded timeline.
- **Falsifier:** an unchanged body, aperture, entry, crossing, exit, or rail
  would reduce the seam to decoration.
- **Deletion condition:** delete v009 if caption-free viewing cannot identify
  the changed entry and exit around the interior route, or if the line alone
  carries the meaning.

## Local browser evidence

Evidence source: `research/qa/proofs/portrait-v009-2026-09-14/results.json` and
its `probe.mjs`.

- **Canonical shell / tableau:** PASS — tableau iframe rendered before title,
  Journal, critique, evidence, and neighbouring-work prose.
- **Viewport matrix:** PASS — 10/10 headless runs at `320×568`, `390×844`,
  `768×1024`, `1280×800`, and `1920×1080`, in normal and reduced-motion modes.
- **Overflow:** PASS — outer `innerWidth`, `clientWidth`, and `scrollWidth`
  matched at all ten canonical runs; the contained horizontal timeline rail was
  excluded from page scroll geometry.
- **Touch controls:** PASS — all three raw controls measured 44 CSS px at
  `390×844`.
- **Runtime diagnostics:** PASS — zero console messages, page errors, failed
  requests, and HTTP 400+ responses in canonical, static-blind, raw, and
  Journal runs.
- **Static blind preview:** PASS — `preview=1&static=1&blind=1` preserved the
  canvas while removing editorial furniture, readout, controls, endpoint
  ticks, and crossing-knot witnesses.
- **Interaction:** PASS — pointer changed memory `0 → 1`, changed the canvas
  PNG signature, and paused; Enter reproduced the seam; Delete restored the
  exact preceding canvas PNG; release returned to stage `01 / 15` and memory
  `0`.
- **Routes:** PASS — Journal rendered exactly one dated anchor/title;
  direct raw tableau redirected to `/works/portrait-2026-09-14/`; favicon was
  HTTP 200 with `image/svg+xml`.
- **Captures:** 13 PNG files written in the proof directory.

## Automated verification

- Targeted TDD contract: **9/9 passed**.
- Repository suite: **307/307 passed; 0 failed, 0 skipped, 0 todo**.
- Changed JavaScript syntax checks: **PASS** for `engine.mjs`, `sketch.js`, and
  `probe.mjs`.
- `git diff --check`: **PASS**.

## Held boundary

The artifact and local runtime gates pass. The work stays **candidate / held**
until an independent caption-free perceptual comparison confirms that the
seam remains bodily and legible with labels, readout, endpoint ticks,
crossing-knot witness, and editorial furniture hidden. Production deployment
and provider revision provenance are recorded separately from this local run.
