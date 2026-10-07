# Private local workspace

`python -B -m gaiagis.build_workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace`
is the unified CLI. With an editable project installation the equivalent entry
point is `gaiagis-build-workspace`. See [user guide](../user/getting-started.md) for environment
setup, GDAL/QGIS and optional `--stage1` cache reuse.

## Manifest

`gaia-workspace.json` uses schema `gaiagis-workspace`, version **1**. Application
version (`tool_version: application version`) and generator revision are separate from the format
version. `timestamp_policy: omitted` explicitly avoids wall-clock timestamps.
Source keys and asset filenames are safe basenames; there are no absolute paths.
Each asset stores filename, logical type, mapId, SHA-256, byte size and dependency
filenames. Sources bind read MAP/BOT/LGP and available field archive fingerprints.
This real manifest is itself local/private and ignored by Git.

Public synthetic examples/tests contain fabricated hashes and payloads only.
The manifest is a discovery/provenance contract; it does not replace codec checks.
The browser checks hashes before adoption, map identity, declared references/cycles,
dependency availability and cross-asset source hashes, then calls existing codecs.
Unsupported transport versions are rejected. Missing optional assets degrade
independently; a missing or invalid base geometry prevents workspace adoption.

## Inventory

| Logical data | Files | Domain/dependency |
|---|---|---|
| Geometry | gaia-meta.json + gaia-mesh.bin | WM0/V1, required for full workspace |
| Locations | gaia-poi.json | WM0 source lineage |
| Encounters | gaia-encounters.json | WM0 region/terrain |
| World events | gaia-events.json | WM0 anchors/lineage |
| Routing | gaia-routing.bin | WM0 source topology |
| Original textures | gaia-textures.bin | matching WM0 mesh/source |
| Native maps | gaia-map-WM2.bin, gaia-map-WM3.bin | independent native domains |
| Native textures | gaia-textures-WM2.bin, gaia-textures-WM3.bin | respective native map |
| Transitions | gaia-transitions.json | source hashes, unresolved transforms retained |
| Explorer | gaia-explorer.bin | version2 borrows matching loaded map surfaces |
| Presentation | gaia-presentation.json | optional locally generated UI audio |
| Atlas | gaia-atlas.json | authored knowledge plus private POI identity bindings |
| Field Context | gaia-field-context.json | private scene identities / gateway edges, depends on POI |

Sixteen payload files comprise fifteen logical groups. No geometry is duplicated
into a workspace wrapper. Folder loading reads recognized root files only, using
the user-initiated directory picker or folder-input fallback. Multi-file loading
works without File System Access API. Unmanifested legacy sets are labeled Legacy.

## Incremental and deterministic behavior

The CLI calls the existing owners in component steps. A step is reused only
if schema/generator/source bindings and every file size/hash match. The tool version
is informational; generator and transport revisions govern component compatibility.
Missing/corrupt output rebuilds its owning step. A failed build does not publish a
new manifest. Outputs, private Stage 1 cache and temporary native reports remain
inside the repository; output inside the selected source dataset is rejected.

Repeated builds with identical source/runtime/cache inputs retain byte-identical
payloads and manifest. Do not confuse this with portability across every runtime:
different zlib versions may compress identical PNG pixels differently, and fresh
GeoPackage provenance includes the actual generated cache hash. Imported Stage 1
cache versus newly generated Stage 1 are distinct inputs. Both paths were tested;
their WM0 geometry and non-texture gameplay outputs agree exactly. This limitation
does not alter decoded texture semantics, geometry or dataset compatibility.

## Dataset compatibility

Compatibility follows bytes, schemas, lineage and hashes; it is not inferred
from Steam AppID or merely a directory name. Discovery supports the existing
classic/2013-style, Steam2026 and extracted layouts with explicit case handling.
Core parsers remain common across resolved datasets.

### Transport policy

WM0 metadata/mesh, POI, encounters, events, routing, textures, native maps and
transitions retain their existing version1 transports. Their established codecs
continue to validate lengths, fields, references and source fingerprints. The
workspace manifest is an additional version1 envelope, not a transport rewrite.

Explorer accepts **version1 and version2**. Version1 embeds three source surfaces
and retains the previous decoder/walker path. Version2 embeds model/animation/
texture data and three map bindings, without surface records. `bindSurface`
requires exact map/source/count/extent agreement with loaded owners. A pack cannot
silently borrow another map or source. The same checksum, model, part, clip,
texture and bounds validation applies to both versions.

Version2's shared surface reconstructs WM0 source integer corners only when the
inverse V1 result is within0.125raw units of an integer. It rejects rather than
silently rounding incompatible geometry. Native coordinates already preserve
source integers. Exact endpoint/height adjacency retains E/W periodic WM0
matching, excludes the N/S cut, and conservatively rejects degenerate, duplicate
or non-manifold faces. No new route or walker semantics are introduced.

The real integration test compares all 160,821 triangles' positions, attributes
and three neighbor slots against version1: zero differences. Maximum observed
WM0 inverse corner errors were about 0.0154 raw north units, with no integer mismatch.
The source binary geometry is not recreated in a second 56-byte-per-face table.
Only adjacency and existing spatial indexing are retained by the borrowed owner.

### Graceful degradation

Missing optional data is normal. Locations, encounters, events, routing and
textures have their own load inputs and error status. Directory/multi-file loading
shares these same adoption paths. Bad optional data does not replace the mesh.
Workspace replacement resets source-bound native/Explorer caches; serialized
adoption and generation guards prevent an obsolete load from winning.

WM2/WM3 never receive WM0 global measurement/routing capabilities. Explorer may
preview their native surfaces, but original movement/collision and2026runtime
equivalence remain NOT VERIFIED. Legacy loading does not elevate evidence claims.
The public build contains no real manifest or game-derived pack of either version.

## Gaia Web transport v1

A compact visualization format, not a general GIS standard. Stage 1 Float64 Geographic / GeoPackage remains authoritative. The browser loads one binary and small metadata JSON; no GIS runtime or FF7 binaries are needed.

All records are **little-endian**. File: `web/public/data/gaia-mesh.bin`; metadata: `gaia-meta.json`, including SHA-256, source product fingerprints, physical reference radius, palette names, counts and precision error. No absolute installation paths are included in public metadata.

### Header — 64 bytes

| Byte offset | Type | Field |
|---:|---|---|
| 0 | 8 bytes | magic `GAIAWEB\0` |
| 8 | uint16 | format version = 1 |
| 10 | uint16 | header bytes = 64 |
| 12 | uint32 | flags = 1 (Float32 lon/lat in degrees; height in assumed meters) |
| 16 | uint32 | vertex_count |
| 20 | uint32 | triangle_count |
| 24 | uint32 | vertex block offset |
| 28 | uint32 | index block offset |
| 32 | uint32 | attribute block offset |
| 36 | uint32 | attribute stride = 16 |
| 40 | uint32 | total file bytes |
| 44 | uint32 | FF7 source triangle_count |
| 48 | uint32 | synthetic cap triangle_count |
| 52, 56, 60 | uint32 | reserved = 0 |

Offsets are 4-byte aligned and contiguous. Parser rejects unknown versions/flags, inconsistent lengths/counts, nonfinite coordinates, invalid references and fabricated synthetic lineage.

### Vertex and triangle blocks

Each vertex: **12 bytes** — longitude float32, latitude float32, height float32. Each triangle: **12 bytes** — three uint32 global vertex indices. Source vertices are keyed by original map/section/mesh/vertex record; no global positional weld or topology repair. Unreferenced source records may be omitted. Cap vertices follow the Stage 1 cap tables, including one canonical pole per hemisphere.

### Triangle attribute record — 16 bytes

| Record offset | Type | Field |
|---:|---|---|
| 0 | uint8 | terrain_id |
| 1 | uint8 | region_id |
| 2 | uint16 | section_id |
| 4 | uint16 | mesh_id |
| 6 | uint16 | original triangle_id |
| 8 | uint8 | geometry_origin: 0 FF7, 1 north cap, 2 south cap |
| 9 | uint8 | map_id (0 WM0 for source) |
| 10 | uint16 | texture_id |
| 12 | uint8 | script_id |
| 13 | uint8 | is_chocobo (0 or 1) |
| 14 | uint16 | cap_triangle_id (synthetic identifier only) |

NULL sentinels: uint8=255, uint16=65535. Synthetic records have **all FF7 attributes/lineage NULL**. Source records have NULL cap_triangle_id. `terrain_id` is FF7 gameplay terrain, not land cover. Filename WM0 is resolved from map_id, not fabricated for caps.

### Canonical data versus display tessellation

The runtime dataset preserves all Stage 1 canonical triangles. Display geometry expands corners for flat categorical colors, short-edge antimeridian clipping and per-face picking. `renderToSource` maps every generated display face back to the original canonical record.

At an exact pole, longitude is undefined. The display duplicates the pole by longitude sector and fills the plane's polar row with a sector quad; those duplicate corners coincide on the Globe. This changes display tessellation only, not canonical counts/lineage or the stored geographic model. Original source grid draws FF7 triangle perimeters, not fan triangulation edges added for display.

Globe display coordinates are `(GaiaY,GaiaZ,GaiaX)/R` and include assumed height; normalized reference radius is 1. Map positions are `(projected_x/R,projected_y/R,0)`. Standard map XY ignores radial height. Single interface projection formulas are CPU-generated; CPU lerp with cubic easing drives 1.1s visual transitions. Intermediate states are not true projections.

Mercator clamps all target positions to the configured finite latitude limit and hides entire triangles touching/exceeding the excluded zone; this first version may omit a narrow strip within the exact GIS cutoff. Orthographic uses a moving geographic center and signed vertex visibility; a small material hook clips/fades interpolated visibility at the horizon. Shader code contains no projection engine. Other positions stay CPU-computed.

### Current local data

- 94136 vertex records: 88950 FF7 + 5186 cap records.
- 152378 canonical triangles: 142586 FF7 + 9792 synthetic.
- Binary **5396280 bytes**; gzip **1196930**; Brotli **696175**; metadata **2905** bytes.
- Max Float32 spherical quantization error against Stage 1 Float64: **0.424211m**.
- Web asset precision ≠ canonical GIS precision.

Compression sizes are measured outputs, not a claim that GitHub Pages will automatically serve those encodings. The Viewer fetches the regular binary. Generated transport/compressed files are local-only and Git-ignored.

## Local multi-map data

Generate from your own FF7 installation:

```powershell
python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
```

Default output is ignored `output/local-workspace/` in the GaiaGIS workspace. The
generator reads MAP/LGP and sibling field/flevel.lgp maplist, writes no source
files, rejects outputs outside the workspace and reuses existing MAP/LGP/TEX
parsers. Directory discovery supports the existing classic/2026 layouts.

Native map provenance and hashes are recorded by the workspace generator.

- `gaia-map-WM2.bin`, `gaia-map-WM3.bin`: self-describing native geometry.
- Matching `.json` metadata: generator/source hash audit sidecars.
- `gaia-textures-WM2.bin`, `gaia-textures-WM3.bin`: optional map-bound TEX packs.
- `gaia-transitions.json`: optional cross-map and field-exit inventory.

Native format v1: eight-byte `GAIAMAP\0`, little-endian uint32 version and JSON
length, sorted JSON header, fixed 72-byte triangle records, 32-byte SHA-256
footer over everything preceding it. JSON records map/space identities, source
and payload hashes, section grid/count, extent, raw units and `global_mapping:
null`. Records contain three int32 `(X,Z,height)` corners, three int16 raw XYZ
normals, four uint16 section/mesh/triangle/texture IDs, four terrain/region/script/
flag bytes, and six raw UV bytes. No caps, geographic coordinates or topology
repair is introduced; duplicate/degenerate source faces are preserved.

Texture format remains `GAIATEX` v1 and is shared with WM0. MapId, native
reconstruction identity, native geometry transport SHA and source hash bind
resources/UV records to the selected map. Identity is `(mapId,textureId)`.
WM0 texture packs and geometry keep their previous semantics and bytes. The
existing atlas builder, TEX decoder, padding, sampler, filtering, alpha decoder
and shader are reused. Native UVs remain per-triangle corners. Maps are not
welded at texture seams or wrapped into their opposite boundary in the Viewer.

Choose a map, load its `.bin`, then optionally load its texture `.bin`.
WM0 retains all previous local dataset controls. Transition data can be loaded
from the map bar or native panel. No optional native map or texture is fetched
automatically. Corrupt/wrong-map/wrong-hash files are rejected before replacing
the current dataset. Closing/switching a native scene disposes its geometry,
material, texture, bitmap, controls, observer and WebGL context. CPU native maps
and encoded texture buffers are bounded to WM2/WM3. WM0 is one suspended cache
so its loaded optional datasets and camera survive native visits. At most one
native map owns GPU resources; both native maps never reside on GPU together.

## v2.1 presentation and extended Explorer data

GaiaGIS original code/CSS remains GPL-3.0-only. Original game audio, meshes,
textures and animations remain private, ignored, locally generated inputs.
No original UI bitmap, font or cursor is distributed. Nothing is uploaded.

### Local workflow

```powershell
python -m gaiagis.local --source "YOUR_FF7_INSTALLATION"
```

The existing launcher discovers field/char.lgp, field/flevel.lgp and
sound/audio.dat/audio.fmt as optional sources. It incrementally generates and
automatically adopts the extended Explorer and presentation assets. Missing
audio leaves the public CSS theme usable and silent; missing field character
sources leaves the original eight-model Explorer usable. Individual/manual
loading and the existing public workspace chooser remain supported.

Workspace schema 1, generator workspace-1 and tool compatibility version 2.0.0
remain unchanged. These identify transport compatibility, not application version
2.1.0. Only Explorer's per-asset generator marker becomes explorer-party-1,
invalidating old Explorer output without invalidating independent geometry,
POI/gameplay/native-map/texture payloads. Relevant source hashes, output size/hash
and dependency hashes are still required for reuse. Presentation depends only on
audio.dat/fmt; Explorer additionally depends on char.lgp/flevel.lgp. A missing or
invalid optional component is reported instead of fabricating a replacement.

### Private presentation JSON

`gaia-presentation.json` is a small optional asset:

| Field | Meaning |
|---|---|
| schema / version | gaiagis-presentation / 1 |
| sources | path-free original audio.dat and audio.fmt SHA-256 |
| audio[].id | cursor, confirm, cancel |
| wav | base64 RIFF PCM16LE WAV, locally decoded |
| source_record | actual zero-based fmt record index |
| fmt_byte_offset / data_byte_offset | source provenance |
| compressed_bytes / decoded_samples | bounded source/output sizes |
| sample_rate / channels / loop | 44100 / 1 / false for observed three cues |
| original_codec / evidence | Microsoft ADPCM / classic-PC reference and actual record |
| unresolved_cues | open; no guessed sound |
| runtime_equivalence | NOT VERIFIED |

The actual pack is 124,465 bytes; SHA-256
`88388c5de29b574b331ee6e5ceff657a63aecc5b3747b732f76a1b7a7ee181e3`.
Deterministic ordering omits dates and absolute paths. Loader validates IDs,
hash names, version, WAV header, size limits, duplicate IDs and loop flag before
Web Audio decoding. Failed adoption retains good audio; workspace reset clears
it and guards pending decode races. No sound plays before a user gesture,
when muted or at zero volume. Default volume is 25%, sounds off. Preferences
are browser-local and contain no game path. Debounce prevents noisy repeated
feedback. Unidentified dialog-open cues stay silent. Public Pages does not probe
localhost and cannot discover a local sound pack automatically.

### Extended Explorer registry

Explorer transport remains v2. Optional registry_version 2 adds characterId,
displayNameKey, sourceKind, sourceResource, evidence, animation_tier,
compatibility_class, field_binding and display_transform. Six field-source
characters have null model_id; no fictional WM model ID is assigned.
Original world leaders retain IDs 0/1/2. The asset retains only original HRC/P/TEX/A
data and the existing map hash bindings, not another copy of source surfaces.

The observed v2 pack is 1,545,008 bytes; SHA-256
`5d853f61af264aa45fdecb2ecde1996ee5fff59521fb875c8b4f1c48df14d653`.
It contains 14 models, 61 animation clips and 23 texture resources. One shared
Chocobo source supplies five existing tint variants. All nine party characters
are available, including six explicit Extended field models. Source HRC→RSD→P→TEX
and field-loader A bindings are preserved in the private inventory. No retarget,
fan model or generated walk cycle is used. Legacy v1 and old eight-model v2 packs
remain readable; unavailable extended characters are disabled visibly.

Character and movement profile are separate: party selection uses the existing
Foot preview (WM3 native party profile), not invented per-character movement
rules. Compatible switches retain source point/triangle/heading; incompatible
switches are rejected. Party ownership and original leader restrictions are not
simulated. Scale/ground-origin/light/shadow are rendering metadata; source walker,
coordinates, UVs, projection formulas and gameplay rules remain unchanged.

### Public boundaries

The repository/build includes independent parsers, rules, CSS, translations,
synthetic fixtures and documentation only. Both packs, raw audio/character data,
private screenshots and QA evidence stay ignored. The HTTP server still exposes
only manifest-listed generated assets, never source archives or arbitrary paths.

## Locally generated locations and entrance provenance

This layer extends the stable V1 Geometric Gaia reconstruction. It does
not redefine latitude, geometry, projections, climate or world topology.
The [entrance investigation](../research/world-map.md) preceded the parser.

## Generate and load

From the project root, after generating the existing V1 mesh:

```powershell
. tools/build/environment.ps1
python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
```

The output is `web/public/data/gaia-poi.json`, ignored by Git. The CLI also
accepts `--field-archive 'YOUR_ENGLISH_FLEVEL_LGP'` for extracted layouts
and `--output output/your-local-poi/gaia-poi.json`. Output paths must remain
inside the workspace; game inputs are opened read-only. The English
archive is resolved beside `data/wm` using explicit case-insensitive
discovery. Missing identity data is an error, not a guessed mapping.

Keep the existing `gaia-meta.json` and `gaia-mesh.bin` unchanged. In the
Viewer, open those two together, then use **Display → Load Locations**.
Without a POI file the map remains usable and says “Locations unavailable”.
Local development optionally loads an existing generated POI file.
The public source-only build never fetches generated datasets and files
selected in the browser are never uploaded.

## Schema version 1

Top-level fields: `schema = gaiagis-poi`, `version = 1`,
`reconstruction = v1-geometric-gaia`, `world_extent`, `mapping`, `sources`,
`locations`, `entrances`, `unresolved`, `extraction`. Source hashes bind
the four input payloads (WM0 file; EV, table and maplist archive entries).
No absolute installation path is needed in the transport.

| Record | Fields / meaning |
| --- | --- |
| Location identity | `id`, `name`, `display_name`, `category`, `aliases`, `field_names`, `name_source` |
| Location navigation | `primary_entrance`, `entrance_ids`, `longitude`, `latitude`, `height`, `navigation_kind = primary_entrance` |
| Derived center | `center` is an equal-record-weight spherical chord centroid, including scenarios; null when ambiguous. `source_kind = derived_navigation_center`. It is not a game trigger and is not the default fly target. |
| Entrance raw position | `game_x` (east), `game_north`, `game_height`: centroid of a chosen source trigger triangle in raw game units |
| Entrance V1 position | `longitude`, `latitude`, `height`: the existing `Mapping.game_to_geographic` applied to that raw point, using the default frozen V1 configuration |
| Triangle lineage | `world_map`, `section_id`, `mesh_id`, `triangle_id`, `trigger_triangle_ids`, `region_id` |
| Script lineage | `source_script` (EV function ID), `function_header`, `script_calls` with call-table record and instruction **word** offset relative to the EV code area |
| Destination identity | `entrance_table_id` (1-based), `scenario` (0/1), `field_id`, `field_name`, `field_table_record`, `field_table_byte_offset` |
| Field-local destination | `field_x`, `field_y`, `field_triangle`, `field_direction`: distinct from world position and heading |
| Source / quality | `source_kind = derived_from_entry_trigger`, `source_file = wm0.map`, `source_record`, `confidence = verified_trigger_derived_position`, `notes` |
| Height | `height_source = interpolated_from_surface`; raw height is a triangle interpolation, not a FIELD.TBL world height. V1 metres retain the existing assumed scale. |
| Unknowns | `heading`, `trigger_radius`, `availability` are null; no runtime state was simulated. |

The frontend validates schema, finite numeric ranges, identifiers,
scenario/table indexing, all entrance references and the frozen V1
mapping declaration. It compares WM0 hashes with loaded V1 metadata,
then verifies every trigger triangle against the actual loaded mesh's
lineage/script. Representative position bounds, interpolated height and
region must agree with that source triangle. Malformed optional data
does not destroy an already loaded mesh or valid locations layer.

## Source responsibilities

- **WM0 MAP:** base trigger triangles, raw vertex positions, height,
  source lineage and FF7 region. Shared geometric edges define separate
  trigger components; each component remains a separate entrance.
- **wm0.ev inside world_us.lgp:** mesh call identity, ENTER_FIELD constant
  arguments and conditional scenario branches. Duplicate script paths
  to the same component/table/scenario retain all call sites in one record.
- **field.tbl inside world_us.lgp:** destination field ID and field-local
  landing information. It supplies no world coordinate.
- **maplist inside flevel.lgp:** field ID → internal name. The installed
  archive includes an unused empty final slot; a reference to an empty
  slot is rejected.
- **Existing V1 Mapping:** all geographic coordinates. No new POI
  projection or inverse-Mercator implementation is introduced.
- **Editorial name map:** friendly English names, aliases, grouping and
  simple categories only. It cannot alter positioning or create entries.

## Editorial names and limitations

The coordinate-free `NAME_GROUPS` table in `src/gaiagis/poi.py` annotates
verified internal fields. For this dataset all 34 generated location
names use those explicit annotations; raw internal names and parsed
numeric field IDs remain available in every entrance.

Examples of grouping: `psdun_1` / `psdun_2` → Mythril Mine;
`nivl_3` → Nibelheim's distinct entrances; `snow` → Icicle Inn's
two approaches; `itown1a` / `itown1b` → Mideel's story variants.
Unknown internal names are retained verbatim as category `entrance`.
Categories are navigational annotations, not game-native taxonomy.

Identity/name cross-checks:
[FF7 field IDs](https://ff7-mods.github.io/ff7-flat-wiki/FF7/Field/Field_ID.html),
actual local maplist, and the documented entrance labels in
[Landscaper's worldscript constants](https://github.com/maciej-trebacz/ff7-landscaper/blob/master/src/ff7/worldscript/constants.ts).
The latter warns that its labels may contain errors, so it is not used
as an executable mapping or coordinate oracle. Internal field identity
comes from the actual game data. Friendly labels remain an explicit,
reviewable human annotation rather than a claim that the game stores
these English POI strings.

Gold Saucer and Northern Cave are unresolved in this static base-trigger
extractor. Model/system functions, dynamic stack arguments, runtime
vehicle/state guards and alternative-section substitutions require
separate research. No visually estimated locations enter this dataset.
Wutai story destinations and other scenarios are retained without a
claim that they are simultaneously accessible. Trigger representatives
are points inside source triangles, not buildings' surveyed centers.

## Viewer behavior

Locations render as DOM markers, with no additional Three.js draw calls.
All five modes call their existing projection functions; morphing
interpolates the corresponding endpoints alongside the surface.
Globe occlusion and Orthographic hemisphere visibility hide far-side
markers. Major settlement labels use screen collision/priority checks;
other names appear on hover, keyboard focus or selection. Selected
entrance navigation updates that location's marker to the chosen entry.

Search ranks exact name, prefix, substring, alias and internal field
matches; Unicode normalization and case folding are used. Arrows,
Enter and Escape act on the focused search input, not map rotation.
Fly-to uses a 900 ms spherical shortest arc on Globe, shortest wrapped
longitude on Orthographic and planar camera panning on the rectangular
map views. Reduced motion applies the endpoint immediately. A projected
rectangle has a fixed longitude cut; its planar pan is not a spherical
orbit. `#location=<id>` resolves after a POI dataset is loaded.

The triangle inspector remains available. The location inspector lists
all entrances and provenance without conflating field-local facing with
world heading. Screenshots and real-data QA outputs remain private.

## Distribution

`gaia-poi.json` contains game-derived coordinates. It is local-generated
data under the same separate distribution gate as `gaia-mesh.bin`.
The code-only release includes the schema reader, generator, name
annotations, documentation and synthetic tests, but no complete POI
coordinate dataset. GPL-3.0-only applies to original code; it does not
grant rights to FF7 or third-party material.

## Optional world encounter GIS data

`gaia-encounters.json` is generated locally from a user's own read-only English
FF7 installation. It is ignored by Git and excluded from `build:release`.
It contains no new geometry and never changes V1 or v1.1 POI coordinates.

```powershell
python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
```

Default output: `web/public/data/gaia-encounters.json`. `--output` accepts another
path inside the workspace. Layout discovery and LGP access reuse the existing
read-only parser. Unknown hashes are not rejected by the binary parser; length
and structure are checked independently. There is no asset writer or game API.

## Schema version 1

| Field | Meaning / provenance |
|---|---|
| schema / version | `gaiagis-encounters` / `1` |
| reconstruction | `v1-geometric-gaia`; no latitude transform is performed |
| sources | SHA-256 of WM0, archive and exact enc_w.bin payload |
| source_record | Archive TOC index, payload offset and byte length |
| lookup_profile | `classic-pc-reference`; see research's compatibility caveat |
| runtime_equivalence | `not-verified-steam2026` |
| regions | 16 IDs, four ordered terrain codes and Yuffie random thresholds |
| terrain_aliases | Only 16→0 and 24→8; reference engine facts |
| encounter_sets | 64 referenced sets, IDs `region:slot`, active/raw/rate/offset |
| records | normal(6), back_attack(2), side_attack(1), both_sides(1), chocobo(4) |
| yuffie | Eight level upper bounds and masked/raw formation IDs with offsets |
| chocobo_ratings | All 32 raw entries; ten-bit-valid flag distinguishes sentinels |

Each record retains `scene_id`, `weight`, `packed`, `encounter_type`, and
payload-relative `byte_offset`. `scene_id` means the enc_w formation identifier;
no enemy database or scene.bin interpretation is included. Padding is preserved
as hex rather than silently discarded. `active` is the low bit of `active_raw`.
First matching rating record wins, mirroring the reference behavior.

The JSON has deterministic key ordering and no timestamps, machine paths or
random identifiers. Identical inputs produce byte-identical output. A triangle
references tables through its existing canonical region/terrain/script/Chocobo
attributes; 142,586 triangles do not repeat the tables. Synthetic polar faces
are unassigned and never inherit encounter or Chocobo attributes.

The frontend validates source fingerprints against loaded V1 WM0 metadata,
version, reconstruction, profile, region/slot order, lookup/aliases, record
counts, integer ranges, bit-packing, byte offsets and Yuffie bounds. This is
compatibility/integrity checking, not cryptographic authentication of an
untrusted JSON. A corrupt optional file leaves the last valid geometry,
locations and encounter dataset intact and reports the error. Archive/payload
hashes are recorded but the browser has only the WM0 fingerprint to compare.

## Viewer behavior

The original two-file geometry chooser remains intact. **Load Locations** and
**Load Encounters** are independent optional controls. Missing encounters show
`Encounter data unavailable`; Geometry, Terrain, Regions and Locations work.
Local development loads an optional JSON when present. The public source-only
build never fetches game-derived files; users select them locally with no upload.

- **Encounter Zones** colors active table + script 0, inactive table, or a
  nonzero script gate. These are static contexts, not a prediction of battle.
- **Encounter Rate** displays the raw 0..255 game divisor intensity. Its legend
  explicitly says this is not battles/time or area and higher is not faster.
- **Chocobo Tracks** independently highlights every real MAP tracks flag in
  yellow, including without an encounter file. It does not create POIs or infer
  tracks from battle records. Synthetic caps remain unmarked.
- The existing surface color attribute is updated; no overlay mesh or additional
  draw calls are created. Projection position buffers/formulas are untouched.
- Triangle Inspector includes source/effective terrain and region, table/slot,
  active/rate, script gate, weighted groups, Chocobo ratings, Mystery Ninja
  metadata and expandable offsets. Formation weights are not percentages.
- Groups are collapsed initially and mobile panels scroll within a bounded
  height. Location Inspector/search/fly-to remain unchanged; no nearest-location
  or nearest-color encounter inference is added.

Runtime movement, traversal/vehicle, party, Materia/Lure, story/save, RNG/danger
and previous battle state are not simulated. Forced/scripted battles are excluded.
The source flag, weighted Chocobo records and actual runtime eligibility are
displayed as separate facts. Numeric rating values are preserved without
editorial quality names. Mystery Ninja thresholds are conditional on an already
triggered encounter and its other gates. [Research](../research/world-map.md).

## World Events data and provenance

v1.4 adds an optional, locally generated JSON file. The existing V1 transport,
POI, encounters and traversal profiles are unchanged. Original code is
GPL-3.0-only; this does not license FF7-derived coordinate data for publication.

## Generate and load

From the project root, with Python 3.12+ and your own English FF7 installation:

```powershell
. tools/build/environment.ps1
python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
```

Default output is `web/public/data/gaia-events.json`. Optional `--field-archive`
selects an English flevel.lgp; `--output` must remain within the workspace and
outside selected read-only source directories. No QGIS runtime is required for
this exporter. It reads binaries only and never imports game-directory scripts.
Existing V1 geometry must have been generated separately with the documented
V1 pipeline. Use **Load Events** after loading the original two V1 files. Local
development also loads the file when present. The public source-only build
makes no default data requests. Missing/bad event files leave geometry,
locations and encounters usable; invalid replacements retain the prior events.

Enable **World Events**, select a category and use **Go to event** or a marker.
Fly-to, morphing, front/back culling and reduced motion reuse v1.1 behavior.
**Script Triggers** colors the existing source triangles (script >= 3); selected
event trigger triangles receive a distinct tint. It works without the optional
event file for raw MAP triggers. Trigger tint has visual precedence over terrain,
encounter/traversal coloring and Chocobo Tracks; those attributes are unchanged.

## Schema version 1

Top-level fields:

| Field | Meaning |
|---|---|
| schema / version | `gaiagis-events` / `1` |
| reconstruction / mapping | `v1-geometric-gaia` and existing V1 parameters |
| world_extent | WM0 raw extent |
| sources | SHA-256 of WM0, world_us.lgp, wm0.ev, FIELD.TBL and maplist |
| events | Spatially anchored potential events |
| unresolved | Candidates retained with reason and script provenance |
| extraction | Function/opcode inventory, call graph, limits and counts |

Events retain identity/type/display name; game_x/game_north/game_height and
V1 longitude/latitude/height; anchor_kind/world_map; section/mesh/triangle IDs
and trigger_triangle_ids; function_id/anchor_function/call_table_record/
instruction_offset/basic_block/opcode/raw_arguments; model/entity/field/
entry/scenario/battle/location identities where known; condition_kind,
runtime_availability, source_file/source_record/confidence and notes.
Offsets are **16-bit code word offsets**, excluding the 0x400-byte call table,
not archive byte offsets. `function_id` is the packed call-table header.

Unknown fields are null. entity_id stays null because model identity is not
proof of a particular runtime entity. Height comes only from a containing
source triangle, tagged `interpolated_from_surface`; it is not field height.
When no source surface contains a placement, height and triangle_id remain
null. Overlapping containing triangles with different heights also retain null
height/triangle lineage: XY alone cannot identify the model's surface. Matching
coplanar boundary triangles use a deterministic triangle-ID tie break.
Marker rendering uses a separately documented display-only height 0.
No nearest-triangle estimate or visual placement is permitted.

## Anchor and identity evidence

| Anchor | Evidence / meaning |
|---|---|
| derived_trigger_centroid | Source MAP script triangle component; representative interior centroid, not exact runtime player position |
| derived_terrain_gate_centroid | Northern Cave terrain-27 engine gate; classic-PC-reference evidence |
| script_model_position | Explicit constant SET_MESH_POS/SET_LOCAL_POS pair; script-defined placement, not current position |

Disconnected trigger components keep separate anchors. A scheduled call can
inherit the triggering cause, never a guessed moving-entity position. Objects
keep neutral `Scripted Model N` names; no lore database is added. Field identity
comes from FIELD.TBL + English maplist. Optional location_id uses the existing
explicit field-name identity mapping, never fuzzy display-name matching.
There is no manually entered coordinate table and no enemy-name inference.
Scripted Battle IDs remain distinct from random encounter scene tables.


## Optional local texture pack

Generate geometry with the existing V1 pipeline first. From the project root:

```powershell
python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
```

`--meta` accepts the existing gaia-meta.json; `--output` defaults to
output/v1_7/gaia-textures.bin. Output is restricted to this workspace. FF7 is
read only. No source asset is copied into Git. Load the two geometry files as
usual, then **Load Textures** once. The pack is optional and never fetched
automatically, including in source-only Pages. Rejected packs preserve the
previous texture and all loaded geometry/Locations/Events/Encounters/Routing.

The independently defined transport consists of:

| Bytes | Meaning |
|---|---|
| 0–7 | ASCII GAIATEX plus NUL |
| 8–11 | uint32 little-endian version 1 |
| 12–15 | uint32 JSON byte count |
| next | sorted compact ASCII JSON metadata |
| next | 14 bytes per source triangle: uint16 section, mesh, triangle, texture; six raw corner UV bytes |
| next | deterministic lossless RGBA PNG |
| last 32 | SHA-256 of every preceding byte, including metadata |

Metadata includes schema, version, mapId=WM0, V1 reconstruction, mesh SHA,
source WM0/LGP hashes, ordered resources, dimensions/page offsets, source and
RGBA hashes, TEX format, alpha presence, animation frames, missing resources,
atlas rectangles, payload sizes and an additional payload SHA. Counts and
lineage are validated against loaded geometry. Image decoding follows checksum
verification and verifies actual image dimensions. Limits bound file size,
metadata, dimensions, rectangles and allocation. No ZIP unpacking is involved.

The atlas uses deterministic size/ID shelf packing with four-pixel edge-extended
gutters. The observed 282-resource padded footprint is 1,140,480 pixels, exceeding
1024²; the chosen square atlas is 2048². RGBA GPU base-level storage is approximately
16 MiB. Mipmaps are disabled: four pixels cannot isolate neighbors through an
arbitrary mip chain. Nearest is default; Linear is a viewing choice, not a claim
about historical PC driver defaults. The ImageBitmap and Texture objects are
shared with comparison. Separate Three.js WebGL contexts necessarily upload the
same atlas once per context (approximately 32 MiB total while comparison is open).
Closing comparison releases its renderer/context, not the main atlas.

Unmodified decoded RGBA is tagged sRGB for a single hardware texture decode and
normal Three.js output conversion. Source alpha is respected. Small CPU alpha
arrays are retained only for transparent resources, allowing picking through
invisible texels. Synthetic poles and unavailable resources have zero atlas
rectangles and use explicit synthetic ocean/terrain fallback. They acquire no
FF7 texture provenance.

Per-corner signed coordinates are `(raw_u - page_u) / width` and
`(raw_v - page_v) / height`. Interpolation occurs before texture-local repeat
addressing in the shader. Atlas-repeat addressing is never used. Antimeridian
display tessellation interpolates corner UV using the same geographic clipping
coordinates; vertical/planar-degenerate faces use source height to preserve
corner identity. No source vertices are welded to determine UV. Projection
switching changes only display positions/masks; the UV attributes stay identical.

Surface Style selects Terrain, Region or Original Texture. The existing color
selector remains for compatibility and becomes an **Analysis overlay** label
over Original Texture. Encounter/traversal/reachability/tracks/triggers/routes
tint the original artwork with a deterministic 65% analysis-color contribution;
this composition does not change classifications. Triangle selection remains
the existing separate highlight. Canonical analysis can always use solid-color
surface modes. Transparent artwork is not treated as missing artwork.

The small public TSV contains necessary resource identity/dimension/page-offset
format facts, independently cross-checked with classic-PC tables and actual
TEX headers. It contains no artwork, pixels or triangle UV data. The original
decoder, packer, shader and tests are GaiaGIS code. References are not runtime
dependencies. Complete packs, TEX, decoded pixels, atlas images, UV records,
real-source inventories and textured screenshots remain ignored/local-only.

## Local Explorer data (v1.9)

Explorer is optional. A clean public checkout contains no model or movement
pack and makes no automatic Explorer asset request. Generate from your own
installation, from the workspace root:

```powershell
. tools/build/environment.ps1
python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
```

The default private outputs are `output/v1_9/gaia-explorer.bin` and
`gaia-explorer.report.json`. `--output` selects another workspace output.
No extraction, script execution, cache or modification occurs in the game tree.
Load your base WM0 V1 files, or an optional native map, then open Explorer and
choose **Load Explorer pack**. Start placement and click an actual source face.
Corrupt/incompatible packs leave previously loaded geometry and pack intact.

## Transport version 1

Little-endian prefix: eight-byte `GAIAEXP\0`, uint32 version 1, uint32 UTF-8 JSON
length, metadata padded to four-byte alignment, payload, then 32-byte SHA-256 of
all preceding bytes. The public schema identifier is `gaiagis-explorer`, with
`reconstruction: v1-geometric-gaia` and `runtimeClaim: false`. Metadata contains
sources, primary model registry, surfaces and texture blob references. All
payload offsets are relative to the padded payload start; spans cannot overlap.
The decoder caps total file size (80 MB), metadata (2 MB), model/frame/texture
counts, dimensions, references and finite numeric values.

- Eight primary models: hierarchy, RSD/P lineage, per-group material words,
  source-relative scale and animation identity evidence.
- Part vertex stride 48 bytes: float32 position3, normal3, colorRGBA4, UV2.
  Triangle groups are deindexed; no foreign runtime pointer is retained.
- A frame stride: six float32 root rotation/translation values plus three per
  animated bone. Original frame ordering is retained; timing is preview-only.
- Nine decoded RGBA textures with dimensions and original resource identities.
- WM0/WM2/WM3 surface record stride 56 bytes: nine signed int32 X/Z/raw-height
  corner values, three signed int32 neighbors (-1 blocked), terrain/script
  uint8, section/mesh/triangle uint16. Edge slot j is opposite corner j.

This surface payload is necessary source-space walker information absent from
rounded Web positions; it is not another public geometry product. WM0 contains
base source triangles only, no alternative substitutions or synthetic caps.
Native adjacency is bounded. Maps remain separate coordinate spaces.

Sources bind the three MAPs, world_us.lgp, all read model resources and three EV
payload hashes. Before placement the loader checks map hash, extent, triangle
count, ordered lineage and every native corner against the loaded V1/native map.
WM0 comparison permits only float32 geographic transport rounding. Graph references
must be reciprocal and identify the same endpoint XYZ edge (WM0 X modulo width
only); checksum validation alone is insufficient. Missing required model identity,
clip or referenced texture is rejected. This is integrity/compatibility checking,
not cryptographic authenticity of user-supplied files.

## Determinism and ownership

Stable model/part/bone/clip/texture order, explicit binary packing and sorted JSON
produce byte-identical packs for equal inputs. The private report inventories all
29 skeleton resources and candidate model IDs, including unknown identities.
It is not a public asset manifest. Both pack and inventory stay ignored.

Original FF7 models, skeletons, animation frames, pixels and derived movement
geometry remain rights-holder material. GPL-3.0-only applies to the original
GaiaGIS parser, transport/renderer/walker code, docs and synthetic tests. No game
asset, decoded OBJ/GLB or screenshot is included in Git or source-only build.
