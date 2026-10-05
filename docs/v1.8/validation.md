# GaiaGIS v1.8.0 — local release candidate

Validation completed on 2026-10-05 against local main based on published v1.7.0
`c0513d60f00b1bfc09e041add85a5a488c0aa0f7`. No remote publication, tag, Release
or Pages deployment is performed. No Explorer Mode or climate work is started.

## Source and geometry

Read-only installation: `D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition`.
The resolved world-map directory is `ff7\workingdir\data\wm`. LGP payloads are
read in memory; no source asset is extracted into the installation. All generated
data, caches, screenshots and test outputs remain inside the GaiaGIS workspace.

| Map | Bytes | Sections / base / alternative | Meshes / base | Base triangles | Vertex / normal records |
|---|---:|---|---|---:|---|
| WM0 | 3250176 | 69 / 63 / 6 | 1104 / 1008 | 142586 | 88950 / 88950 |
| WM2 | 565248 | 12 / 12 / 0 | 192 / 192 | 9967 | 6307 / 6307 |
| WM3 | 188416 | 4 / 4 / 0 | 64 / 64 | 8268 | 5222 / 5222 |

All three maps: zero decompression failures, invalid vertex references and decoded
trailing bytes. Vertex counts are per-mesh table sums, not unique vertices.
WM0 geometry, alternatives, V1 mathematics, 13 projection formulas and routing
topology are unchanged. Native maps reuse the common MAP parser.

| Map | Native X | Native Z | Raw height | Terrain IDs | Region IDs | Script IDs | Texture IDs |
|---|---|---|---|---|---|---|---|
| WM2 | 0..98304 | 0..131072 | -7943..3891 | 0,3,15 | 0,18 | 0,1,3 | 0..7 |
| WM3 | 0..65536 | 0..65536 | -7..1372 | 1,2,9 | 11 | 0,1,6,7 | 0..3 |

| Map | Exact native edges | Boundary edges | Incidence >2 | Duplicate face excess | Collapsed edges | Horizontal keys with multiple heights |
|---|---:|---:|---:|---:|---:|---:|
| WM2 | 14848 | 182 | 73 | 127 | 2 | 364 |
| WM3 | 12530 | 256 | 0 | 0 | 0 | 0 |

These diagnostics use exact native XYZ, without periodic modulo welding. A
multi-height horizontal key can represent a vertical surface or multiple layers;
it does not alone prove an invalid overlap. Duplicates and degenerate source
faces are retained, not repaired into a routing mesh.

WM2 E/W: 4/16 exact position+height matches; N/S: 7/12. It is not geometrically
periodic across its archive domain. Among matched segments, terrain, region,
script and texture IDs agree; normals agree on 1/4 and 2/7. Neither raw nor
texture-local wrapped endpoint UV agrees on any comparable matched segment.

WM3 E/W and N/S: 64/64 exact position+height matches. Terrain, region, texture
and normals agree on every segment; scripts agree on 64/64 E/W and 56/64 N/S.
Raw and wrapped endpoint UV agree on 0/64 in both directions. WM3 is therefore
**geometrically periodic**, with attribute discontinuities. Its Viewer remains
a bounded native rectangle. Neither native map receives synthetic polar caps.

## Textures and deterministic transport

| Map | Definitions / resources / used IDs | Dimensions | Atlas | Native geometry bytes | Texture pack bytes |
|---|---|---|---|---:|---:|
| WM2 | 8 / 8 / 8 | 3×128², 1×128×256, 4×256² | 1024² | 719095 | 267576 |
| WM3 | 4 / 4 / 4 | 4×64² | 256² | 596765 | 126292 |

Missing and unused resources: zero. All 12 resources have 4-bit palette metadata,
one 16-entry BGRA palette and byte-stored indices. Reference alpha is 255,
color-key is false, and all decoded pixels are opaque. Actual native transparent
texture QA has no source case; synthetic shared decoder/alpha-picking tests
cover the transparent behavior. No native surface animation group was identified;
8/4 fixed images are displayed. Runtime animation timing and environmental FX
remain out of scope.

The original TEX decoder, atlas padding, UV corner records, filtering and shader
are shared with WM0. Texture identity is `(mapId,textureId)`. WM3 texture 2 has
a reference offset disagreement: the classic table and actual V64..124 support
V64, while Landscaper uses V32. The independently documented catalog uses V64.

| Local transport | Whole-file SHA-256 |
|---|---|
| gaia-map-WM2.bin | 4fae1037e91d8545d2daeed92bce5ed4767d5dc298c65b63105ddf6ac498a755 |
| gaia-map-WM3.bin | 8d6c979bdb678d5206ebf17a2f294de9fc024636f7d9ba6bc33f310b4e1336f5 |
| gaia-textures-WM2.bin | 5e728d0cf891372cb3beddb5b1b5787c05dfbc6450f0311ffca51c1c83d7e389 |
| gaia-textures-WM3.bin | 2ef1df08022f78ecad28cea8604aaa5895ca8421b1daaa57d78bb109045faa66 |

Native geometry and texture exports are byte-identical across repeated builds
in real-source integration tests. A second complete export also produced eight byte-identical files, including
transition JSON and both metadata sidecars. Transition records have stable IDs
and sorted JSON serialization. gaia-transitions.json is 117407 bytes, SHA-256
455606d31c3cad14a48680726bcb99332fb4d8b635b84c10922950fcb58caf9a.
The transport retains raw normals, UVs and source lineage. No fake geographic
coordinate, global height datum or repaired topology is encoded.

## Coordinate and transition evidence

WM2Native and WM3Native use archive X/Z placement plus unchanged signed raw Y.
The classic-PC WM2 block placement provides the reference offset
`(X+98304,Z+65536)`, with inverse lookup and no scale. Dive/surface dispatch and
model save/restoration depend on runtime state and position. This is native-engine
evidence, not a verified Steam2026 global transform. It is not composed into V1
geography. WM2 is not a global bathymetric surface and its vertical datum relative
to WM0 remains unknown.

WM3 has field/script linkage and independent native placement. No WM0 affine
transform, polar inset or paired field-to-world coordinate mapping is established.
**GaiaGeographic mapping exists for neither WM2 nor WM3.**

Actual EV function counts: WM0 142, WM2 25, WM3 37. The shared bounded analyzer
retains constant propagation, branch/call/return reachability and cycle/depth/state
guards. No full VM, save-state emulator or runtime simulation is added.

| Link | Records | Spatially anchored sources | Meaning |
|---|---:|---:|---|
| WM0 → WM2 | 1 | 0 | Classic submarine dispatch evidence; dynamic position |
| WM2 → WM0 | 2 | 0 | Classic surface dispatch plus actual EXIT_UNDERWATER site |
| FIELD → WM3 | 1 | 0 | Dispatcher snowfield-entry range; no paired source coordinate |
| WM3 → FIELD | 25 | 25 | Trigger-component navigation centroids; move_s, gaiafoot, hyou12 |
| WM2 → FIELD | 7 | 2 | Exact field/table identities where resolved; other anchors unknown |
| WM0 → FIELD | 68 | 48 | Existing Overworld exits retained in unified inventory |
| Total | 104 | 75 | No destination native coordinate is inferred |

The source anchor uses one derived point per connected trigger component and
preserves representative triangle lineage. Counts are records, not unique places
or runtime exits. Evidence classes: 96 `script_constant`, 2
`reference_cross_checked`, 1 `runtime_dependent`, 5 `unresolved`. The five unresolved
entries have unresolved destination identity; **29 records have no source spatial
anchor**, and all destination-native positions remain null. These are different
uncertainty counts. No visual or nearest-triangle pairing fills a missing anchor.
Current Steam2026 executable equivalence remains **NOT VERIFIED**.

## Viewer and browser QA

Default map is WM0. Underwater/Great Glacier data and textures are optional and
lazy; missing or corrupt files do not replace a valid dataset. Native 3D supports
orbit/pan/zoom and source triangle picking; Native Top-down uses X/Z with zero
display height. Both support terrain/region/texture modes, nearest/linear filtering,
optional shading and 0×/1×/10×/25×/50×/100× visual height presets. Inspector identifies
map, native space, triangle centroid/raw height, texture namespace, UV and source
lineage/hash; global Gaia coordinates are explicitly not established.

Actual source raycasts cover every WM2 and WM3 terrain code. Desktop and 320px/
390px touch tests cover picking, native views, textures, map switching and overflow.
Native transition markers show only anchored sources. Unknown links remain in
an evidence list. FIELD→WM3 linked-map navigation works; advanced provenance is
collapsed initially. Returning to WM0 preserves existing controls/data. Viewer
navigation is not a claim that the player's gameplay exit conditions are met.

Screenshots were inspected locally for WM2 relief/texturing and WM3 mobile native
views. All screenshots remain private/ignored. Production code-only native loading
works without a loaded WM0 dataset and makes no automatic derived-data request.

| Gate | Result |
|---|---|
| Full nonclimate Python regression | 210 passed, zero failures/errors/skips |
| New native Python tests | 22, included above; 20 synthetic + 2 actual-source |
| Web unit tests | 400 passed across 16 files; 38 new native tests |
| Clean source Web checkout | 393 passed, 7 actual-data tests explicitly skipped |
| Clean synthetic native/TEX/atlas checkout | 40 passed, 4 own-installation tests explicitly skipped |
| New native/source-only browser checks | 70 passed, zero page/console errors |
| Existing browser regressions | POI 179, encounters 215, traversal 403, events 201, v1.5 210, v1.6 233, v1.7 137 passed |
| Browser total | 1648 passed |
| npm run build | passed |
| npm run build:release | passed |
| npm run audit:release | passed: 8 code/license files, zero game-derived files |
| i18n | 494 keys per locale, five-locale parity; 31 new map keys |

No dependencies were added. The existing nonfatal chunk-size warning remains:
approximately 830 kB main JS / 229 kB gzip. The clean source copy contains no local
data and shares only the workspace's installed node_modules for verification.

## Performance and resource lifecycle

Representative local Chrome/headless sanity snapshots, not portable benchmarks:

| Map | Geometry local-load interaction | Texture load interaction | Cached mobile switch | FPS snapshot | Draw calls | Geometry buffer estimate | Atlas pixel allocation |
|---|---|---|---|---|---:|---:|---:|
| WM2 | 43–93 ms | 32–41 ms | 51–77 ms | about 240 | 1 | 1554852 bytes | 4194304 bytes |
| WM3 | 38–43 ms | 21–26 ms | 39–43 ms | about 224 | 1 | 1289808 bytes | 262144 bytes |

Interaction timings include Playwright/local loader latency; atlas allocation is
uncompressed pixel storage, not driver-reported total GPU memory. Geometry estimates
include position/color/UV/rectangle/tint attributes, not browser overhead. There is
one surface batch and one atlas per native scene. DOM markers add no draw calls.
Switching native scenes disposes their geometry/material/texture/bitmap/controls/
observer/WebGL context. WM0 is suspended as one cache; only the selected native map
owns GPU resources. Both native scenes never remain on GPU together. CPU native
data and encoded textures are bounded to the two optional native maps.

## Final safety audit

Seven source files have identical size/SHA-256 before and after. All 73 protected
manifest entries are unchanged, including frozen geometry/projections, GIS products,
source inputs and sealed climate outputs. Core source comparison:

| Core file | Before = after SHA-256 |
|---|---|
| wm0.map | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp, 3114259 bytes | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |

Public candidate index: 316 files. No proprietary files, decoded textures/atlases,
complete geometry/UV/transition/POI/event/encounter/routing data, private screenshots,
profiles/cache, private user paths or credential patterns are tracked. New outputs
are ignored. GPL-3.0-only applies to original GaiaGIS code; third-party notices and
FF7 rights remain retained. Full local evidence is under ignored `output/v1_8/`.

**Proprietary assets tracked = 0. Public decoded assets = 0.
Public derived data included = NO. FF7 source modified = NO.**

The local commit SHA is returned in the delivery report rather than embedded
self-referentially here. v1.8.0 local release candidate gates are satisfied;
publication still requires the user's explicit approval.
