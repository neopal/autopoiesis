# Mutine Brush v025 — The paint folds its weight inward.

## Creative concept

v025 abandons Brush's recent flat-body grammars. The first encounter is one suspended pigment membrane: a warm, weathered surface hanging in a dark spatial field. It is not a ribbon waiting for a stroke, a connected station body, or a bridge whose middle can disappear. It is a material sheet whose lower mass must answer when a seam becomes a hinge.

The visitor clicks one seam. The event commits immediately. Every row below that seam folds through depth, not as a decorative rotation but as changed mesh coordinates. A later hinge is calculated from the already displaced surface, so the membrane carries its load forward. The question is whether paint can remember pressure as spatial weight instead of as a mark, a scar, or a missing interval.

## Hypothesis

If a single spatially chosen seam changes the actual x/y/z geometry of the material below it, and later seams inherit that displacement, then brush material can remember an encounter as load-bearing depth rather than as a stroke or overlay.

## Changed rule

v025 makes one primary structural rupture relative to Brush v022–v024:

- **representation:** a single hanging membrane rendered as a 3D mesh instead of a continuous 2D pigment field, an inline-SVG station body, or a flat bridge;
- **encounter:** one immediate spatial hinge selected by the visitor's seam position instead of hold, approach-and-depart, or two-touch completion;
- **memory:** the lower membrane folds through actual depth, and every later hinge is applied to the already folded mesh; lifting the latest hinge rebuilds the exact preceding surface.

The engine uses a seeded 9 × 17 mesh and bounded memory of three hinge events. Each frame is rebuilt from the seeded base membrane and event memory. The rendered geometry is not a coloured sticker on a fixed plane: x, y, z, fold, and load all change below the selected seam.

## Expected visible consequence

Blind, labels-off viewing should first read as one hanging pigment membrane with a slightly skewed, weighted lower edge. After a click, a visible crease forms at one seam and the lower portion turns into depth, producing a silhouette break and an exposed underside. A second click must compound the first displacement, so the object becomes a remembered material situation rather than a sequence of independent effects.

## Cultural translation

Reference: [little-critters](https://github.com/GordenSun/little-critters)

Observed mechanism: situated code-drawn agents make pointer proximity a change in attention and create a reciprocal encounter, so the visitor is part of a relation rather than operating a dashboard.

Mutine translation: refuse animals, eyes, paper scene, and look-back imagery. Translate situated reciprocity into a material hinge: when the visitor addresses one seam, the membrane answers at that place by changing the load-bearing geometry below it. The answer is not a face or cursor; it is the altered depth of the paint itself.

Visible consequence: the first render is a spatial membrane, not a flat drawing. A single click changes real lower-row coordinates; later folds inherit the prior displacement and remain visible in silhouette and depth.

Falsifier: if a click only changes colour or a marker, if lower rows keep the original x/y/z positions, if later folds start from the original flat state, or if the blind view reads as a generic WebGL card, the translation fails.

Anti-copy: no animals, characters, eyes, paper style, head-turning scene, source palette, source composition, source code, API surface, or surface vocabulary from little-critters is reproduced.

Direction consequence: this closes Brush's pressure / witness / span sequence and opens a spatial-material direction in which paint remembers weight by carrying a deformed surface forward through depth.

## Interaction and replay

- Click one visible seam in the membrane to commit one hinge. The lower material folds through depth.
- Enter or Space commits the seeded next seam without needing a pointer.
- Delete or “lift latest” removes only the newest hinge and restores the exact preceding membrane signature.
- R or “release membrane” clears visitor memory and returns to the deterministic first membrane.
- S exports the current p5 canvas as PNG.

Seed: `0x42525545`. The engine uses a local seeded PRNG, a 9 × 17 mesh, and a memory window of three hinges. Reduced motion opens at the settled deterministic sequence; interaction can still hinge, lift, and release the membrane.

## Falsifier and deletion condition

Delete v025 if labels-off, controls-off viewing cannot communicate one spatial membrane and a visible depth fold; if a hinge changes only colour; if lower rows do not move in actual geometry; if a later hinge forgets the prior load; or if the 3D medium reads as a generic technical demo rather than material resistance.

## Evidence boundary

This is a candidate / held daily work until local and production headless browser matrices, interaction readback, route/readback checks, and an independent caption-free perceptual comparison are observed. Engine tests prove deterministic depth geometry and reversible hinge memory; they do not prove that the membrane reads as spatial material memory without the caption.
