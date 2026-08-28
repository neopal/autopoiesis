---
version: alpha
name: Mutine Exhibition System
description: A quiet, severe browser-art studio. The interface is an instrument for encounter, never a product shell.
colors:
  primary: "#141310"
  paper: "#E6DFCE"
  ash: "#625D54"
  wound: "#B4412D"
  night: "#1A1915"
  paleInk: "#EEE8DB"
typography:
  display:
    fontFamily: "Instrument Serif"
    fontSize: 7.75rem
    fontWeight: 400
    lineHeight: 0.78
    letterSpacing: "-0.065em"
  body:
    fontFamily: "DM Mono"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Mono"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  sharp: 0px
spacing:
  unit: 8px
  edge: 20px
  desktop-edge: 5vw
components:
  action:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sharp}"
    padding: 12px
  evidence:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ash}"
    rounded: "{rounded.sharp}"
    padding: 8px
  inversion:
    backgroundColor: "{colors.night}"
    textColor: "{colors.paleInk}"
    rounded: "{rounded.sharp}"
    padding: 12px
  action-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sharp}"
    padding: 12px
  critical-mark:
    backgroundColor: "{colors.wound}"
    textColor: "{colors.paleInk}"
    rounded: "{rounded.sharp}"
    padding: 8px
---

## Overview

Primary surface: **Explore / Inspect**. A Mutine page is a field that can be entered, not a landing page, dashboard, or catalogue. On a work page, the artwork owns the first viewport; interpretation must arrive after contact, never before it.

## Colors

Paper is warm but never nostalgic. Ink carries structure. Wound is a single operational signal: selection, irreversible intervention, or a known break. It must not be used as decoration. Night is reserved for an actual inversion of the work, never a cosmetic dark-mode toggle.

## Typography

Display type is editorial and physical. Mono is for evidence, controls, dates, and technical trace only. Body prose is short: a page should rarely have more than 120 words before the work is encountered.

## Layout

Desktop and mobile are separate compositions. No layout may depend on clipped overflow. Mobile minimum action target: 44px. Work canvas has precedence over title block; pages reflow rather than shrinking a desktop poster.

## Elevation & Depth

No shadows, blur, glass, gradients, rounded cards, icon tiles, or ornamental borders. Depth can occur only through canvas layers, time, occlusion, or a true black/ink overlay.

## Shapes

All controls are rectangular and sharp. Lines are hairlines. A circle has meaning only when it marks a work, an event, or a force inside an artwork.

## Components

A control must reveal a change in the work’s behavior, not just style. An inspector is a reversible reading surface. A critical mark is an irreversible action or known failure.

## Do's and Don'ts

- Do let the canvas challenge the surrounding system.
- Do show source, critique, and consequence as evidence after the encounter.
- Do preserve room for failure and deletion.
- Do not use generic feature grids, invented metrics, isolated texture, or controls that only make the work prettier.
- Do not announce a period until several versions prove a shared formal break.
