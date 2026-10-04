# Canonical source height and visual relief

WM0 source height ranges from -738 to 4086 raw units. Canonical height remains
`height_m = game_height * 1 m/raw unit`, a GaiaGIS assumption, not an official
FF7 physical measurement. Radius remains 6,371,008.8 m. No V1 mapping or projection
formula changes in v1.7.

Only Globe display positions use:

`R_display = R_Gaia + visual_exaggeration * canonical_height_m`

Presets are 0×, 1×, 10×, 25×, 50× and 100×; Custom is bounded to 0–100×.
0× is the pure reference sphere, 1× preserves the existing assumed height scale.
Exaggerated display height is not real elevation. Updates read existing height
arrays; no source reparse or new lineage is involved. Globe morph endpoints use
current visual relief; every 2D endpoint remains the existing canonical projection
plane. Changing relief during a morph updates a Globe destination; an outgoing
morph retains its displayed starting position until the next Globe view.

Relief Shading is off by default. When on, normals come from derivatives of the
actual displayed face positions, not FF7 flat-map normals. A simple 0.65 ambient
plus 0.35 fixed-direction contribution is used; face normal sign is symmetric
for the double-sided surface. This is faceted visual lighting, not GIS hillshade,
PBR or a sunlight/atmosphere simulation. Existing gentle Globe Depth is bypassed
for original artwork or relief shading, preventing double lighting/gamma shifts.
2D projections do not receive radial relief or relief shading.

Raycasting uses the actual display position buffer and returns its unchanged
render-to-source triangle lookup. Transparent texture samples are rejected
consistently with the shader. Source-anchored Location/Event markers use their
canonical height multiplied by relief plus the existing small clearance. Route
display heights use canonical node/triangle heights, multiplied before adding
clearance. Both comparison viewports use the same policy. No claim of moving
objects' current positions is introduced.

Adaptive graticules and measurements remain reference-sphere overlays, rendered
without surface depth testing to remain readable. They do not define a new
terrain-following coordinate system. Distance/area values, canonical Inspector
height, POI/event coordinates, routing graph/weights, gameplay rules, GIS outputs,
longitude/latitude and source lineage remain unchanged at every relief value.
