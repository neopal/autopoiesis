# Gallery daily architecture — 2026-09-02

## Release note

This note records the final English route migration and the current Vercel release boundary.

## Delivered

- `index.html` is the only Gallery entry.
- `journal/index.html` is the primary archive.
- `currents/`, `works/`, and `studies/` are the canonical public namespaces.
- `studio/` owns the runtime renderer, data, styles, favicon, and raw-route bridge.
- `studio/data/works.json` is the single daily work register.
- Work pages show the tableau, date/status, current timeline, Journal relation, critiques, evidence, and next decision.
- Eight real daily records are present; no historical date was fabricated.
- Field tests remain outside the main catalogue and WebGPU remains dormant.

## Retired surfaces

The source directories formerly named `galerie/`, `courants/`, `oeuvres/`, `chantiers/`, and `atelier/` are no longer active source surfaces. Historical URLs are covered by permanent Vercel redirects, including raw study paths and the former French handwriting slug. No redirect target restores an old directory.

## Verification contract

- `npm test` must pass.
- Runtime JavaScript and Python files must pass syntax checks.
- `git diff --check` must pass.
- Static HTML link audit must report zero missing local targets.
- Canonical production pages must return `200` and historical pages must redirect.
- A Chrome browser matrix at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080` is a separate release gate. It remains explicitly blocked when Chrome remote-debugging consent is unavailable.

## Provenance boundary

A successful Vercel CLI deployment proves the stable alias was updated; it does not prove that GitHub is synchronized. GitHub synchronization requires a separate commit and push, followed by a read-back of the remote branch.
