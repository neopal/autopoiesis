---
version: alpha
name: Mutine Gallery
description: A public artist studio: an explore/monitor surface, not a product landing page.
colors:
  paper: "#e9e4d6"
  ink: "#151514"
  ash: "#6d675e"
  signal: "#b93c2e"
  night: "#171716"
typography:
  display:
    fontFamily: "Georgia"
    fontSize: "clamp(3rem, 9vw, 9rem)"
    fontWeight: 500
    lineHeight: 0.82
    letterSpacing: "-0.08em"
  body:
    fontFamily: "ui-monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
spacing:
  edge: 4vw
  unit: 12px
components:
  action:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: 0px
    padding: 12px
---

## Overview

The gallery is an **Explore / Monitor** surface. It should feel like a wall of evidence from a living studio: one work runs, every other chantier has an honest state, and journals/critique/evaluation are accessible without narrative scaffolding. English is the default and copy is kept to labels, questions and actions.

## Colors

Paper and ink are the default substrate. Signal red marks mutation or alert only. Night is a deliberate room, not a dark-mode toggle.

## Typography

The display serif is reserved for the work’s question. Monospace is evidence: version, state, logs, metrics.

## Layout

No centered hero. The primary composition is a continuous vertical studio wall: work viewport, studio register, then evidence rail. On mobile it becomes a sequence without hiding any chantier.

## Components

Cards have no soft radius and no decorative icon. State is carried by a word, a mark and density.

## Do's and Don'ts

- Do let an empty chantier look intentionally dormant.
- Do not fabricate images, scores or activity for work that has not happened.
- Do not use gradients, glass, feature tiles or generic SaaS dashboard language.
