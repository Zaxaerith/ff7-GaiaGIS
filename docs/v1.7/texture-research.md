# WM0 texture research — in progress

Observed from the user's Steam English installation, read-only: world_us.lgp
contains 415 TEX resources. All headers specify palette_flag=1, bit_depth=4,
bytes_per_pixel=1. This is one byte per palette index, **not packed nibbles**.
WM0 base triangles use 277 distinct texture IDs. These counts are computed,
not compatibility gates. The private header inventory and source fingerprints
are in ignored output/v1_7. The 415 files include non-WM0 artwork; they must not
all be described as WM0 surface textures.

References (behavior only; no implementation copied):

- [Classic-PC wmfile tables](https://github.com/ergonomy-joe/ff7-worldmap/blob/master/NEWFF7/wmfile.cpp): D_00969CE8 resource names, D_0096A330 page offsets,
  D_0096B418/D_0096B448 animation correspondence.
- [Classic-PC drawing](https://github.com/ergonomy-joe/ff7-worldmap/blob/master/NEWFF7/C_0075F090.cpp): source UV minus page offset, scaled by texture dimensions.
- [Landscaper catalog](https://github.com/maciej-trebacz/ff7-landscaper/blob/main/src/lib/map-data.ts) and WorldMesh hooks: independent name/dimension/offset cross-check.
- [TEX format](https://wiki.ffrtt.ru/index.php/FF7/TEX_format): 0xEC-byte header, BGRA palettes, index-zero color key and reference-alpha replacement.

The engine and Landscaper disagree in general UV handling: the engine retains
signed page-relative coordinates and delegates texture addressing to the
renderer, whereas Landscaper calcUV uses an absolute remainder and a special
boundary adjustment. GaiaGIS must retain per-corner source UV, use a documented
repeat sampler, and numerically record discrepancies rather than silently copy
that helper. Atlas sampling must wrap within each texture, not within the atlas.
Antimeridian display clipping needs interpolated corner UV; position welding
cannot supply UV identity.

Animated surface sources use explicitly named frames. v1.7 will choose frame
one deterministically, validate its existence and dimensions, and inventory
the remaining frames. No animation or runtime-equivalence claim is made.
Steam 2026 renderer equivalence remains NOT VERIFIED.

Observed follow-up: 282 definitions have 282 unique names, all resources present,
all dimensions agree, and all 282 page-offset pairs agree with the independent
classic-PC table. WM0 base triangles use 277 IDs; definitions 0–4 are unused in
that base reconstruction (not a claim about all story alternatives). All 282
first-frame resources have one 16-color BGRA palette, bit_depth=4 and one stored
byte per index. 274 disable color key; 8 enable it. Reference alpha is 255.
Three decoded resources contain transparent pixels: ggmk, subrg2 and susbrg.
Other first-frame resources are opaque. Alpha/channel/key behavior is also tested
with original synthetic paletted, RGB565, RGB24 and RGBA32 fixtures.

There are 22 engine-mapped animated definitions: five eight-frame sequences and
seventeen four-frame sequences, 108 named frame files, none missing. Including
all additional animation frames gives 368 unique WM0 surface resource files.
Only 282 deterministic first frames are decoded into the v1.7 atlas. The other
files are inventory evidence; no animation timing is reconstructed.

Across 855,516 base-triangle UV components, 263 differ from Landscaper calcUV.
For example texture ID 137, raw U=64, page U=64, width=128 gives repeat coordinate
0; the reference helper's special boundary clause gives 63. Source byte/corner
and signed engine subtraction are retained, rather than introducing this shift.
The exact modern/original driver's wrap/filter behavior remains a reference
limitation. GaiaGIS's repeat plus edge-extended atlas policy is explicitly a
reconstructed sampler, not runtime-verified emulation. Numerical tests cover
page offsets, negative repeat, boundary interpolation, vertical faces, shared
positions with different UV and all thirteen unchanged projection mappings.

The atlas's padded area is greater than 1024², justifying a 2048² square.
Nearest and Linear are viewing options; mipmaps stay disabled to avoid bleeding.
Private screenshots are reviewed for Globe relief, Equal Earth, Mercator,
Winkel Tripel, Mollweide, Orthographic, coastlines and real terrain examples.
No artwork or complete real-source manifest is added to public documentation.
