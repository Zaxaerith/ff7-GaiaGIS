# Coordinate spaces

| Space | Meaning | Established transform |
|---|---|---|
| WM0Native / GaiaGame | Original WM0 mesh-placement units | Frozen V1 inverse-Mercator to GaiaGeographic |
| GaiaGeographic | V1 longitude, latitude, assumed raw-height scale | Frozen reference-sphere conversion to GaiaCartesian |
| GaiaCartesian | V1 reference sphere | Existing 13 display projections |
| WM2Native | Archive placement X/Z and signed raw Y | Classic-PC native-to-engine offset only; global geographic mapping not established |
| WM3Native | Independent archive placement X/Z and signed raw Y | No WM0/global transform established |

Native transport order is `(native_x, native_z, raw_height)`. Source normals stay
in raw binary XYZ. The native renderer independently uses `(X,height,Z)` and a
uniform display normalization; exaggeration changes display height only.
No EPSG, physical meters, sea-level datum, latitude or longitude is assigned to
WM2/WM3. Top-down is a native X/Z plane, not a geographic projection. Physical
distance, physical area, routing and gameplay layers are unavailable for these maps.
Native raw X/Z distance, source-face area and gradients are available separately;
see [Native GIS](native-gis.md).

Classic-PC `C_007533AF` places WM2 archive block `(col,row)` at engine block
`(col+3,row+2)`; `C_00750F3C` reverses this block lookup. Thus the documented
reference native-engine relation is `(X+98304,Z+65536)`, without scale. Both
directions are explicit reference logic, not an affine fit from a picture.
Coordinate save/load `C_007660DB/C_0076616A` packs/unpacks model positions.
The surface/undersea dispatcher preserves runtime vehicle position. This does
not establish a shared vertical datum or make WM2 global bathymetry. We retain
the relation as reference evidence and do not compose it into V1 geography in
this release; the current executable equivalence is NOT VERIFIED.

WM3 section placement also uses the engine's 9-column block addressing, but
this is storage/addressing machinery, not proof of a WM0 geographic inset.
Its complete native domain is 65536×65536. Geometric edge periodicity does not
create a spherical or polar reconstruction.

## FieldLocal

Section-5 Field vertices are signed local `x, y, z, padding` components.
`FieldLocal` is distinct from all Gaia geographic/cartesian/game and WM native
spaces. The viewer draws raw XY with +X right and +Y up as an explicitly chosen
plan convention; Z is available for component colouring. These are not metres,
map north, world elevations or a global transform. Padding is preserved without
assigning collision semantics. No Field vertex enters globe projections,
ShareState, routing or user-geometry storage. An existing world Entrance action
continues to borrow only that Entrance's independently validated anchor.


## Camera and registration pixel spaces

Field Camera diagnostics preserve `q = (R / 4096) * XYZ + T` and
`screen = Zoom * q.xy / q.z`; screen Y points down. Non-finite values and
`q.z <= 0.000001` are invalid. The existing Canvas plane negates screen Y,
then applies only the current view's CSS-pixel scale and pan. Canvas clipping,
background-rectangle exclusion, mathematical depth failure and unknown occlusion
are separate facts. All projected 2D triangle/Tile footprints are candidates;
none is automatically the visible object or a unique inverse XYZ.

Reference-image pixels are another coordinate space. The Registration Lab
requires explicit screen and reference rectangles for its crop/scale mapping.
Manual observed points and original XYZ remain separate; visual-only 2D marks
are excluded from geometric accuracy statistics. Residuals are measured in
reference pixels, never metres. No fitting, Camera calibration, coordinate
correction or writeback occurs. Formula agreement, manual correspondences,
runtime images and verified original-game registration are distinct evidence.
