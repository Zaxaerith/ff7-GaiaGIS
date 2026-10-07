# Thirteen views of the frozen V1 sphere

The original five projection implementation files and canonical V1 mapping
remain unchanged. The gallery adds eight independently written spherical forward
formulas. Coordinates are normalized by the existing reference radius for Web
display. No Earth EPSG code is assigned to Gaia. Global projections retain the
existing meridian; LAEA/AEQD share the rotating center behavior of Orthographic.

| Name | Family | Property | Coverage / clipping | Introduced in Viewer | Implementation reference |
|---|---|---|---|---|---|
| Globe | 3D perspective | Perspective | Sphere / occluded back | v1.0 | Existing spherical Cartesian view |
| Equirectangular | Cylindrical | Equidistant along meridians | Global | v1.0 | Existing x = λ, y = φ |
| Mercator | Cylindrical | Conformal | Global / finite pole cutoff | v1.0 | Existing spherical Mercator |
| Mollweide | Pseudocylindrical | Equal-area | Global | v1.0 | Existing iterative auxiliary latitude |
| Orthographic | Azimuthal | Perspective | Visible hemisphere | v1.0 | Existing center-rotated spherical view |
| Equal Earth | Pseudocylindrical | Equal-area | Global | v1.5 | 2018 polynomial definition |
| Winkel Tripel | Compromise | Compromise | Global | v1.5 | Mean of Aitoff and equirectangular; standard parallel acos(2/π) |
| Robinson | Pseudocylindrical | Compromise | Global | v1.5 | Published 5° control table; four-point Lagrange interpolation |
| Natural Earth I | Pseudocylindrical | Compromise | Global | v1.5 | Published polynomial form |
| Sinusoidal | Pseudocylindrical | Equal-area | Global | v1.5 | x = λ cos φ, y = φ |
| Gall–Peters | Cylindrical | Equal-area | Global | v1.5 | Cylindrical equal-area, standard parallels ±45° |
| Lambert Azimuthal Equal-Area | Azimuthal | Equal-area | Rotating whole sphere / antipodal clipping | v1.5 | Spherical LAEA |
| Azimuthal Equidistant | Azimuthal | Equidistant from center | Rotating whole sphere / antipodal clipping | v1.5 | Spherical central-angle formula |

Existing implementation references are the frozen files in
`web/src/projections/`; new formulas are in `gallery.ts`. The registry also
records historical introduction metadata separately from the Viewer versions.
Global maps share the canonical antimeridian and surface seam splitting.
Orthographic hides the far hemisphere; Mercator does not represent the poles.

Registry entries expose stable IDs, translated names, English academic names,
family, property, rotation, clip policy, forward function and bounds. Globe is
a 3D view, not a flat projection. No flat projection preserves area, shape,
distance and direction everywhere. The gallery deliberately provides choices
rather than declaring a single universally correct map.

## Numeric references

Primary definitions/documentation:
[Equal Earth mathematical definition](https://shadedrelief.com/ee_proj/EEp_Math_and_Implementation_details_%202019-04-16.pdf),
[PROJ Equal Earth](https://proj.org/en/stable/operations/projections/eqearth.html),
[Winkel Tripel](https://proj.org/en/stable/operations/projections/wintri.html),
[Robinson](https://proj.org/en/stable/operations/projections/robin.html),
[Natural Earth](https://proj.org/en/stable/operations/projections/natearth.html),
[Natural Earth polynomial research](https://www.ika.ethz.ch/studium/masterarbeit/2011_savric_report.pdf),
[LAEA](https://proj.org/en/stable/operations/projections/laea.html),
[AEQD](https://proj.org/en/stable/operations/projections/aeqd.html).

Synthetic longitude/latitude fixtures were independently computed using
installed GDAL/PROJ spherical operations and normalized only by radius. D3 is
a test-only second oracle, not a runtime dependency. Seven new formulas agree
within numerical tolerance; Robinson is explicitly tested within 3e-4 normalized
units against PROJ between control points because interpolation schemes differ.
The D3 raw Robinson normalization omits the uniform 0.8487 factor; oracle tests
restore it before comparison. No interpolation code was copied.

Finite-difference area Jacobians agree with the sphere for Equal Earth,
Sinusoidal, Gall–Peters, LAEA and existing Mollweide at sampled nonsingular points.
AEQD radial distance is separately checked. This verifies formula properties,
not area preservation of every rasterized/tessellated pixel.

## Clipping and display limits

Exact antipodes use a finite hidden placeholder. LAEA/AEQD visibility omits a
small singular neighborhood; triangles with hidden vertices or projected edges
longer than the projection radius are conservatively hidden. Graticule/route
segments use compatible masks. This prevents giant triangles and opposite-edge
chords; it is not exact curved-boundary tessellation. Small holes near the
antipode are an intentional rendering limitation. Globe/old-five formulas and
canonical triangle identities are unaffected. Marker culling, picking, morph
interruption, reduced motion and mobile gestures use the existing viewer paths.

## Cartographic context

Equal Earth was introduced in 2018 to provide an equal-area alternative with a
familiar world-map outline. Recent “Correct the Map” discussion illustrates why
map area matters in public communication; see the
[African Union communiqué](https://www.au.int/en/pressreleases/20260904/communique-auc-chairperson-adoption-correct-map-resolution).
Advocacy does not remove mathematical tradeoffs. GaiaGIS offers Equal Earth,
Gall–Peters and other projections for comparison; it makes no claim that any
one projection is the only correct view or official FF7 geography.

## Adaptive graticule design

Auto estimates spacing by projecting visible geographic samples through the
active forward formula and camera into CSS pixels, including Globe perspective.
It selects a discrete interval near 120 px, targeting roughly 80–160 px. The
current interval is retained inside a wider 60–190 px hysteresis band. This is a
local estimate; strongly anisotropic projections cannot satisfy both axes
everywhere with a single angular interval.

Candidates: 90, 60, 45, 30, 20, 15, 10, 5, 2, 1, 0.5, 0.25, 0.1 degrees.
Fixed selector: 90, 45, 30, 15, 10, 5, 2, 1, 0.5; plus Auto and Off.
Optional minor lines appear only for clean subdivisions with estimated
28–60 px spacing. They are dimmer and have no labels. Equator and zero meridian
remain visually distinct; zero meridian is a game-coordinate reconstruction
reference, not an assertion of official Gaia geography.

Generation covers a conservative visible geographic window, splits longitude
seams, masks projection boundaries and increases curve sampling step for dense
manual grids to bound work. Updates are throttled and require meaningful camera,
zoom, viewport or interval changes; no unconditional per-frame rebuild occurs.
Labels use Intl numbers and major intervals with screen-space collision checks.

The same screen-policy evaluator is used independently in both comparison
viewports. It samples east/west and north/south near the visible center, averaging
available screen spans. Near a seam or clipped hemisphere, unavailable samples
are omitted. A normalized zoom change of about 2.5%, center movement of about
0.5°, resize or policy change invalidates the estimate. Regeneration is throttled
to 180 ms and still requires a changed snapped grid window or interval.
Dense manual grids coarsen curved-line sampling rather than silently changing
the requested degree interval. Auto cannot promise equal spacing everywhere on
an anisotropic projection. Labels are capped at eleven collision-tested major
coordinates; minor lines have no labels.

## Reference-sphere measurements

Measurements are user-created analysis, not FF7 POIs or source geometry edits.
They retain a mapId analysis scope; the current Viewer is WM0/V1 only.
The assumed radius is 6371008.8 m. Height does not enter these measurements.

Distance sums minor great-circle arcs using atan2(norm(cross), dot) of unit
vectors. Drawing uses spherical interpolation and existing antimeridian-safe
line splitting. Antipodal edges have no unique minor arc and are rejected.
Area sums oriented spherical triangle solid angles (atan2 determinant formula),
normalizes to the smaller complementary region and reports km² and sphere %.
Both ring orientations are accepted; self-intersecting and antipodal-edge rings
are rejected. Large/complementary-region interpretation is explicit: this tool
does not ask which side of a global polygon the user means. Maximum 512 points.
Repeated spherical vertices are rejected. A reference direction away from all
ring edges avoids ambiguous fan diagonals even when nonadjacent vertices are
antipodal. The drawn polygon is a closed geodesic boundary rather than an
uncertain projection-space fill. Undo/finish/clear controls retain transient
browser-local state only.

Stored lon/lat points and numerical results are projection-independent.
Changing a view only projects drawing buffers. Surface clicks use the existing
rendered surface hit followed by bounded display inversion for 2D views, or
normalized spherical direction on Globe. These are visualization picking
coordinates, not Stage 1 survey precision. Exact lon/lat entry is also available.
Source lineage and canonical coordinates are never edited.

Independent synthetic tests use analytic arcs/octants and
[D3 spherical math](https://d3js.org/d3-geo/math) as a test-only area oracle.

## Local projection distortion

The frozen thirteen forward formulas are the sole projection definitions.
For 2D views, centered finite differences in longitude/latitude (step 1e-5
radians) form a local Jacobian in orthonormal east/north sphere coordinates.
The longitude derivative is divided by cos(latitude). The determinant is area
scale; singular values give maximum/minimum scale; column lengths give parallel
and meridional scale. Maximum angular deformation is
2 asin((max-min)/(max+min)), in degrees. These dimensionless scales compare the
projection plane to the reference sphere, not to FF7 physical accuracy.

Tissot ellipses use this Jacobian on a 30° sampling grid and an illustrative 2°
tangent-circle radius. Globe has no intrinsic planar Jacobian and hides this
layer. Pole, seam, hidden hemisphere and antipodal singular samples are omitted.
This is local differential analysis, not a quality percentage or global error
rating. Equal Earth/Mollweide/Sinusoidal/Gall–Peters/LAEA are area-preserving;
Mercator is conformal with increasing latitude-dependent area scale. Neither
property preserves every other cartographic quantity.

Primary reference for cartographic factor terminology:
[PROJ factors](https://proj.org/en/stable/development/reference/functions.html#c.proj_factors).
Analytic properties and independent numerical fixtures cross-check the evaluator.
No runtime PROJ/D3 dependency or second projection formula is introduced.

Tests cross-check area factors against independent D3 forward differences,
spherical areas against D3 geoArea, and analytic unit-area/Mercator secant/AEQD
center properties. The unchanged forward formulas are also covered by the
existing D3/PROJ projection fixtures. Exact poles, the ±180° derivative seam,
hidden Orthographic samples and singular antipodal neighborhoods are unavailable,
not zero distortion. Tissot samples above maximum scale 20 are omitted; each
ellipse has 32 segments. These numerical guards are deliberately conservative.

## Comparison scope

Projection comparison links a geographic center and normalized zoom, with a
temporary second projected display buffer/renderer. It shares the source mesh,
attributes and datasets; it does not rebuild source geometry or graph topology.
The second viewport is removed and its resources disposed when closed. On mobile
the views stack vertically. Left/top is the navigation authority; the second
view follows location fly-to, routes and user measurements.
Its position/mask buffers and cameras are reused, while source attributes/color
and the display-to-source lineage remain shared. Each view independently chooses
adaptive grid spacing. Normalized zoom uses each projection's viewport fit;
Globe keeps the camera outside the surface. Panning a planar center outside the
projection retains the last resolved geographic center for B and explicitly
labels that limitation. Follow-center distortion is unavailable there.

Traversal comparison reuses v1.3 ordinary terrain occupancy rules. Reachability
comparison uses v1.5 conservative source-edge components, seeded by all verified
entrance triangles at the selected From location. These are different operations.
Four classes: A only, B only, Both, Neither. Synthetic caps are outside gameplay
analysis. Runtime/story/save state, bridges and vehicle boarding are not solved.
Terrain comparison includes only ordinary Allowed occupancy. Conditional and
Unknown are excluded. Reachability/routes honor the shared conditional-terrain
option; it defaults off. The four colors classify membership, not four levels of
runtime availability. Existing tracks/events/corridor highlights remain separate.

Route comparison independently evaluates all nine existing routing profiles
with the same From/To and conditional policy. Results preserve entrance IDs,
node count, reference distance and component. At most three selected corridors
are drawn. No automatic vehicle transfer, new routing topology or travel-time
model is introduced. Missing optional graph/Locations keeps the other tools
available. Highwind Landing remains a separate diagnostic, not a route mode.

No new local-generated dataset is introduced. Analysis interfaces carry mapId
scope from source lineage; this release actually uses WM0 only. A small surface
material factory separates render material creation from analysis colors, without
adding textures or models. This keeps a future material mode possible while
retaining the present one-surface architecture.

## Canonical source height and visual relief

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

## Local horizontal scale and layer presentation

The scale bar estimates distance represented by a short horizontal screen segment
near the current viewport center. It is local, not a constant for a projection.
Planar projections cast the screen samples onto the display plane and use existing
`inverseDisplay` plus existing reference-sphere `measureDistance`. Mercator therefore
changes with latitude; Equal Earth and other projections use their actual inverse
finite differences. Existing projection formulas and V1 radius are unchanged.

Globe samples intersect the assumed reference sphere through the current camera.
The existing geographic conversion and great-circle distance measure the two hits.
No intersection, unresolved inverse, singular/unstable distance, projection morph,
Explorer or native map hides the bar. Relief is not interpreted as horizontal terrain
distance. The tooltip identifies the V1 reference-sphere assumption. Scale visibility
is a central navigation preference, adjustable in View.

Eight registered opacity controls cover Terrain tint, Encounters, Traversal,
Reachability, Events, Atlas, Distortion/Tissot and Routes. Values persist together in
user state, and Reset layers restores default visibility and opacity. Controls require
the appropriate loaded WM0 data and are unavailable in public/native/Explorer states
that lack it. Opacity changes render presentation only. Base terrain/texture surfaces
remain opaque; selected marker/Inspector/critical selection styling stays readable.

The existing terrain legend (also reused for encounters/traversal) and Chocobo Tracks
legend move into Layers → Map legend, with an Atlas representative-point note.
Existing analysis metrics/keys remain beside their analysis tools. Projection Compare
uses shared surface colors and synchronizes applicable event/route/Tissot opacity.
Original textures, UVs, relief and source geometry are unchanged.

Pure tests check Mercator equator/high latitude, ten other planar projection inverses,
and Globe hit/miss behavior. Browser acceptance exercises Mercator, Equal Earth,
Globe, native hiding, layer preferences and Projection Compare.
