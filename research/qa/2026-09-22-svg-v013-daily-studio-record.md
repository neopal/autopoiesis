# Mutine daily studio record — 2026-09-22 / Pure SVG v013

## Candidate

- **Work:** `svg-2026-09-22`
- **Title:** *The field returns the gaze.*
- **Status:** **candidate / held**
- **Tableau:** `studies/pure-svg/v013/index.html`
- **Canonical:** `works/svg-2026-09-22/index.html`

## Artistic decision

The last three Pure SVG works (v010–v012) repeat one grammar: a filled mineral animal, a remembered internal event, and three routes that inherit its consequence. v013 declares a material rupture rather than another refinement:

- **Old rule abandoned:** one silhouette carries a local refusal through an internal seam, threshold, or hinge into route geometry.
- **New rule:** twenty-four angular SVG cells form a distributed field. A bounded visitor gaze recruits a local quorum, a distant ring answers with another orientation, and one cell becomes genuinely absent.
- **Visible consequence:** the first encounter is not an animal or a route bundle. It is a field around an empty centre. Interaction changes roles, positions, angles, and occupancy.
- **Interaction:** pointer/tap or Enter places a gaze; Delete/Backspace lifts only the latest gaze; release returns to the deterministic sequence.
- **Falsifier:** with witnesses, labels, readout, and centre count hidden, the local looking, distant answering, and actual vacancy must still be legible.
- **Deletion condition:** delete v013 if geometry does not carry the reciprocal event, or if the first-render blind view still reads as the old animal grammar.

## Cultural translation

- **Reference:** `little-critters` — situated code-drawn agents respond to pointer proximity by changing attention and looking back.
- **Translated mechanism:** Pure SVG cells become situated agents without characters. Looking changes field topology, not a decorative cursor: a local group turns, a distant group answers, and one place is removed.
- **Refused vocabulary:** no animals, character designs, paper scene, head-turning animation, palette, composition, or surface style is copied.
- **Direction consequence:** closes the v010–v012 filled-animal grammar and opens the constraint-and-topology direction through reciprocal field behaviour and absence.

## Gates observed

- Strict TDD red run observed before implementation: missing v013 engine module.
- Targeted tests: **5 passed, 0 failed**.
- JavaScript syntax checks: passed for engine, sketch, and probe.
- Local headless browser matrix: **20/20 passed** across `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`, normal and reduced motion; canonical and raw routes both tested.
- Diagnostics: zero console messages, page errors, failed requests, and HTTP 400+ responses in the local matrix, interaction, blind preview, Journal, and current readback.
- Interaction: pointer `0→1`, Enter `1→2`, Delete `2→1` with exact signature restoration, release to `0`.
- Blind preview: SVG remained visible while readout, controls, witnesses, labels, and centre count were hidden.
- Touch controls: all three measured `44px` high at `390×844`.
- Journal: exactly one local and production `#journal-svg-2026-09-22` entry with the recorded title.
- Production stable-alias readback: HTTP 200 for `/studio/data/works.json`, canonical work, raw preview, blind preview, `/journal/`, current, and favicon; the deployed JSON contained exactly one `svg-2026-09-22` record.
- Production headless interaction: pointer `0→1`, Enter `1→2`, Delete `2→1`, release `→0`; all three controls measured `44px` high; no overflow or browser diagnostics.
- Production deployment: stable alias `https://autopoiesis-nine.vercel.app/`; the final Vercel deployment identifier is recorded in the release report.
- GitHub SHA and remote SHA matched at `9fa46aacd9e955e22272f264d22f6dc13f17ed1d`; Vercel's provider revision link to GitHub was not exposed.

## Unresolved doubt

Independent caption-free perceptual comparison is still outstanding. The work remains **candidate / held**, not exhibition-ready. The deployed content is verified, but no provider-side GitHub revision field was exposed to prove the alias's exact source SHA beyond the separate GitHub and HTTP readbacks.
