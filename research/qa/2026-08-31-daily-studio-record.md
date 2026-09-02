---
type: daily-studio-record
scope: deployed-opening-field-parity
mode: test
status: superseded
date: 2026-08-31
superseded_by: 2026-09-02-daily-studio-record.md
---

# Mutine — daily record, 2026-08-31

> Historical QA record. The route names below describe the deployment that was tested at that time; they are not current public entry points.

## Bounded packet

- **Verified currents at the time:** only Handwriting v001 and p5.brush v001 (`galerie/data/studio.json`). No third current was opened.
- **Question:** did the public Gallery execute the local rule that preserves the title reading zone?
- **Mode:** executable parity / D1 study, with no work edit, commit, deployment, or release claim.
- **Falsifier:** the public `field.js` did not read `.title` geometry or did not use an even-odd clip.
- **Stop condition:** record parity or failure with public desktop and mobile evidence; do not turn two images into a complete D1 matrix.

## Study actually executed

- `npm test`: **10 passed, 0 failed**; `node --check galerie/field.js` and `git diff --check`: passed.
- The local Gallery was served at `http://127.0.0.1:4173/galerie/`: DOM at 1264×625, `innerWidth = clientWidth = scrollWidth = 1264`, first-party resources returned 200. The local render showed a mark-free title/label zone while the field stayed active around it. This observation concerned an uncommitted local revision.
- The public Gallery was inspected at `https://autopoiesis-nine.vercel.app/galerie/`: DOM at 1264×625, `innerWidth = clientWidth = scrollWidth = 1264`; the MUTINE link measured 58.81×44px; CSS, JS, and the `/galerie/` favicon returned 200; `Tab` focused the MUTINE link. The public script contained neither a `.title` `getBoundingClientRect()` read nor `ctx.clip('evenodd')`: falsifier **confirmed**.
- Retained public captures: `research/qa/proofs/2026-08-31-deployed-galerie-desktop-1280x800.png` and `research/qa/proofs/2026-08-31-deployed-galerie-mobile-390x844.png`. They showed a living field, but also the old rule: tolerance lines and traces crossed the reading zone at 1280×800; at 390×844 the line visibly crossed the `PUBLIC STUDY` label and title axis. HAND / BRUSH / LOSS / WRITING links remained visible, but an image did not prove their 44px targets or touch equivalence.

**Result:** the study was real but negative: the local reading-chamber fix was not in production. D1 remained blocked; two viewport proofs were not the five required compositions.

## Reflection and critique

The local chamber was a relational improvement—the field persisted outside the text—not proof of availability. In the public Gallery, the tolerance line still acted as decoration/reference even when it damaged reading: the device claimed a constraint without yet making the public system carry its consequence. The accepted critique was therefore local/public non-parity. The rejected critique was that one readable desktop frame or a catalogue test suite was sufficient to call the opening ready.

## Currents: evidence, critical state, falsifiable move

| Current | Current evidence | Precise critical state | Next falsifiable move |
|---|---|---|---|
| Self portrait | `galerie/data/studio.json` marked `portrait` dormant, with no evolution or route. | No render, causal trace, or self-representation mechanism was present: the current was absent, not “advanced research.” | Produce a deterministic commit/error trace spike; reject it if permuting its history does not change the portrait reading. |
| Form completeness | No separate current, evolution, or study was indexed in `studio.json` / `evolutions.json`. | Closure remained an intuition without a protocol; no observed difference distinguished formal necessity from simple density. | Compare three deterministic states where closure removes the field carrying it; reject if only density changes. |
| Engineering drawing | No executable, route, or verified source-gravity map existed in the inspected repository. | No instrument or tolerance could fail; claiming otherwise would fabricate evidence. | Make a spike subject to an impossible specification; reject it if it reads as graphic options rather than an attested compromise. |
| Naturalism | No naturalist current or browser study was indexed; the Constitution supplied no specimen. | No specimen or field/annotation/loss relation had been tested; no formal lineage could be claimed. | Build a dense field segmentation where each validated near-specimen removes its habitat; reject it if it settles into a pleasing animal poster. |
| Active lineages | Two v001 records were indexed: Handwriting (`seed` `mutine-v001-autopoiese`, metrics 0.63/0.41/0.18) and Brush (`seed` `mutine-brush-v001-loss`, `erasureRatio` 0.31, 18 returns) in `galerie/data/evolutions.json`. | They were executable but remained unpromoted spikes: Brush retained `Math.random()` and no keyboard-equivalent path; Handwriting had `?minute=` states but a pannable 830px mobile composition and no meaningful reduced-motion path. Their critiques required scar/constraint to govern a later decision, not remain an effect. | After an accessibility-bounded correction, prove in a browser that removal/trace changes a later decision; reject each lineage if the effect remains decorative or the D1 matrix fails. |

## Publication decision

The retired public `/atelier/` route returned the observed 404 at `https://autopoiesis-nine.vercel.app/atelier/`. The local `atelier/index.html` draft remained unpublished and contained unsupported claims (“source-gravity map”, “DAY 001”) already critiqued. It was therefore not modified or promoted. No release claim was made.

## Immediate follow-ups at the time

1. Do not open a third current.
2. Do not deploy or announce the correction while the complete D1 matrix and Handwriting/Brush defects remain open.
3. Once an authorized revision is actually deployed, test that exact revision at the five contract sizes with DOM, gesture/keyboard equivalence, reduced motion, console/network evidence, and retained captures.

The superseding 2026-09-02 record documents the later English architecture and current release boundary.
