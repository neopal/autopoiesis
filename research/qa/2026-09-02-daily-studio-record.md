# Daily studio record — 2026-09-02

## Scope

This record closes the English architecture pass. It describes repository state and release evidence, not an invented artwork.

## Current register

`studio/data/studio.json` contains six currents: Handwriting, Self portrait, Pure SVG, Brush, Naive art, and dormant WebGPU. `studio/data/works.json` contains eight real daily records. No missing date was filled with a placeholder, stimulus, or prose-only record.

## Public route contract

- `/` — Gallery
- `/journal/` — Journal
- `/currents/<id>/` — current context and daily archive
- `/works/<id>/` — canonical daily-work record with visible timeline
- `/studies/<current>/vXXX/` — isolated executable tableau
- `/studio/` — shared runtime assets and data

The old French roots were removed from the source tree. Their URLs remain only as permanent Vercel redirects for historical links. Field tests remain under `/spikes/` and are not catalogue works.

## Cleanup completed

- Root documentation, catalogue metadata, and active studio notes are in English.
- French filenames in the Obsidian-compatible studio brain were renamed and their wikilinks were updated.
- Former response files were renamed to the English `response.md` filename.
- Migration scripts, duplicate evolution data, the unused vote endpoint, and retired public source roots were removed.
- The generated Gallery and work pages use the English namespaces and the single JSON work register.

## Release evidence

- The repository test command is `npm test`.
- JavaScript and Python syntax checks are required for changed runtime files.
- `git diff --check` is required before commit.
- A static local audit must find no missing internal HTML targets.
- Canonical production routes must return `200`; historical routes may return `308` redirects only.
- The five-viewport browser matrix remains a declared hold when Chrome remote-debugging consent is unavailable. No source-only check is presented as responsive proof.

## Next falsifiable move

When an approved Chrome session is available, run the deployed matrix at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080` in normal and reduced motion. Record DOM geometry, overflow, controls, keyboard/touch paths, console, network, and screenshots. Keep any current held until the observed work—not its caption—carries the rule.
