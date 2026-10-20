# World variants and source-level changes

The optional World Variants tool compares original WM0 sources on the unchanged
V1 assumed sphere. It does not recover current gameplay state or measure actual
changed footprint area. The ordinary 142,586-face WM0 authority, thirteen
projections, routes, POI, events, Explorer, user drawings, Native GIS and Field
products retain their existing contracts.

## Private generation and explicit import

Use the source checkout, not the portable runtime, to generate private research
products. No Workspace rebuild or Manifest change is needed:

```powershell
. tools/build/environment.ps1
python -m gaiagis world-variants resource --source-map 'YOUR_WM_DIRECTORY/wm0.map' --world-lgp 'YOUR_WM_DIRECTORY/world_us.lgp' --output output/dev/current/YOUR_TASK/world-variants.json
$env:GAIAGIS_QGIS_ROOT = 'YOUR_INSTALLED_QGIS_ROOT'
python -m gaiagis world-variants gis --source-map 'YOUR_WM_DIRECTORY/wm0.map' --output output/exports/world-variants/WM0-research.gpkg
```

The source CLI requires the matching frozen WM0 MAP fingerprint; unknown source profiles are rejected independently. Both targets must be new. The JSON belongs below `output/dev/current`; the GPKG
belongs below `output/exports/world-variants`. Links/junctions, escape paths and
existing targets are rejected. The writer stages in the same parent, reads back,
rechecks the source SHA and uses atomic no-clobber delivery. GIS needs installed
GDAL >=3.9; Windows source CLI can delegate through `GAIAGIS_QGIS_ROOT`.

Open an existing Workspace, select **Analysis → World Variants**, explicitly
import the JSON, then enable source research. Select only cumulative states:

| Reference state | Complete alternative groups |
|---|---|
| 0 | none |
| 1 | G1: 63→50 |
| 2 | G1 + G2: 64/65→41/42 |
| 3 | G1 + G2 + G3: 66→60 |
| 4 | G1 + G2 + G3 + G4: 67/68→47/48 |

These are manual reference-derived selections, not runtime flags. G4 cannot be
split: 67/48 and 47/68 each have five mismatched 3D seam edges. G2 remains atomic
even though its mixed geometry matches. Fixed references and current source
geometry support the mapping; current executable execution is NOT VERIFIED.

The source Inspector uses original Section/Mesh/Triangle, never an alternative
face disguised as a canonical ordinal. Expand raw evidence for original corners,
indices/padding, normals in raw XYZ, attributes, UV, compressed file offsets and
decoded-relative offsets. The contribution units are `raw unit²`. Geometry
matching preserves complete candidate sets and occurrence multiplicity. Orange
marks source geometry/attribute/UV/normal/winding differences, purple ambiguous
buckets, and yellow selection. Colour/texture display is research visualization,
not original-game pixel equivalence.

Routes and gameplay tools continue to refer to BASE WM0; route/Explorer/sphere
measurement capabilities are disabled during research. Existing stored data is
unchanged. Alternative picking cannot place a player or a measurement. POI,
events, Field navigation and user drawings retain their base identities, with a
persistent research notice. Close research to restore ordinary drawing and
picking; reimport explicitly for a new session. Map/Field/Workspace replacement
and page disposal cancel pending reads and release the research owner. Atlas
pixels are borrowed without closing/disposal by the research owner.

## Independent viewer contract

`gaiagis-world-variants` version 1, generator `world-variants-1`, is an explicit
UTF-8 JSON file, not an asset in Workspace Manifest v1. Old Readers reject unknown
Manifest types, so this file is never silently registered there. There is no
compressed stream or implicit format autodetection; gzip/deflate input is rejected.

The envelope holds schema/version/generator, `map_id:WM0`, original MAP SHA256,
`coordinate_frame:[placed raw X,placed raw Z,raw Y]`,
`normal_frame:original raw XYZ`, the four fixed groups, UTF-8 payload length,
SHA256 and a `payload` JSON string. The bounded inner JSON contains:

- `meshes`: source tables below;
- `boundary_evidence`: finite grid-side, neighbour, internal and rejected mixed
  comparisons, exact 3D occurrence counts and bounded mismatch examples;
- `script_evidence`: optional static 0x349 records with source/EV SHA, call-table
  identity, word/payload/archive offsets, immediate literal or null. It is inside
  the payload hash. Presence/entry reachability does not establish execution.

Each mesh is a 9-item tuple:

```text
[original_section, base_placement, mesh_id,
 absolute_compressed_header_offset, compressed_bytes, decoded_bytes,
 vertices, normals, triangles]
vertex/normal = [S16 X, S16 Y, S16 Z, U16 padding]
triangle = [index0,index1,index2,terrain_script_byte,u0,v0,u1,v1,u2,v2,raw_ids]
```

All 12 target Sections/192 Mesh identities must be present exactly once. Readers
check original section/placement, table sizes, S16/U16/byte values, references,
compressed range bounds/nonoverlap and `decoded_bytes=4+12*nt+16*nv`. Source face
identity is `(WM0,map_sha256,original_section,mesh,triangle)`. Coordinates do not
merge identities. Decoded triangle offset is `4+12*triangle`, not a compressed
file location. Placed coordinates use the existing 9×7 source grid, 8192-unit
mesh placement; no geometry repair or snapping occurs.

Independent limits: file 8,000,000 bytes, inner UTF-8 JSON 6,000,000 bytes, 192
Mesh, 32,000 source faces, 20,000 vertex records, 256 vertices/512 faces per Mesh,
128 boundary comparisons and 64 static opcode sites. The actual complete data is
about 1.82 MB, 30,514 faces/18,700 vertices. These are bounded plain input limits,
not a Visual budget increase. Browser heap/geometry/lifecycle measurements remain
separate from serialized size. Missing, corrupt, unsupported or source-mismatched
research input fails locally; the original Workspace remains usable.

## Exact differences and limitations

Geometry keys sort the three exact `(placed X,placed Z,raw Y)` corners, retaining
multiplicity. Oriented cyclic keys separately preserve winding. Attribute, UV
and normal signatures keep corner correspondence. A geometry bucket with multiple
source candidates is ambiguous, including surplus occurrences; no nearest-neighbour
or same-ordinal pairing is invented. The attribute/UV difference statistic is a
lower bound after multiset intersection, not a unique entity-change count.

Source area sums include duplicates, overlapping surfaces and vertical records.
Retessellation can change every face while footprint is unchanged. Adding a
duplicate increases contribution sum without increasing footprint. Multiple
heights cannot become one DEM. D=0 has undefined plane gradients; true 3D
degeneracy is a separate cross-product test. No Polygon XOR, union repair,
MakeValid, volume, ecological/story interpretation or physical dates is inferred.

## Raw GeoPackage v1

Schema `gaiagis-world-variant-gpkg`, version 1, generator `world-variant-gis-1`.
Only the six target bases and six alternatives are exported, in independent raw
coordinates `(placed X,placed Z,raw Y)`. Point Z/Polygon Z use Undefined Cartesian
`srs_id=-1`, Z=1/M=0 consistently in contents, geometry columns and blob headers.
QGIS may label this Meter; that client default proves no physical source unit.
No WGS84, global mapping or V1 longitude/latitude layer is assigned.

| Table | Meaning |
|---|---|
| variant_metadata | source SHA, generator, independent axes/units, reference groups, runtime Unknown |
| source_sections | all 12 original Sections with separate placement/group/side |
| source_meshes | 192 original Mesh spans, counts, compressed and decoded lengths |
| source_vertices | 18,700 original table records as Point Z, original XYZ/padding/index/decoded offset |
| source_normals | 18,700 original normal table records, XYZ/padding/frame/index/decoded offset |
| source_faces | 30,514 nonspatial source rows, three vertex/normal references, original attributes/UV, metrics/signatures |
| variant_geometry | 30,432 D≠0 Polygon Z rows, linked by source_face_id |
| variant_diagnostics | exact group outer-side edges and both candidate owner sets; no modulo/weld |
| change_statistics | four group count/multiset/contribution/terrain/boundary summaries |
| comparison_relations | exact geometry candidate bucket, occurrence counts and ambiguity |
| comparison_members | every source face links to its side's candidate bucket; no fabricated pair |

All 82 D=0 source faces remain in source_faces. Logical source keys, vertex/normal
references, geometry links and comparison membership are read back and checked.
The writer limit is 96 MB including indexes/tables; the measured full result is
about 33 MB. Original input and old GIS cannot be overwritten, including by a
concurrent target creator. GIS is not bundled with the portable runtime.

Useful read-only QGIS/SQLite checks:

```sql
SELECT side, count(*), sum(area) FROM source_faces GROUP BY side;
SELECT count(*) FROM source_faces WHERE zero_xz=1;
SELECT count(*) FROM variant_geometry;
SELECT group_id, status, ambiguous, count(*)
FROM comparison_relations GROUP BY group_id,status,ambiguous;
SELECT f.source_face_id,v.raw_x,v.raw_y,v.raw_z,v.padding
FROM source_faces f JOIN source_vertices v ON f.vertex_0=v.vertex_id;
```

## Fixed reference and verification

Loader thresholds/setter: [classic PC research, fixed revision](https://github.com/ergonomy-joe/ff7-worldmap/blob/bc7576e68b118e776ccefecfbc982a702a7f9e0f/NEWFF7/C_0074FFC0.cpp).
Opcode 0x349: [VM reference](https://github.com/ergonomy-joe/ff7-worldmap/blob/bc7576e68b118e776ccefecfbc982a702a7f9e0f/NEWFF7/C_00760FB0.cpp).
Groups: [editor reference](https://github.com/maciej-trebacz/ff7-landscaper/blob/3e2708441a8335f14e10fb52bd9af4a82a2a6921/src/hooks/useMaps.ts).
No confirmed implementation reuse permission was found in the inspected reference
trees. These are format/behaviour references only; no upstream code is copied or
executed. Game resources and complete products remain private/source-only.

`tools/world_variant_audit.py` independently walks all 69 original Sections with
a second integer cursor, Fraction plane solver and GPKG WKB decoder. It compares
every target source record to both private JSON and GIS. Supply its private
output through `GAIA_WORLD_VARIANT_ORACLE`, and the JSON through
`GAIA_WORLD_VARIANT_RESOURCE` for the all-face Web tests. Synthetic public tests
cover retessellation, attributes/UV/normals, duplicates/ambiguity, winding,
multiple heights, vertical and negative-coordinate sources and malformed input.
The maintained Browser runner adds `GAIA_BROWSER_SCOPE=variants`; the complete
runner includes these checks when the explicit resource environment is supplied.
Neither pixel similarity nor static script presence verifies current gameplay.
