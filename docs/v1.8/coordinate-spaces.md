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
distance, area, routing and gameplay layers are unavailable for these maps.

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
