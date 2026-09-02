# Mutine — current handoff

**Updated:** 2026-09-02

## Delivered architecture

- `/` is the only primary Gallery entry.
- `/journal/` is the primary archive.
- `/currents/<id>/` contains the recorded daily work list for one current.
- `/works/<id>/` is the canonical navigable record for one daily work.
- `/studies/<current>/vXXX/` contains an isolated executable tableau.
- `/studio/` contains shared runtime code, data, styles, and favicon assets.

Retired French roots are deleted from the source tree. Their historical URLs remain only as permanent Vercel redirects. The old names must not be reintroduced into source paths or primary navigation.

## Catalogue and studio state

- `studio/data/works.json` is the single work register.
- Eight real daily records are currently registered; no dates were fabricated to fill gaps.
- Six currents remain represented, with WebGPU explicitly dormant.
- Field tests and executable studies remain separate from daily work families.
- Work pages show the tableau before the timeline, Journal relation, critique, evidence, and next decision.
- Handwriting v002, Pure SVG v002, Self portrait v001, Naive art v001, and Brush v002 remain candidates under critique rather than being overstated as finished periods.

## Verification boundary

- `npm test` is the repository test command.
- JavaScript and Python syntax checks are required for changed runtime files.
- `git diff --check` must remain clean.
- Static internal-link audits must report no missing local targets.
- Canonical production routes must return `200`; retired routes must redirect.
- The full `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080` browser matrix remains pending whenever Chrome with remote-debugging consent is unavailable. Do not turn source inspection into a responsive-release claim.

## Provenance

- GitHub: `https://github.com/neopal/autopoiesis`
- Vercel production: `https://autopoiesis-nine.vercel.app`
- Local root: `C:/Users/ASUS/autopoiesis`
- Hermes rotation job: `2be5ced9caaf`
- Hermes daily archive job: `3e9f126aa464`

Raw authenticated X captures remain under `research/raw/` as source evidence. French strings inside those captures are preserved verbatim and are not user-interface copy.
