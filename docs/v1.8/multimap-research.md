# Multi-map research — v1.8 local release candidate

The authoritative baseline is v1.7.0, commit
`c0513d60f00b1bfc09e041add85a5a488c0aa0f7`. Development remains local.

## Evidence policy

Observed source geometry takes precedence over reference descriptions. WM2Native
and WM3Native are independent spaces until a transform is established. Neither
receives WM0 inverse-Mercator coordinates, spherical caps or gameplay rules.
Raw height is not a physical elevation/depth measurement.

## Initial reference findings

Classic-PC `C_0074D6BB` and `C_0074D6F6` select surface/undersea main states,
start a fade and reset field-transition information. These functions alone do
not establish a coordinate transform. The dispatcher `C_0074DB8C` chooses map 2
for specified entry IDs or undersea state, and map 3 for the snowfield entry
range; it invokes `C_00766C7A` to restore placement. The placement/save code must
be followed before claiming a generic affine mapping.

References: [classic-PC world-map research](https://github.com/ergonomy-joe/ff7-worldmap),
[Landscaper](https://github.com/maciej-trebacz/ff7-landscaper).
References supply format/behavior evidence only; implementation is independent.
Steam 2026 executable runtime equivalence remains NOT VERIFIED.

The existing `analysis.topology` performs periodic modulo welding and therefore
must not be reused as a native WM2/WM3 topology conclusion. New diagnostics must
count exact native position edges first, compare both opposite boundaries, and
only then report supported periodicity. Existing MAP/LGP/TEX readers are reused.

## Status

Source inventory and native analysis are complete. No global WM2/WM3 mapping is
established. See validation.md for completed quality gates and current limitations.

## Observed source geometry

| Map | Bytes | Sections/base/alternatives | Meshes/base | Triangles/base | Vertex/normal table records |
|---|---:|---|---|---:|---:|
| WM0 | 3250176 | 69 / 63 / 6 | 1104 / 1008 | 142586 | 88950 / 88950 |
| WM2 | 565248 | 12 / 12 / 0 | 192 / 192 | 9967 | 6307 / 6307 |
| WM3 | 188416 | 4 / 4 / 0 | 64 / 64 | 8268 | 5222 / 5222 |

Each section is 47104 bytes, each has 16 bounded compressed meshes, and all
mesh buffers decompress/parse without invalid references or trailing bytes.
Counts are computed from actual data; placement profiles are explicitly
cross-checked against 9×7, 3×4, 2×2 classic-PC section grids. Vertex records are
table sums, not globally unique vertices. WM0 alternatives are not inherited
by either native map.

| Map | Native X/Z extent | Raw height | Terrain IDs | Region IDs | Script IDs | Texture IDs |
|---|---|---|---|---|---|---|
| WM2 | 0..98304 / 0..131072 | -7943..3891 | 0,3,15 | 0,18 | 0,1,3 | 0..7 |
| WM3 | 0..65536 / 0..65536 | -7..1372 | 1,2,9 | 11 | 0,1,6,7 | 0..3 |

The names of terrain/region values retain gameplay meaning; raw numbers do not
establish ecological cover or a physical elevation datum.

## Exact native topology diagnostics

| Map | Edges | Incidence-1 boundaries | Incidence >2 | Duplicate face excess | Collapsed edges | XY keys with multiple heights |
|---|---:|---:|---:|---:|---:|---:|
| WM0 base | 214270 | 1030 | 124 | 84 | 0 | 108 |
| WM2 | 14848 | 182 | 73 | 127 | 2 | 364 |
| WM3 | 12530 | 256 | 0 | 0 | 0 | 0 |

These are exact `(X,Z,height)` incidence diagnostics, not repaired topological
adjacency. Multi-height XY support is not by itself proof of broken geometry;
vertical faces and overlapping layers remain source data. WM2 incidence
histogram is `{1:182,2:14593,3:22,4:14,5:18,6:4,8:6,9:6,65:3}`.
WM3 is `{1:256,2:12274}`. No modulo weld is used in these counts.

WM2 E/W has 16/16 segments, 4 exact position+height matches; N/S 12/12, 7 matches.
It is not geometrically periodic across its archive domain. Only matched
segments permit attribute comparisons: terrain/region/script/texture all match
on those 4 and 7; normals match 1 and 2 respectively; raw/wrapped UV match zero.
We do not fabricate a wrap or infer a complete globally connected sea floor.

WM3 E/W and N/S each have 64/64 exact segment matches. Position, height,
terrain, region, texture and normals match all 64 on each axis. E/W scripts
match 64; N/S scripts match 56. Raw UV and texture-local wrapped endpoint UV
match zero on each axis. Thus WM3 is **geometrically periodic**, with explicit
attribute discontinuities. The Viewer presents the bounded native rectangle
without automatically changing topology or making a polar inset.

## Texture observations

Classic wmfile supplies 8 WM2 and 4 WM3 resource definitions. Actual source
dimensions all match; all IDs/resources are used, none missing or unused.
WM2 dimensions: 128×128 (3), 128×256 (1), 256×256 (4). WM3: 64×64 (4).
All use one 16-entry BGRA palette, bit-depth header 4, stored byte per index.
All have reference alpha255, color-key false, no actual alpha<255 pixels.
Transparent native-source QA has no real case; shared decoder/picking synthetic
alpha cases remain tested. No native surface animation group/frame replacement
was identified in the resource catalogs; 8/4 fixed images are rendered. The
classic extra overworld animation-frame allocation is map0-only. Native
environment FX/fog/snow overlays are not surface textures and are out of scope.

WM3 ID2 `snwfldl` has reference offset disagreement: Landscaper says V32,
classic table says V64; actual MAP V spans64..124. Use V64. The reader/shader
subtracts the signed page offset then repeats within each texture, retaining
source UV seams and corner values. No unlicensed parser/material code copied.

## Cross-map evidence and uncertainties

See coordinate-spaces.md and transitions.md. WM2 has a **reference-derived
native-engine placement offset**, not a proven modern-runtime global CRS. WM3
has field/script linkage and independent coordinates; no WM0 affine mapping.
Neither map receives V1 longitude/latitude, spherical caps, meters, gameplay
rules, measurement or routing. Potential engine address wrapping is not equated
with matching MAP boundary geometry. Current executable equivalence, field
re-entry pairing, runtime placement and vertical datum remain unverified.

[WorldMap Module documentation](https://wiki.ffrtt.ru/index.php/FF7/WorldMap_Module)
was cross-checked for format/identity. Its historical WM0 section-count and
bit-field statements contain known discrepancies; actual bytes and independent
reader invariants remain authoritative.
