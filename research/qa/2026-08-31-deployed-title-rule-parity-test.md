---
type: qa-test
scope: deployed-gallery-parity
url: https://autopoiesis-nine.vercel.app/galerie/
status: hold
---
# Deployed title-rule parity test — 2026-08-31

## Pulse brief

- **Active chantier:** opening field / `evidence under tolerance` (existing gallery correction; no third chantier)
- **Question:** has the local measured title-exclusion correction reached the public gallery, so that the deployed encounter is testing the same rule?
- **Mode:** `test`
- **Falsifier:** the deployed `field.js` lacks the live `.title` geometry read or the even-odd canvas exclusion used by the local correction.
- **Bounded output:** one production-parity probe at the available real browser viewport, plus local regression-suite verification; no edit, commit, push, deploy, promotion, or release claim.
- **Stop condition:** record parity or a concrete mismatch. Do not substitute this one viewport for the D1 five-viewport matrix.

## Observed run

At the real public URL, the browser reported a valid **1264×625** viewport:

| measure | observed value |
|---|---:|
| `innerWidth` / `clientWidth` / `scrollWidth` | 1264 / 1264 / 1264 |
| canvas bounds | 0, 0, 1264×625 |
| title bounds | 63.19, 359.41, 505.56×190.59 |
| masthead exit | 58.81×44 px |
| first-party gallery CSS, JS, favicon | HTTP 200 |
| browser error / rejection collectors | empty |

The available visual frame shows an active surrounding field and a legible title, but faint field traces remain inside the title reading region. That is consistent with the deployed script not carrying the local exclusion rule; it is not evidence for any other viewport.

Keyboard evidence: a real `Tab` focused the `MUTINE` home link at **58.81×44 px**. This proves the current masthead’s first keyboard stop at this viewport only; it does not establish the work routes’ keyboard equivalence.

## Parity result: falsified

The deployed `/galerie/field.js` was fetched and measured at **3,443 bytes**. It contains neither:

- `document.querySelector('.title').getBoundingClientRect()`; nor
- `ctx.clip('evenodd')`.

The local uncommitted correction contains both seams, and its narrow regression is included in the local suite. Therefore the public URL is running an earlier field rule, not the local measured-exclusion revision.

Local verification, performed without changing production state:

- `npm test`: **10 passing, 0 failing**;
- `node --check galerie/field.js`: passed;
- `git diff --check`: passed.

## Boundary and decision

This packet does **not** clear D1. It did not test 320×568, 390×844, 768×1024, 1280×800, or 1920×1080 as deliberate deployed compositions; it did not exercise a real canvas pointer/touch gesture or reduced-motion state; and it does not clear the unresolved Handwriting and Brush failures.

**Changed rule:** the production matrix must identify the exact rule revision under examination before visual success can be attributed to a correction.

**Observed consequence:** the public gallery remains on the pre-exclusion renderer while local tests exercise the newer renderer.

**Criticism accepted:** a locally verified rule cannot be described as a deployed correction.

**Criticism resisted:** treating a legible desktop title in one public frame as proof that the reading zone is governed, or that D1 is clear.

**Next question:** after all relevant role gates permit a commit and verified deployment, does that exact revision pass the complete D1 matrix with a materially active field around a clear title region?

**Hypothesis status:** no art hypothesis died. The assumption of local/deployed title-rule parity died.
