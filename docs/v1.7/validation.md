# v1.7.0 local release candidate validation

Validated 2026-10-04, on local main based on
4ff06b59a97e1bf65db9bf731ff39a9214779327. No remote push, tag, Release or Pages
deployment is performed. No v1.8 work, new gameplay reverse engineering,
textures/models for WM2/WM3, climate simulation or frozen mathematical change.

## Source and texture observations

Input is the user's read-only Steam English installation under
D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition,
ff7/workingdir/data/wm/world_us.lgp and wm0.map. All writes, decoded artifacts,
browser profiles, screenshots and caches remain in D:\Project\FF7Gaia.

| Observation | Result |
|---|---|
| TEX files in archive | 415, including non-WM0 resources |
| WM0 first-frame definitions/resources/names | 282 / 282 / 282 |
| Used texture IDs | 277 in V1 base; 282 including alternative sections |
| Unused definitions | IDs 0–4 unused in base only; none across all WM0 sections |
| Missing first-frame resources | 0 |
| Actual dimension disagreements | 0 |
| Engine page-offset / nonanimated-name disagreements | 0 |
| Observed WM0 format | version 1, paletted, header depth 4, **one byte per index** |
| Palette | one 16-entry BGRA palette per first-frame TEX |
| Color key | 8 enabled, 274 disabled; reference alpha 255 |
| Transparent first frames | ggmk, subrg2, susbrg; decoded binary alpha |
| Animation | 22 definitions, 108 frame files, none missing; 368 unique resources including extra frames |
| Preview policy | deterministic frame one, no animation timing claim |
| Numerical UV comparison | 855,516 components; 263 differences from Landscaper helper, retained and explained |

Dimensions are measured from each TEX, spanning 16–128 pixels in each axis for
WM0 first frames. Archive-wide dimensions include other maps/effects and are not
misrepresented as WM0 surfaces. Exact per-resource formats/dimensions/pixel
hashes, animation frame names and UV discrepancies are in ignored local research
manifests; complete proprietary-derived inventories are not published.

Independent synthetic TEX tests cover paletted, RGB565, RGB24 and RGBA32 channel
conversion, alpha, color key, reference-alpha substitution, invalid dimensions,
mask overlap, truncated palette/pixels, index bounds and unsupported layouts.
Current Steam 2026 renderer/texture-addressing equivalence remains NOT VERIFIED.
Signed engine page-relative UV and a documented reconstructed repeat sampler
are used; no unlicensed reference implementation is copied.

## Local asset and determinism

The final gaia-textures.bin is 2,649,006 bytes. Its SHA-256 is
7474af30317d48ad89a6c75e521f66eec96915e6ddcbd21d12aead3dee221776.
Repeated real-source exports are byte-identical. Transport is documented in
[texture-data.md](texture-data.md): header, bounded JSON, lineage-bound raw UV,
lossless PNG, payload digest and complete-body digest. No canonical V1 binary
format or checksum changes. Four-pixel gutters, edge extension, deterministic
size/ID ordering, no overlapping rectangles, no mipmaps. Atlas is 2048×2048;
16,777,216 decoded RGBA bytes, approximately 16 MiB GPU base level per context.
Raw UV transport is 1,996,204 bytes (142,586 × 14). Temporary display UV/rectangle
attributes do not create new canonical vertices or source triangles.

The two viewports share ImageBitmap, Texture and source/display UV attributes.
Two WebGL contexts necessarily maintain separate GPU uploads: approximately
32 MiB atlas storage while comparison is open. Closing comparison disposes its
context. There are no hundreds of texture-specific meshes or per-projection
atlas copies. Three small alpha arrays support transparent picking.

## Relief, interaction and visual QA

Source height -738..4086 is unchanged. 0×/1×/10×/25×/50×/100× and bounded Custom
work on Globe only. 2D endpoints remain byte-for-byte numerical output of the
existing 13 projection functions; UV stays identical. Shading uses displayed
face derivatives, off by default, and bypasses existing radial lighting where
appropriate. Source normals remain in the original MAP parser.

Raycasts at 0×, 1× and 100× return the same source lineage. Alpha-transparent
samples are rejected. Canonical coordinates/Inspector height, routing weights,
measurement values, POI/event identities, traversal and encounter results remain
unchanged. Location/Event height clearance and route source-height clearance
follow visual relief; reference graticules and measurements remain readable.

All 13 views pass actual textured browser smoke. Focused screenshots reviewed:
Globe at six relief presets and shaded 100×; Equal Earth, Mercator, Winkel Tripel,
Mollweide and Orthographic; Globe/Equal Earth and Mercator/Equal Earth comparison.
Actual Grass, Forest, Mountain, Sea, River, Desert, Beach, Snow, Jungle and Corel
Bridge samples pass click/lineage/Texture Inspector provenance checks. Texture
boundaries, coastlines, mountains and synthetic polar attachment are inspected.
Synthetic caps use explicit synthetic ocean and never claim FF7 artwork.

320px/390px: surface/filter/relief/shading controls, actual touch triangle picks,
expanded Texture Inspector and horizontal-overflow checks pass. Five runtime
locale changes pass in the production Viewer. Local loader corruption preserves
the previous valid texture and geometry. Surface/analysis-color composition is
deterministic. Existing Locations, Events, Encounters, Tracks, Traversal, routes,
measurement, graticule and selection systems coexist on the same source mesh.

## Tests and build evidence

| Gate | Result |
|---|---|
| Python nonclimate regression | 188 passed, 0 skipped/errors/failures |
| Web unit tests | 362 passed across 15 files, including 49 new tests |
| Clean code-only Web checkout | 355 passed, 7 actual-data tests explicitly skipped |
| Clean source TEX/atlas tests | 20 passed, 2 own-installation tests explicitly skipped |
| New actual-source + production browser checks | 137 passed, no console/page errors |
| Existing browser regressions | POI 179, encounters 215, traversal 403, events 201, v1.5 210, v1.6 233 passed |
| Original direction/geometry/touch baseline | 16 passed |
| npm run build | passed |
| npm run build:release | passed |
| npm run audit:release | passed: 8 code/license files, zero game-derived files |
| i18n | 463 unique keys per locale, five-locale parity |

The final source-only production Viewer loads the two geometry files locally,
then accepts textures in a separate file chooser. It makes no automatic private
dataset/TEX/atlas request and performs no upload. All game-derived data remains
absent until selected locally. No dependencies are added. The existing nonfatal
bundle-size warning remains (roughly 806 kB JS / 221 kB gzip).

Representative local Chrome 154 / Intel UHD sanity measurements: texture
load/validation/decode/UV/upload interaction 759 ms; UV preparation 436 ms;
atlas upload **CPU submission**, not GPU-completion latency, 26.5 ms; relief switch
approximately 2–14 ms across runs. Textured shaded 100× sampled about 148 FPS,
comparison about 70 FPS. Main/compare each use 3 draw calls and one atlas; total
6 calls with both open. These are local snapshots, not portable performance
guarantees or gameplay timings. Private evidence is in output/v1_7.

## Safety and retained uncertainties

Seven FF7 file size/SHA pairs match before and after. The larger 73-file protected
manifest (source inputs, frozen projections, Stage 1/GIS products, gameplay core
and sealed climate work) also has zero changes.

| Core file | Before = after SHA-256 |
|---|---|
| wm0.map, 3,250,176 bytes | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map, 565,248 bytes | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map, 188,416 bytes | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp, 3,114,259 bytes | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |

Final public index: 298 files. No proprietary files, decoded texture, atlas,
complete UV/geometry/POI/encounter/event/routing dataset, private screenshot,
browser profile/cache, credential pattern or private user path is tracked.
GPL-3.0-only applies to original code; third-party notices and FF7 rights remain
retained. Source-only Pages is not deployed in this task.

**Proprietary assets tracked = 0. Public decoded texture assets = 0.
Public derived data included = NO. FF7 source modified = NO.**

Remaining uncertainties are renderer runtime equivalence, historical filtering
defaults, animation timing and reconstruction assumptions. This is original WM0
artwork reprojected through mathematical V1 Gaia, not official spherical artwork.
Faceted shading is display lighting, not canonical GIS hillshade. Conservative
projection singularity holes and static gameplay/routing limitations remain as
documented in prior versions. The completed local commit is returned in the
delivery report; no self-referential commit hash is embedded here.
