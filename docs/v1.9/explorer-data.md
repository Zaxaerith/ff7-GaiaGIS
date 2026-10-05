# Local Explorer data (v1.9)

Explorer is optional. A clean public checkout contains no model or movement
pack and makes no automatic Explorer asset request. Generate from your own
installation, from the workspace root:

```powershell
. ./scripts/use_workspace_environment.ps1
python -B scripts/build_explorer_assets.py "YOUR_FF7_INSTALLATION"
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
