# Gaia Web transport v1

A compact visualization format, not a general GIS standard. Stage 1 Float64 Geographic / GeoPackage remains authoritative. The browser loads one binary and small metadata JSON; no GIS runtime or FF7 binaries are needed.

All records are **little-endian**. File: `web/public/data/gaia-mesh.bin`; metadata: `gaia-meta.json`, including SHA-256, source product fingerprints, physical reference radius, palette names, counts and precision error. No absolute installation paths are included in public metadata.

## Header — 64 bytes

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

## Vertex and triangle blocks

Each vertex: **12 bytes** — longitude float32, latitude float32, height float32. Each triangle: **12 bytes** — three uint32 global vertex indices. Source vertices are keyed by original map/section/mesh/vertex record; no global positional weld or topology repair. Unreferenced source records may be omitted. Cap vertices follow the Stage 1 cap tables, including one canonical pole per hemisphere.

## Triangle attribute record — 16 bytes

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

## Canonical data versus display tessellation

The runtime dataset preserves all Stage 1 canonical triangles. Display geometry expands corners for flat categorical colors, short-edge antimeridian clipping and per-face picking. `renderToSource` maps every generated display face back to the original canonical record.

At an exact pole, longitude is undefined. The display duplicates the pole by longitude sector and fills the plane's polar row with a sector quad; those duplicate corners coincide on the Globe. This changes display tessellation only, not canonical counts/lineage or the stored geographic model. Original source grid draws FF7 triangle perimeters, not fan triangulation edges added for display.

Globe display coordinates are `(GaiaY,GaiaZ,GaiaX)/R` and include assumed height; normalized reference radius is 1. Map positions are `(projected_x/R,projected_y/R,0)`. Standard map XY ignores radial height. Single interface projection formulas are CPU-generated; CPU lerp with cubic easing drives 1.1s visual transitions. Intermediate states are not true projections.

Mercator clamps all target positions to the configured finite latitude limit and hides entire triangles touching/exceeding the excluded zone; this first version may omit a narrow strip within the exact GIS cutoff. Orthographic uses a moving geographic center and signed vertex visibility; a small material hook clips/fades interpolated visibility at the horizon. Shader code contains no projection engine. Other positions stay CPU-computed.

## Current local data

- 94136 vertex records: 88950 FF7 + 5186 cap records.
- 152378 canonical triangles: 142586 FF7 + 9792 synthetic.
- Binary **5396280 bytes**; gzip **1196930**; Brotli **696175**; metadata **2905** bytes.
- Max Float32 spherical quantization error against Stage 1 Float64: **0.424211m**.
- Web asset precision ≠ canonical GIS precision.

Compression sizes are measured outputs, not a claim that GitHub Pages will automatically serve those encodings. The Viewer fetches the regular binary. Generated transport/compressed files are local-only and Git-ignored.
