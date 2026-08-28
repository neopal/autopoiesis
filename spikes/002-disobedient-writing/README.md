# Mutine — 002 / disobedient writing

> A writing system that learns to disobey.

## Concept

This is not display type made unstable. It is a small deterministic writing machine with a memory of every attempt it has made.

It begins with the sentence **“stay legible”**. Each letter is an authored set of pen-strokes, not a font. At each state the machine attempts those strokes again, keeps the earlier attempt on the page as a pale ink trace, and gives up one dependable property of writing:

1. **Stroke continuity** — reliable joins open.
2. **Private territory** — the word boundary begins to drift.
3. **Counter-space** — loops and gaps collapse toward routes.
4. **Reading order** — strokes prefer neighbouring letters over their own letter.
5. **Separation** — the former word boundary becomes a shared conduit.

The system therefore remembers legibility while actively refusing to preserve it. It never "jiggles" a completed glyph; it accumulates divergent attempts and reroutes the current one.

## Design

- **Field:** warm paper, sparse black/oxide ink, faint construction rails.
- **Writing:** handcrafted SVG paths with rounded pen terminals. Old attempts stay visible at lower opacity; the newest attempt is dark.
- **Boundary:** the inter-word division is a visible vertical seam. After the first pass it migrates, then is absorbed into cross-word links.
- **Interaction:** the time control is intentionally small. Drag it to inspect a deterministic 10-minute state, or use `accelerate` to play the whole ten minutes in 30 seconds. `r` resets; Space starts/stops the accelerated run.
- **Responsive behavior:** on narrow screens the writing field retains its width and can be horizontally panned; the control rail reflows below it. No external images, fonts, or packages are used.

## Run locally

From this folder:

```bash
python -m http.server 4173
```

Then visit `http://localhost:4173` (or any available local port). For a direct deterministic inspection state, append `?minute=0`, `?minute=2`, `?minute=5`, or `?minute=10`.

## Evidence method — 0 / 2 / 5 / 10 minutes

Use the labeled state rail or set the time slider exactly to each state. The output is deterministic, so these observations reproduce after refresh.

| Time | What to look for | Evidence of disobedience |
|---:|---|---|
| **0:00** | “stay legible” is readable; one dark authored stroke set; seam is still a quiet division. | Baseline: conventional writing is available to the system. |
| **2:00** | A first pale attempt remains under a new attempt; a few joins have deliberately opened; the seam has started to wander. | Memory is retained and stroke continuity is no longer guaranteed. |
| **5:00** | At least three earlier attempts are simultaneously legible as residue; counters are pinched; the seam has moved into the letter field. | The boundary has migrated and each new route sacrifices letter-internal reliability. |
| **10:00** | All prior attempts remain as a sediment; current strokes bridge the former word gap; the seam is replaced by a shared route. | Boundaries have merged. The route survives, but normal reading has lost priority. |

### Verdict

**Pass.** The spike demonstrates actual stateful divergence rather than a jitter effect: each glyph has a persistent record of prior attempts, the newest attempt is generated from the same authored strokes under an irreversible rule schedule, and word separation physically migrates then becomes a connection. The first reading stays present as evidence, not as a reset point.

## Files

- `index.html` — self-contained browser artwork and interaction.
- `README.md` — concept, design, evidence protocol, and verdict.

Disposable experiment only; no production architecture or dependency setup is intended.
