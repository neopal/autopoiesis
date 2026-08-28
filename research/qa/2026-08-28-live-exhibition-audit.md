---
type: qa-audit
scope: production
url: https://autopoiesis-nine.vercel.app/
status: actionable
---
# Live exhibition audit — 2026-08-28

## Verdict

The site is a working prototype, not a finished exhibition surface. The two works have credible questions but currently illustrate their ideas instead of making those ideas unavoidable.

## Release blockers

### P0 — artwork pages crop on small screens

- At 390px, Handwriting loses header/navigation, truncates text and sends canvas/controls beyond the viewport.
- Brush also retains a desktop field rather than recomposing for touch.
- **Root cause hypothesis:** fixed layout dimensions plus global clipping, without an explicit small-screen composition.
- **Regression evidence required:** automated narrow-viewport browser test that asserts each work has no horizontal overflow and exposes all named controls/links.

### P0 — gallery work marker collides with primary copy on mobile

- The Brush node covers the gallery count line at narrow width.
- **Root cause hypothesis:** hash-positioned canvas nodes ignore text/interactive exclusion regions.
- **Regression evidence required:** narrow-viewport screenshot/DOM test that guarantees all marker bounds remain below the reserved headline/count area.

## High-priority experience failures

1. The period field is a sparse node diagram. Work is not encountered first.
2. Four dormant rooms look like equal navigation but resolve to raw Markdown/process state.
3. Room tiles clip on mobile because fixed `min-width` is masked by `overflow:hidden`.
4. Brush has too little contrast and its verbs do not create visibly different regimes.
5. Handwriting presents a demo panel and parameter controls before a visual encounter.
6. The gallery hides basic navigation behind a 21px question button and jargon-heavy shortcuts.
7. Studio/brain links leave the exhibition for raw Markdown documents.

## Art-critical findings

### Handwriting

It is still distorted display typography: left-to-right characters each follow a similar route recipe. “No glyph” is stated more strongly than it is enacted. Fatigue and surprise make cosmetic variation rather than irreversible history.

**Two spikes before v002:**
- **Disobedient writing:** the system preserves traces and sacrifices order/baseline/closure; character boundaries migrate or merge over time. It fails if text swaps do not materially alter the breakdown.
- **Adversarial scribe:** awareness, carelessness, slant and pressure become competing agents. A visitor backs one, giving another a stronger future claim. It fails if the three scripted sessions only differ in noise/line width.

### Brush

It currently makes tasteful distress. Scar overlays the field but does not govern later growth. The work has a nice frame but interaction decorates the poster instead of risking it.

**Two spikes before v002:**
- **Subtractive ecology:** every mark is finite material; a scar creates the location, direction and pigment allowance for later marks. It fails if causal removal cannot be seen in a text-free 90-second sequence.
- **Contractual refusals:** shifting zones translate, delay, redirect or refuse gestures; scar changes jurisdiction instead of visually erasing. It fails if four routes still read as interchangeable abstract line fields.

## Decision

Do not open a third work. Do not call either active v001 a period. Fix P0 responsive defects before the next public visual claim. Create disposable spikes, review them independently, then retain one direction for each v002.
