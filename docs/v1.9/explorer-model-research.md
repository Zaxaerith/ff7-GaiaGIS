# Explorer model research (v1.9)

This investigation precedes Explorer implementation. Game files remain read-only;
all decoded resources and inventories are private workspace outputs. The current
Steam 2026 executable has **not** been verified equivalent to the classic PC
reference. This is a static GIS exploration preview, not an FF7 runtime.

## Observed source

The English `world_us.lgp` inventory contains 29 HRC, 228 RSD, 228 P,
77 A and 415 TEX resources. These are resource counts, not engine model counts.
The archive fingerprint is recorded in `output/v1_9/source-before.json`.
HRCs contain named bones, named parents, lengths and RSD references. Actual
primary skeleton identities include `sd_cloud_sk` (bbe.hrc), `buggy_sk`
(aba.hrc), `chocobo_sk` (aja.hrc), `highwind_sk` (cgd.hrc), `sbmrn_sk`
(ddd.hrc) and `tinybronco_sk` (dva.hrc). Cloud has 21 bones, Buggy 25,
Chocobo 28, Highwind 6, Submarine 7 and Tiny Bronco 7. Parts are rigidly
attached to animated bones; there is no observed per-vertex skin weight table.

## Reference-derived behavior

[Classic PC wmfile.cpp](https://github.com/ergonomy-joe/ff7-worldmap/blob/main/NEWFF7/wmfile.cpp),
at cached revision bc7576e68b118e776ccefecfbc982a702a7f9e0f, loads
HRC → RSD → P/TEX and separate A animations. The world loader itself establishes
this chain; it is not assumed merely because field models use similar formats.
The reference assigns Cloud/Tifa/Cid IDs 0/1/2, Highwind 3, Tiny Bronco 5,
Buggy 6, Submarine 13 and Chocobo resources for IDs 4/19. IDs 41/42 have Chocobo-related engine branches, but their renderer/resource identities remain unresolved. Resource lookup depends on map
and world-state tables; distinct IDs need not mean distinct skeleton files.
The loader scale is max(registry scale / 512, 1) × 15.2 source units.
It is a game rendering scale, not meters.

[Animation selection reference](https://github.com/ergonomy-joe/ff7-worldmap/blob/main/NEWFF7/C_00760FB0.cpp)
uses stationary/moving clip indices 0/1 for ordinary models, clamps to available
clips, has explicit script overrides and a separate Buggy selection routine.
Loop versus one-shot depends on entity flags. Frames and their original order
must be retained; preview playback timing is not claimed to match Steam 2026.
Chocobo additive color offsets are documented by C_0075E4D6; a traversal color
name does not itself prove a different model resource.

## Independent format plan

[P format reference](https://wiki.ffrtt.ru/index.php/FF7/P) describes a 128-byte
header and group-relative triangle/UV indices. Actual sampled P files confirm
the counts, 24-byte polygon records and 56-byte groups. Runtime pointer words
are not identities and must not be exported. The renderer must preserve group
material and texture selection. RSD names ending PLY resolve the corresponding
PC P resource; TEX names resolve by archive basename.

The sampled A files have a 36-byte header, float root rotation/translation and
three float angles per bone per frame. Observed `bid.a` is one frame / 21 bones
(312 bytes); `asc.a` is 20 frames / 28 bones (7,236 bytes). Rotation order is
stored in the header and must be honored. HRC hierarchy, resource bounds and
all indices are checked independently rather than copied from a parser.

## Movement boundary

WM0 movement is source X/Z and exact source-edge adjacency, with E/W periodic
identification and a deliberate N/S cut. Caps are excluded. Existing v1.3
static profiles supply occupancy checks; they do not establish runtime
reachability. Native WM2/WM3 remain bounded. Underwater vertical controls and
snowfield logic are distinct in C_0074EA48. Until their full collision/runtime
equivalence is established, native exploration is explicitly a geometry-
constrained preview. No seamless dive destination is inferred from map offsets.

## Licensing and unknowns

Decompiled and Landscaper repositories are behavior references only; no code
is copied or made a runtime dependency. GaiaGIS parsers and evaluators are
independently implemented. Animation interpolation, preview rate, camera feel
and Steam 2026 runtime collision equivalence remain reconstructed/unknown,
and will be separately labelled in the data and validation reports.

## Complete inventory and observed discrepancies

The private deterministic export report contains all 29 HRC resource chains,
43 candidate engine IDs (0..42), per-model parts/materials/triangle counts,
TEX names/dimensions, animation names/counts, WM0/WM2/WM3 EV call-table references
and payload SHA-256 fingerprints. All 29 HRC, 228 RSD, 228 P and 77 A files decode
without a failure. Inventory counts are not a claim of 43 distinct visual models.
IDs 31..40 have no verified resource mapping; 41/42 remain Chocobo-related but
resource-unresolved. Non-primary identities retain actual HRC skeleton names;
these names alone are not a verified friendly/lore identity.

| Explorer | Model ID | HRC | Bones | Render groups | Triangles | Clips |
|---|---:|---|---:|---:|---:|---:|
| Cloud | 0 | bbe.hrc | 21 | 18 | 534 | 10 |
| Tifa | 1 | dlb.hrc | 24 | 20 | 560 | 11 |
| Cid | 2 | ata.hrc | 21 | 18 | 553 | 10 |
| Highwind | 3 | cgd.hrc | 6 | 4 | 323 | 1 |
| Chocobo | 19 | aja.hrc | 28 | 23 | 318 | 3 |
| Tiny Bronco | 5 | dva.hrc | 7 | 7 | 444 | 1 |
| Buggy | 6 | aba.hrc | 25 | 14 | 380 | 6 |
| Submarine | 13 | ddd.hrc | 7 | 5 | 454 | 1 |

Actual HRC files with `:BONES 0` retain a null/root rigid attachment. Treating
zero bones as zero resource records loses those models. Actual P bounding-box
records include a four-byte marker and six float bounds (28 bytes), rather than
the 24 bytes suggested by the older P description. These deviations were
identified from exact file lengths, not patched to match expected counts.

RSD resolves PLY/TIM names to PC P/TEX resources. The selected three party models
use nine 32×32 TEX images in total; the selected vehicles/Chocobo use original
vertex colors. Existing independently implemented TEX decoding is sufficient.
P group material words remain in the local pack; the preview uses unlit colors,
texture sampling, alpha-test and double-sided triangles. Full original lighting,
blend-state/sorting equivalence and environmental effects are not claimed.

## Coordinate basis and animation verification

Model frame coordinates are distinct from MAP coordinates. A child joint begins
at its parent's endpoint along negative local Z. Source Euler angles compose
using the stored order (all observed files use Y/X/Z); root translation reverses
the stored Y sign. The complete model frame is then converted to display Y-up.
This conversion is applied once at the parent frame. Negating every joint angle
individually initially produced dislocated vehicle parts and was rejected by
visual QA. The final renderer preserves source-local angles and uses a global
180° X conversion, with a display heading convention so the camera follows
behind the model. Neither operation changes canonical geographic coordinates.

These mathematical relationships were independently checked against
[KimeraCS field skeleton](https://github.com/LaZar00/KimeraCS/blob/master/FF7FieldSkeleton.cs)
and [rotation utilities](https://github.com/LaZar00/KimeraCS/blob/master/Utils.cs).
[Q-Gears HRC](https://github.com/q-gears/q-gears/blob/master/QGearsMain/src/data/QGearsHRCSkeletonLoader.cpp)
and [A animation](https://github.com/q-gears/q-gears/blob/master/QGearsMain/src/data/QGearsAFile.cpp)
provide a separate basis conversion; its transformed axes cannot simply be
applied to unconverted P vertices. No implementation is copied. Real screenshots
were checked for assembled Cloud/Tifa/Cid, Buggy, Bronco, Chocobo, Highwind and
Submarine. This establishes coherent preview assembly, not pixel-perfect runtime
rendering or a verified Steam2026 matrix implementation.

The exporter associates animation resources within lexical HRC resource ranges;
for every packed primary model the names/count/order were cross-checked against
the actual classic loader registry. Generic non-primary associations are inventory
observations, not guaranteed runtime clip bindings. Party models and Chocobo use
stationary index 0 / moving index 1 from C_0076328F. All original clip frames are
preserved, including unnamed indices. Buggy C_00763AAE provides the drive index 1
and water index 3; the preview uses those two moving states without inventing
boarding or a runtime water-entry transition. Highwind CIC, Bronco DYA and
Submarine DFE loop their available source frames with neutral clip names.

Playback is explicitly **preview 30 fps**, sampled original frames. There is no
invented interpolation, walk cycle, one-shot flag emulation, takeoff/landing clip,
or assertion of classic/2026 tick equivalence. Shift changes navigation speed,
not a verified run-animation selection. Script clip overrides are not executed.

Chocobo shares aja.hrc. C_0075E4D6 supplies additive RGB offsets for yellow
(50,50,-30), green (-30,50,-30), blue (-30,50,50), black (-80,-80,-80) and gold
(69,17,-147), clamped to source color range. These are independent visual tint
facts; the five movement profiles separately reuse existing traversal rules.
The Submarine registry includes other state resources; only verified ddd.hrc is
packed, without claiming current save-state color or identity.

## Remaining research boundaries

C_0074EA48 has distinct underwater vertical/steering logic and relative height
limits, but does not establish full Steam2026 collision equivalence. Explorer uses
bounded source geometry plus a nonnegative relative preview altitude, explicitly
not original submarine physics. WM3 has its own movement semantics; it does not
inherit the WM0 Foot mask. Both are labelled native geometry previews.
No shadow, original camera preset, NPC behavior or model/world-state simulation
is inferred. WM0↔native destinations remain unresolved under the v1.8 transition
inventory; the preview stops before map switching and requires manual placement.
