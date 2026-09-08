# Handwriting v004 — The sentence loses its place

## State

`v004` is a daily work candidate, recorded as **candidate / held**. It is not promoted to a finished period.

## Hypothesis

The previous mutation made memory visible as a second hand. That branch risked becoming an elegant annotation. This version asks whether a refusal can stay inside one hand as a lost beat: the route opens, skips, and returns displaced.

## Changed rule

A remembered refusal no longer creates `branchPoints`. When later routes feel its pressure, the engine sets a `gapStart` / `gapEnd`, displaces all later coordinates, and exposes a rebuilt `reentryPoints` slice. The visible gap is therefore paired with changed downstream geometry.

## Visible consequence

At the settled stage, thirteen sentence-like routes pass across a dark ruled field. Pale lines break around remembered refusals and return with a lime re-entry tick; coral refusal notches remain small witnesses, not the whole explanation. Earlier route strata stay faintly present as an atmosphere of attempted sentences.

## Visitor action

On an interactive preview, `lift a refusal` removes one remembered refusal from the reconstruction and redraws the later field. `restore sentence` reinstates it. The canvas also supports focus + `Space` / `Enter`, arrow-key selection, `R` restore, and `S` still export.

## Determinism

The fixed numeric seed `MASTER_SEED = 0x6d757469` is combined with the stage. `buildStage(stage, { omitScarId })` reconstructs memory from the seed; it does not use browser history or local storage.

## Falsifier and deletion condition

Hide the small coral witnesses and compare the settled field with and without one refusal. Delete this direction if the same downstream lost place cannot be identified, if the gap is the only meaning, or if lifting a refusal leaves later coordinates unchanged.

## Evidence boundary

The engine and tableau contract tests pass. A local raw preview was loaded and visually inspected at the tool's `1264×625` viewport; the canvas filled the viewport and the document had no horizontal overflow. The canonical work route loaded its iframe, tableau-first markup, and action buttons. The embedded-iframe click probe did not yield an observable state change, direct raw interactive navigation hit a browser-tool UTF-8 decoding failure, and the browser then raised an idempotent/no-progress guardrail. Responsive matrix, runtime interaction, reduced-motion, network-failure, and independent caption-free critique evidence therefore remain unresolved. This packet does not claim those gates passed.
