---
type: qa-pulse
mode: test
date: 2026-08-29
scope: P0 deployed compatibility evidence
status: blocked-before-measurement; no production change
---
# Deployed browser probe availability — 2026-08-29

## Pulse brief

- **Active/chosen chantier:** P0 responsive compatibility for the period field and the two active v001 routes; no third chantier opened.
- **Question:** Can a permission-available browser session capture the valid deployed closed/open compatibility matrix required before a regression fix?
- **Mode:** `test`.
- **Falsifier:** a browser connection is available and yields a matrix with declared target viewport, `innerWidth`, `clientWidth`, `scrollWidth`, offending-element geometry, interaction, reduced-motion, console, and network evidence.
- **Bounded output / stop condition:** establish browser-probe availability and, only if available, capture the deployed matrix. Do not change code, deploy, commit, or claim release.

## Observed attempt

At `https://autopoiesis-nine.vercel.app/`, the browser harness stopped before navigation and DOM access. Its exact result was:

> `browser-harness: Chrome is asking "Allow remote debugging?" — click Allow to continue.`
>
> `browser-harness: permission-blocked: wait for the user to click Allow in the Chrome permission popup before retrying.`

No DOM, viewport, console, network, interaction, or screenshot data was collected. The agent did not click the permission dialog. Therefore this packet cannot confirm, refute, or localize the prior overflow hypothesis.

## Consequence

The P0 release block remains unresolved. The narrow-touch-target finding and the alleged field-wide overflow remain unverified by the required valid browser probe in this packet. No red test and no CSS correction are justified because there is still no observed offending element/state.

## Handoff

- **Changed rule:** browser QA evidence is absent when the debugger transport is permission-blocked; a prior report cannot be backfilled from source inspection.
- **Observed consequence:** the closed/open deployed compatibility matrix did not start, so no implementation action follows.
- **Criticism accepted / resisted:** accepted the requirement to obtain valid target viewport and offender geometry before a fix; resisted inferring either geometry or interaction results from static CSS.
- **Next question:** when remote debugging is explicitly allowed, can one deployed run collect the closed/open field and active-route matrix at all five contract viewports?
- **Hypothesis died:** none. The root-cause hypothesis remains unresolved; no art hypothesis died.
