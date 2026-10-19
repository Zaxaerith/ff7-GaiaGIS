# Native GIS and source TIN diagnostics

WM2Native and WM3Native are independent Cartesian spaces. Native v1 positions
and GeoPackage XYZ mean `(native X, native Z, raw Y)`. Their numbers are raw
units, raw unit² and raw height/raw horizontal unit. No metre, altitude, depth,
compass, physical slope, global CRS, runtime connectivity or wrapping is inferred.
WM0 V1 reconstruction is unchanged.

## Exact source analysis

For corners `(X,Z,h)`, D is the integer horizontal determinant. Projected area is
`abs(D)/2`; for nonzero D solve `h=aX+bZ+c`. At D=0 both gradients are undefined.
The full three-dimensional cross product independently diagnoses true degeneracy.
A vertical face remains a source face even when its horizontal area is zero.
All current native integers, products and sums fit exactly in JavaScript Number;
the point API bounds integer components to ±1,000,000 (cross products < 2^53).
Source MAP domain bounds remain those of the unchanged Native reader.

Terrain totals sum **every source triangle's contribution**. They are not union
areas; duplicates, overlap and winding remain untouched. Duplicate membership
marks every face in a geometric duplicate group; duplicate excess is N−1 per
group. Exact 3D endpoint edge keys retain every face/slot occurrence. Incidence
therefore counts occurrences, including collapsed or repeated edges. Components
join only noncollapsed edges having exactly two occurrences on two distinct
faces. These are conservative diagnostics, not walkability or submarine routing.
There is no snapping, welding, hole repair or modulo connection.

Source normals remain raw binary XYZ. Reordering XYZ→XZh has determinant −1:
`cross(Pu,Pv) = -P cross(u,v)`. Render normalization and relief are separate display
operations. A negative transformed dot product alone does not prove a bad normal.

## Independent private GeoPackage v1

Use installed GDAL >= 3.9 Python (or set `GAIAGIS_QGIS_ROOT` to an installed QGIS
root on Windows). GIS is not bundled with the portable runtime.

```powershell
. tools/build/environment.ps1
$env:GAIAGIS_QGIS_ROOT = 'YOUR_QGIS_ROOT'
python -m gaiagis native-gis export --source-map 'YOUR_WM_DIRECTORY/wm2.map' --map WM2 --output output/exports/native/WM2-research.gpkg
python -m gaiagis native-gis export --source-map 'YOUR_WM_DIRECTORY/wm3.map' --map WM3 --output output/exports/native/WM3-research.gpkg
```

Output must be a new `.gpkg` below `output/exports/native`; existing files,
redirected ancestors, protected-input overlap and paths outside that area are
rejected. A private same-parent staging directory is fully written, reopened with
SQLite/OGR and compared field-by-field before MAP SHA recheck and atomic
no-clobber hard-link delivery. A failed candidate is discarded. The bounded
per-map output limit is 64 MB; the real 9,967/8,268-face maps require about 6/5 MB.
No Workspace is regenerated or modified.

Schema `gaiagis-native-gpkg`, version 1, generator `native-gis-1`:

| Table/layer | Contract |
|---|---|
| `native_metadata` | One JSON metadata row: map identity, source SHA256, axis/normal frames, raw units, `global_mapping:null`, methods and limits |
| `source_meshes` | Section/mesh identity, original absolute compressed header/data offset, compressed and decoded sizes |
| `source_vertices` | Every original table record as Point Z; unique logical `vertex_id`, original mesh-local `vertex_index`, S16 XYZ, U16 vertex/normal padding and raw normals |
| `source_faces` | Every source face, nonspatial; logical `source_face_id`, original three indices, three global table references, attributes, UV JSON, metrics and diagnostics |
| `xz_analysis_faces` | Only D≠0 source faces as Polygon Z, linked by `source_face_id`; original winding/corners retained |
| `edge_diagnostics` | Exact ordered endpoint keys, incidence, collapsed flag, distinct owners |
| `edge_occurrences` | One row for every source face/edge slot; links source_face_id and edge_id |
| `terrain_statistics` | Terrain code, source/nonzero/zero face counts and contribution area sum |

OGR supplies physical row FIDs; the documented source keys provide stable logical
joins and are checked against canonical source rows during full readback. No
coordinate deduplication creates or removes a source vertex identity.
`decoded_offset` in faces is **relative to the decompressed mesh**, `4+12*triangle`.
Vertex/normal offsets are likewise decompressed-relative. They are not original
compressed-file offsets. Global vertex IDs enumerate mesh tables in source order.

Spatial `gpkg_contents`, `gpkg_geometry_columns` and geometry blob headers use
Undefined Cartesian `srs_id=-1`, Z=1/M=0. Nonspatial attribute entries follow GDAL's
ordinary nonspatial convention. Each file has its own map identity; identical
SRS numbers do not authorize overlay between WM2 and WM3. **QGIS may display
Meter by default for this undefined Cartesian SRS. This is client behaviour,
not evidence of FF7 physical units.** Do not reassign EPSG:4326 or a vertical datum.
Provider subset COUNT may report −1 in some installed QGIS workflows; report that
as unavailable and inspect actual features. No MakeValid or geometry replacement
is performed.

Example independent SQLite joins:

```sql
SELECT terrain, count(*), sum(area) FROM source_faces GROUP BY terrain;
SELECT source_face_id, zero_xz, degenerate_3d FROM source_faces WHERE zero_xz=1;
SELECT f.source_face_id, v.vertex_index, v.raw_x, v.raw_y, v.raw_z
FROM source_faces f JOIN source_vertices v ON f.vertex_0=v.vertex_id;
SELECT incidence, count(*) FROM edge_diagnostics GROUP BY incidence;
```

## Viewer

Choose WM2/WM3 under Map, then Analysis → Native TIN diagnostics. Diagnostic
filters highlight matching faces in orange (texture display temporarily yields to
diagnostic colouring); All source faces restores the selected thematic/texture
layer. Inspect by source-face ordinal, Next matching face, or ordinary picking.
The shared Inspector shows raw corners/normals, attributes, determinant, area,
gradients, duplicate membership, edge incidences and component. The two corner
selectors measure X/Z distance on the selected face. Relief and top-down controls
never affect these values. Full original vertex IDs/padding/spans require the
independent original-MAP export; Native v1 cannot infer them from equal positions.

Only the current Native map owns an expanded analysis cache/highlight mask. Map,
source and Workspace replacement clear selection and diagnostics; late requests
are guarded and images closed. Existing Native v1 (72-byte records), Manifest,
WM0, Field, Visual, Interaction and GIS contracts are unchanged. No new mandatory
Workspace product exists. All real exports, oracles and screenshots remain private.
