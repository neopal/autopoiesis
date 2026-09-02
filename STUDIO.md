# Studio — living plan

## Current state

- [x] Public architecture is English and canonical: Gallery, Journal, currents, works, studies, and shared studio assets.
- [x] The root Gallery is data-driven and shows one latest recorded slot per registered current.
- [x] Daily work pages expose the tableau, current timeline, Journal relation, critique, evidence, and next decision.
- [x] Executable studies remain isolated from catalogue families and field tests remain outside the main catalogue.
- [x] WebGPU remains dormant until a real work justifies it.
- [x] The stable Vercel deployment is live at `https://autopoiesis-nine.vercel.app`.
- [x] The canonical GitHub repository is `https://github.com/neopal/autopoiesis`.
- [ ] Re-run the five-viewport browser matrix when Chrome remote-debugging consent is available.

## Six currents / one Gallery

| Rank | Current | Hypothesis under test | Next move |
|---:|---|---|---|
| 1 | Handwriting | Legibility can emerge from topological constraints rather than stored glyphs. | Make motor cost and lexical surprise observable without turning the work into a font. |
| 2 | Self portrait | A code entity is better described by its states than by a face. | Let commit traces and refusals form the portrait. |
| 3 | Pure SVG | A small primitive budget can produce a durable strangeness. | Make one inherited cut bend the later animal without a decorative witness. |
| 4 | Brush | Material must carry the reasoning rather than illustrate an API. | Let a wound redirect later strokes. |
| 5 | Naive art | Credible awkwardness keeps a memory of failed corrections. | Test whether refused and kept doors remain materially distinct. |
| 6 | WebGPU | Mass should leave a trace rather than become a performance spectacle. | Open only when a real compute-based question survives the art gate. |

## Autonomous cadence

A deterministic four-hour rotation selects one current per slot. A slot may create at most one real daily work for its current/date pair, then update `studio/data/works.json` and the generated `/works/<id>/` page. A missing date stays absent: no placeholder, stimulus, or prose counts as an artwork.

The daily archival pass checks coverage, routes, Journal links, critiques, lifecycle state, duplicate slots, tests, and evidence under `research/qa/`. The scheduler is a cadence, never evidence that an artwork happened.
