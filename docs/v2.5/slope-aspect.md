# Source TIN slope and aspect

Each existing WM0 source face supplies raw `(X, Z, game_height)` corners through
the frozen Explorer inverse mapping. No raster or new coordinate authority exists.
For plane height h = aX + bZ + c, solve a/b from the two horizontal edge vectors.
Slope = atan(hypot(a,b) × vertical_scale / horizontal_scale), in degrees.

Both configured source-space scales are 1 per raw unit. These are **source-space
slope degrees**, not physical real-world Gaia terrain slope: the reference sphere
has latitude-dependent inverse-Mercator horizontal distances. Display-height metres
do not establish a constant physical horizontal metres/raw scale. Relief changes
rendering only and never changes analysis.

Increasing X maps east; decreasing Z maps north in the existing V1 mapping.
Downslope east = −a, north = b. Aspect = atan2(−a,b), wrapped to [0,360).
0° N, 90° E, 180° S, 270° W. Gradient magnitude below 1e-8 has undefined aspect.
Near-zero horizontal determinant has undefined slope/aspect, including vertical
and degenerate faces. UI renders undefined separately instead of inventing north.

Two Float32 arrays retain one attribute per 142,586 source triangles (1,140,688
bytes). They are lazily computed once per loaded viewer, released with that owner
and never recomputed per frame/projection. Caps are excluded. Slope uses a continuous
ramp from existing thematic color families; aspect uses eight readable directions.
Both integrate registered opacity/reset and Layers legends.

Rendering uses existing render-to-source lineage and shared color buffers, including
projection comparison. All thirteen projection formulas/morph semantics remain
unchanged. WM2/WM3 and active Explorer expose these overview analyses as unavailable.
Performance and browser checks are recorded in validation.md.
