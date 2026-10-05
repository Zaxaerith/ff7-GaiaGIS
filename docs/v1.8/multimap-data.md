# Local multi-map data

Generate from your own FF7 installation:

```powershell
python -B scripts/build_multimap_assets.py "D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition"
```

Default output is ignored `output/v1_8/data/` in the GaiaGIS workspace. The
generator reads MAP/LGP and sibling field/flevel.lgp maplist, writes no source
files, rejects outputs outside the workspace and reuses existing MAP/LGP/TEX
parsers. Directory discovery supports the existing classic/2026 layouts.

`scripts/probe_multimap.py <source>` independently records source inventory,
exact native edge incidence and seam comparisons. Its optional
`--protected-manifest <previous-manifest.json>` adds workspace preservation
checks. A clean checkout has no previous private manifest; that check is
explicitly reported unavailable, while source before/after fingerprints are
still recorded. The local acceptance run compared all 73 existing entries.

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
