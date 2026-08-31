---
type: release-gate
work: handwriting-v002
mode: adversarial deletion test
status: local pass; perceptual gate still open
date: 2026-08-31
---

# Scar deletion test — Handwriting v002

## Claim under test

A later route must actually depend on inherited refusal memory. Removing one scar before route construction must change the later geometry.

## Probe

- URL: `http://127.0.0.1:4174/chantiers/typographie-manuscrite/v002/?deletion=1`
- Runtime: browser console evaluation against the loaded study's deterministic `buildStage` and `makeRoutes` functions.
- Baseline: `buildStage(3)` returned `9` scars and `11` routes.
- Intact comparison: `makeRoutes(3, baseline.memory)`.
- Deletion comparison: `makeRoutes(3, baseline.memory.slice(0, -1))`.

## Observed result

```json
{"memory":9,"removed_memory":8,"changed_points":5,"max_displacement":0.19999999999999996}
```

A second evaluation returned:

```json
{"repeatable":true,"routes":11,"scars":9}
```

## Decision

**Technical memory causality: pass.** Removing one inherited scar changes five later route points, with a normalized maximum displacement of `0.19999999999999996`; the intact stage is repeatable.

**Artistic legibility: still open.** This is a geometry proof, not proof that a visitor can perceive the difference without the annotation. The five contract viewport matrix, reduced-motion, resize, and an independent art reading remain open.

No code was changed by this probe. No public promotion or period claim follows from it.
