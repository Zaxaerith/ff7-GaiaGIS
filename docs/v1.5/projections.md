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
