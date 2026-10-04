# Optional local texture pack

Generate geometry with the existing V1 pipeline first. From the project root:

```powershell
python -B scripts/build_texture_assets.py "D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition"
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
