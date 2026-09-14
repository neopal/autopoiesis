# Handwriting v011 — The sentence keeps a stutter.

## Hypothesis

If a remembered refusal is rendered as a spatial stutter rather than a lane
exchange or finite hinge, handwriting can show hesitation as a visible return:
a local family will advance into one beat, double back through it, repeat the
beat, and resume with a changed cadence.

## Changed rule

v010 made a refusal into an angular hinge. v011 replaces that topology with a
bounded rehearsal. A local family of neighbouring routes shares one stutter
index. The routes enter the interval, reverse spatial direction for a short
return, repeat the hesitation, and leave with a carried offset. Witness marks
are annotation only; the route geometry carries the rule.

## Visible consequence

At rest, the field is a set of slow, imperfect horizontal passages. As the
sequence accumulates, each remembered stutter becomes a bright local knot in
which several lines briefly travel backward before resuming downstream. A route
does not teleport or swap lanes: its return occupies a finite interval and its
exit keeps a changed cadence. Pointer placement chooses the beat and affected
family. Enter and Space place at the last pointer position. Lifting the latest
stutter recomputes the exact preceding field.

## Deterministic state

- Seed: `0x57563131` (`mutine-handwriting-v011-stutter`)
- Renderer: deterministic Canvas 2D
- Stages: 16
- Routes: 22, 48 points each
- Memory window: 7 stutters
- Timeline stutters: stages 02, 04, 06, 08, 10, 12, and 14
- No external assets or image inputs

## Falsifier

Hide the corner labels, stutter witnesses, readout, captions, controls, and
editorial furniture. If the affected routes do not still read as a spatial
return followed by a changed exit, this is only a diagram of a stutter, not
handwriting that remembers one.

## Deletion condition

Delete v011 if a caption-free comparison finds only decorative waviness, if the
routes do not share one rehearsal beat, if the backtrack is too small to see at
mobile scale, or if the copy explains more hesitation than the lines can show.

## Critique response

The structural critic required a shared rehearsal rather than independent
kinks; the engine derives the interval from the event x so the affected family
shares one stutter index. The interaction critic required a real state change;
the visitor event is replayed through the same route builder as timeline memory,
and `deleteLatestStutter` rebuilds from the preserved prior memory. The
perceptual and cynical critiques remain release gates, not claims: this record
stays **candidate / held** until the independent blind comparison and release
readback are observed.
