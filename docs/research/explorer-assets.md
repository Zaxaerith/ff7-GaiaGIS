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

## Lighting and grounding research

### Observed audit
Gaia and native surfaces and Explorer parts use MeshBasicMaterial, with no ambient/hemisphere/directional lights. Renderer defaults are sRGB output, NoToneMapping, exposure 1. Atlas and model TEX inputs are tagged SRGBColorSpace; installed Three.js uploads them as SRGB8_ALPHA8. Sampling them already yields linear RGB: applying another sRGB decode would be incorrect.

P BGRA byte colors, however, are exported as byte/255 and uploaded directly as vertex colors. Three.js vertex colors are linear. A source gray 128 therefore displays near 188 rather than 128. This is a demonstrated missing vertex-color decode, separate from texture tagging. White remains white; unlit parts additionally lack shape illumination. Terrain has an optional derivative-normal shading multiplier, not a physical daylight simulation. There is no contact shadow and model origin is not guaranteed to be its feet.

### Reference-derived
[Classic world lighting](https://github.com/ergonomy-joe/ff7-worldmap/blob/main/NEWFF7/C_0075E7A0.cpp) uses ambient plus directional contributions, with map-dependent systems. It is not modern PBR. [C_0075DEAA](https://github.com/ergonomy-joe/ff7-worldmap/blob/main/NEWFF7/C_0075AC80.cpp) varies shadow brightness and dimensions by height and model ID. Do not copy those routines or claim Steam 2026 equivalence.

### Implemented independent approximation
Decode P RGB to linear exactly once (including tint after source-space addition); retain texture sRGB hardware decode and output conversion. A moderate ambient and one dominant Lambert directional contribution belongs to the selected Explorer model, in a local surface frame. Original-inspired/GIS Flat/Debug Bright are viewer presets, not runtime emulation. Terrain artwork retains its colors, with only existing modest shading; 2D map views are unaffected. A procedural soft contact shadow follows source ground, fading and widening with Highwind altitude. Ground origin derives from actual posed mesh bounds; scale is display metadata, not GIS meters.

GPU readback independently demonstrates the cause: an unconverted vertex gray 128 renders as 188; decoded gray renders as 128; sRGB-tagged texture gray also renders as 128; white stays 255. There is no second texture decode. Output color space / NoToneMapping / exposure 1 are now explicit, retaining established terrain output. The three presets affect only model uniforms: Original-inspired ambient 0.6 plus directional 0.4, GIS Flat 1 + 0, Debug Bright 1.25 + 0. Double-sided low-poly face normals use the absolute directional contribution; this is a stable viewer approximation, not recovered classic vertex-light arithmetic. The dominant direction is local east -0.35, up 0.8, north 0.5, normalized. No PBR, specular, bloom or hemisphere fill is introduced.

Ground origin is the negative minimum Y of the original idle pose. Full original Euler orders and root translations remain intact. Contact shadows use one procedurally shaded quad, fitted to the actual rendered source-triangle plane with a tiny offset. They add one draw call, fade with altitude and dispose on exit. Highwind radius widens with height and its opacity exponentially fades; Submarine shadow is a generic visual approximation. This is not runtime shadow physics, a collision shape, or a footprint simulation. Animated root motion and sharply discontinuous surfaces can still produce brief contact differences.

Private before/after captures use WM0 triangle 22556, raw (48981.6667, 65079, 477.6667), Cloud and the exact same camera/target. Hair and clothing recover tonal separation; sea/terrain remain unchanged. A Mercator canvas image is byte-identical across model lighting presets. This separates model color correction from geography/2D map presentation.

## Party asset research

### Observed resources
world_us.lgp contains the existing verified world-map leaders Cloud bbe.hrc (21 bones), Tifa dlb.hrc (24), Cid ata.hrc (21). Keep those exact sources. char.lgp is 48,989,867 bytes and contains 385 HRC resources. Independently decoded candidates: Barret acgd.hrc/sd_ballet_sk/21, Aerith auff.hrc/n_earith_sk/23, Red XIII adda.hrc/sd_red_sk/29, Yuffie abjb.hrc/sd_yufi_sk/24, Cait Sith aebc.hrc/sd_ketcy_sk/28, Vincent aehd.hrc/sd_vincent_sk/25. Identity is cross-checked with internal field model loader names, not screenshots.

### Animation evidence
[Field section-3 layout](https://wiki.ffrtt.ru/index.php/FF7/Field/Model_Loader) describes model HRC names, source scale and ordered A-file bindings. The actual blackbg1 payload confirms record sizes and complete consumption: its Aerith binds avbf/avca/avcb, Barret adcb/adcc/adcd and Red XIII aeae/aeaf/aeba. These animation files match each corresponding skeleton exactly. The [Ifalna-derived reference inventory](https://github.com/maciej-trebacz/ff7-lgp-explorer/blob/main/src/assets/model-animations.json) is a discovery hint only, not copied or used at runtime. Additional model bindings require actual source evidence. A matching bone count alone is insufficient for retargeting.

### Classification and boundaries
Six added characters are **Extended Explorer models: original FF7 field assets, not original world-map leader assets**. Use actual field-loader animation bindings where structurally compatible; otherwise static/limited preview. No invented animation or lore identity. Preserve Explorer transport v2 and old v1/v2 loading. Registry additions are optional, independently validated. Source-unit conversion, ground contact and forward axis must be checked from posed geometry and private QA; animation speed is still preview 30 fps.

### Final source binding inventory

| Character | Source HRC | Bones | Actual field loader | Idle / move / third source clip (frames) | Class |
|---|---|---:|---|---|---|
| Cloud | world_us.lgp: bbe.hrc | 21 | original world registry | bid 1 / bie 15 (existing bindings) | World-map leader |
| Tifa | world_us.lgp: dlb.hrc | 24 | original world registry | dse 1 / dta 15 (existing bindings) | World-map leader |
| Cid | world_us.lgp: ata.hrc | 21 | original world registry | aze 1 / baa 15 (existing bindings) | World-map leader |
| Barret | char.lgp: acgd.hrc | 21 | flevel.lgp: blackbg1 | adcb 1 / adcc 30 / adcd 15 | Extended field, Tier A |
| Aerith | char.lgp: auff.hrc | 23 | blackbg1 | avbf 2 / avca 20 / avcb 15 | Extended field, Tier A |
| Red XIII | char.lgp: adda.hrc | 29 | blackbg1 | aeae 1 / aeaf 20 / aeba 15 | Extended field, Tier A |
| Yuffie | char.lgp: abjb.hrc | 24 | blackbg4 | acfb 2 / acfc 25 / acfd 14 | Extended field, Tier A |
| Cait Sith | char.lgp: aebc.hrc | 28 | blackbg5 | aeha 2 / aehb 30 / aehc 15 | Extended field, Tier A |
| Vincent | char.lgp: aehd.hrc | 25 | blackbgi | afdf 2 / afea 30 / afeb 15 | Extended field, Tier A |

Tier A means its own original field-loader animation binding; it does not mean a verified world leader or Steam 2026 animation timing. Vincent's own 25-bone binding is used instead of a discovery-list suggestion involving 21-bone Cloud clips. Red XIII and Cait Sith use their own skeleton/animations. There is no retargeting, procedural gait or fan model. Every HRC→RSD→P→TEX reference is validated. Actual idle and move frames produce finite bone matrices, and all nine models pass switching and ground-bound checks in the browser.

Field-loader source scale is retained as provenance. Extended models are normalized for navigation display to heights 510 (Barret), 270 (Red XIII), 500 (Cait Sith), 450 raw display units (others). These are explicit reconstructed display sizes, not physical/canonical heights or source-coordinate changes. Cloud/Tifa/Cid retain scale 15.2. The model frame uses the established complete source-frame rotation; bone lengths, Euler order and original animation values remain source-local. Old packs retain original eight models and show the six missing characters disabled. Extended model IDs are null, never invented WM runtime IDs.

## Presentation research

Research precedes styling. All original resources stay private and read-only.

### Observed
English menu_us.lgp is 1,705,214 bytes. The installed sound directory contains audio.dat (71,738,528 bytes) and audio.fmt (54,668 bytes). No original bitmap, font, cursor or recording is required by the public theme. The independently parsed audio.fmt contains 750 records. Four UI cue names from three distinct non-looping mono Microsoft ADPCM records are decoded to private PCM16LE WAV payloads at 44.1 kHz.

### Reference-derived
Classic [world dialog implementation](https://github.com/ergonomy-joe/ff7-worldmap/blob/main/NEWFF7/C_00768C70.cpp) separates dialog allocation, quarter-size expansion, text reveal, selection hand and close states. Its helper plays sound ID 1, but this alone does not establish all menu confirm/cancel/navigation mappings. The menu configuration permits changing window colors: deep-blue defaults must not be treated as a universal asset color.

[Classic sound identifiers](https://github.com/Zaarbs/ff7/blob/d094a23d0b6dde9853fadb9632083d7fbc0e3580/src/sound/sound.h), [menu call sites](https://github.com/Zaarbs/ff7/blob/d094a23d0b6dde9853fadb9632083d7fbc0e3580/src/menu/menu.cpp) and [sound-table lookup](https://github.com/Zaarbs/ff7/blob/d094a23d0b6dde9853fadb9632083d7fbc0e3580/src/sound/sound.cpp) distinguish one-based runtime SFX IDs from zero-based audio.fmt records. [Pinned FFNx](https://github.com/julianxhokaxhiu/FFNx/blob/fb785cee53de14a2d10b0df45a297d1aba5bf3b5/src/sfx.cpp#L43-L46) independently uses `id - 1`. The old generator incorrectly used runtime IDs as array indices: normal confirm selected the denial record, while cancel selected an unrelated record.

Ordinary menu acceptance and cursor movement use runtime ID 1 / **record 0**; GaiaGIS maps both `confirm` and `cursor` to that short cue. Return/cancel uses ID 4 / **record 3**; actual rejection uses ID 3 / **record 2**. ID 2 / record 1 is used for specific confirmations (including input binding and save/load preparation), not every ordinary button. The [Qhimm historical list](https://forums.qhimm.com/index.php?topic=10237.100) is an acknowledged incomplete listening list, a secondary cross-check only. Actual local records validate bounds, non-looping mono ADPCM coefficients and PCM decoding; The ordinary menu chime (record 0) was also confirmed by local user audition; cancel/denial semantics are reference-derived, not a claim of modern executable runtime equivalence. No decompiled implementation is copied.

`presentation-menu-2` is the Presentation generator revision, independent of geometry. Old audio packs are rebuilt at launcher startup; obsolete manual packs are rejected without affecting other components. Native input acknowledgement excludes disabled, inert, prevented, synthetic and unchanged events. Checkbox/radio changes have one acknowledgement, sliders stay quiet, and native form validation or an explicit rejected-action notification alone may request `invalid`. No generic error tone is inferred from button names. Summaries reuse normal/cancel cues rather than inventing a menu-open source. Sound settings, gesture gating, volume and source-only silence remain optional.

The fmt record has six uint32 metadata fields followed by WAVEFORMATEX. Extension length applies to ADPCM; unused records contain 0xCD allocator markers in nominal format fields. Treating every unused cbSize as an extension length would misparse this installation.

[Square Enix's original-game gallery](https://www.jp.square-enix.com/ff7sp/) is an identified cross-platform/mobile visual reference, with [gallery image](https://www.jp.square-enix.com/ff7sp/image/ph04_1.jpg). Direct browser retrieval was unavailable in this environment, so it is not counted as a completed visual/runtime comparison. The completed visual evidence is a controlled v2.0.1 versus v2.1 comparison using the actual installed artwork and model at the same source triangle, camera, relief and texture. Classic-PC lighting/dialog research provides behavior evidence; this does not establish pixel equivalence with that gallery or Steam 2026.

### Reconstructed public design
Use original CSS primitives: blue-to-black panel gradients, bright outer rims, inner highlights, modest corners, selected-row pointer, explicit disabled/focus states. Keep logical six-panel hierarchy, readable scientific tables and long values. No copied bitmaps, font atlas, scanlines, blur or CRT effect. Scientific theme remains available. Exact classic pixel/UI equivalence is not claimed.

### Unknown
Steam 2026 rendering equivalence, full cue registry and runtime timings remain NOT VERIFIED.
