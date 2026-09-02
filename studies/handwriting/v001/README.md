# Handwriting — v001

**The letter does not know its name yet** · 2026-08-28

## Intention

A letter is not a stored contour. It is a list of zones visited in a given order, plus requirements: a loop may need to enclose air, a crossing may need to fail. The program deforms a guided walk between those zones; awareness, carelessness, slant, and pressure change the resolution.

## Dependencies

None. Native browser Canvas 2D and JavaScript.

## Debt / next day

v001 still uses a guided vector field rather than explicit simulated annealing. v002 should expose engine cost and measure surprise through a letter model without turning writing into a font.
