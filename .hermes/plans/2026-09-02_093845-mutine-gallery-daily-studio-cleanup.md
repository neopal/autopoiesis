# Mutine — English architecture final record

> This file began as an implementation plan. It is now the concise, verified record of the architecture that was actually shipped.

**Date:** 2026-09-02
**Status:** implemented locally; release verification follows the checklist below.

## Goal

Give Mutine a stable browser-art studio where the artist can work from a truthful catalogue, readable lineage, English public surfaces, separated executable studies, and a deployable release path.

## Canonical public architecture

```text
/                              Gallery
/journal/                      Journal archive
/currents/<current>/           one contextual room per current
/works/<daily-work-id>/        one navigable daily work record
/studies/<current>/vXXX/       isolated executable study
/studio/                       shared runtime assets and catalogue code
```

The root Gallery is the only primary exhibition entry. Primary navigation exposes Gallery and Journal; currents and works are reached through contextual links, cards, timelines, and breadcrumbs.

## Catalogue contract

`studio/data/works.json` is the single work register. `studio/data/studio.json` contains current identity and cadence policy. The renderer derives Gallery cards, current grids, work detail, Journal links, critiques, decisions, and timelines from those records rather than maintaining duplicate HTML inventories.

A record follows this lineage:

```text
current → work family → selected version → framed tableau → journal / critique / evidence
```

- A Gallery card represents a work family, not an independent version.
- A work page exposes the selected version and its same-current timeline.
- Missing or rejected work is recorded as a hold, never fabricated as a visual placeholder.
- Field tests and executable studies remain outside the daily work catalogue.
- WebGPU stays dormant until a real work requires it.

The six registered currents are Handwriting, Self portrait, Pure SVG, Brush, Naive art, and WebGPU. The register contains eight real daily records and preserves their real dates.

## English cleanup

- Public titles, cartels, messages, routes, study labels, and active documentation use English.
- Retired localized namespaces have no source directories or public index pages.
- Compatibility aliases are confined to `vercel.json` and their route tests; they do not appear in primary navigation.
- Executable study assets use English filenames, including `response.md`.
- The studio brain uses English filenames and English links.
- Raw source captures remain literal evidence. Their provider language is not Mutine copy and is explained by `research/raw/README.md`.
- Dated QA records remain evidence, including pre-migration observations. Their role is explained by `research/qa/README.md`.

## Daily operation

- `scripts/daily-studio-slot.py` selects a deterministic current for a time slot without mutating the catalogue.
- `scripts/generate-work-pages.mjs` generates the canonical daily work pages from the register.
- Hermes runs one rotation job every four hours and one archive job daily at 09:00.
- A scheduler selection is not evidence that an artwork exists; a work enters the register only after its record and validation exist.

## Verification record

The release gate has passed:

- `npm test`: 31 tests passed.
- JavaScript syntax checks passed for catalogue, route bridge, and generator files.
- Python syntax compilation passed for the daily slot helper.
- `git diff --check` passed.
- Static HTML route and target checks passed for the canonical tree.
- Local smoke checks returned `200` for Gallery, Journal, a current, a daily work, an executable study, and the catalogue asset.
- Production checks must be repeated after the final Vercel deployment and recorded with its URL.

## Release discipline

GitHub provenance and Vercel provenance are separate:

1. validate the staged tree;
2. commit the validated tree on `main`;
3. push `main` to the configured GitHub remote;
4. deploy that committed tree to Vercel;
5. read back the production alias and canonical routes.

A successful Git push does not prove Vercel content. A successful Vercel CLI exit does not prove GitHub synchronization. Both are verified independently.

## Remaining boundary

The five-viewport responsive matrix is represented in the QA evidence, but a new Chrome remote-debugging pass may still require the user's browser consent. That limitation must remain explicit rather than being converted into an unverified claim.
