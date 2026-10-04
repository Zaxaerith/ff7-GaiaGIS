# v1.4 local release-candidate validation

Validated 2026-10-04 in `D:\Project\FF7Gaia`, local main based on v1.3
`5d5ed163d1ba06dfd1e8162c1e432f3932e98996`. No v1.4 push, tag, Release or
Pages deployment is authorized or performed. V1 math, projections, geometry,
MAP parsing fundamentals and climate research remain frozen.

## Input and analysis

Read-only installation:
`D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition`.
`world_us.lgp` contains **28,672-byte wm0.ev**. English FIELD.TBL and
flevel.lgp/maplist supply destination identities; WM0 supplies surface lineage.
No save files, scene.bin or game-directory scripts are executed/imported.

| Observed quantity | Result |
|---|---:|
| Non-dummy call-table records | 142 |
| Distinct code starts | 124 |
| System / model / mesh records | 32 / 61 / 49 |
| Unique reachable instruction word offsets | 8,640 |
| Distinct opcodes | 118 |
| Static call edges | 131 |
| Abstract instruction states processed | 11,788 |
| Guard hits / detected call cycles | 0 / 0 |

GOTO, false branches, RETURN, constant stack arithmetic/comparison and scheduled
CALL_FN/LOAD_MODEL call-graph edges are supported with finite joins and bounded
guards. Dynamic memory and context state remain symbolic. This is not VM
execution or proof of runtime availability. Inventory counts instruction sites,
not dynamic executions; aliases do not inflate counts. Full opcode counts are
in [opcode-inventory.csv](opcode-inventory.csv).

Selected observed instruction-site counts: ENTER_FIELD 60, BATTLE 12,
LOAD_MODEL 102, SET_ENTITY 18, SET_MESH_POS 83, SET_LOCAL_POS 84,
SET_POINT/MESH/LOCAL 13 each, ENTER_VEHICLE 47, EXIT_VEHICLE 3,
SET_VEHICLE_USABLE 1, SET_CHOCOBO 5, SET_SUBMARINE 2,
SHOW_LAYER 6, HIDE_LAYER 5. MOVE_TO_MODEL and EXIT_UNDERWATER are not present
in the observed reachable inventory. Visual effect points are not plotted as
gameplay anchors. No WM2/WM3 visualization was added.

## Export and unresolved evidence

| Spatial event type | Records |
|---|---:|
| dynamic_entrance | 50 |
| script_trigger | 49 |
| world_object | 77 |
| vehicle_event | 1 |
| scripted_battle / map_transition / other | 0 |
| **Total** | **177** |

Counts describe records/anchors, not unique named places or live entities.
Every event has a reliable trigger, terrain gate or script-constant placement;
no visual guesses or nearest-POI anchors are used. All observed placements have
a containing source triangle in this dataset; height is surface-interpolated,
not an original field height. An additional check found zero placements with
different containing-surface heights. Missing or ambiguous heights stay null
for other inputs; the synthetic overlap test forbids choosing an arbitrary layer.
Representative centroids are navigation points rather than exact player
trigger coordinates. v1.1's 34 locations / 43 entrances remain unchanged.

**156 unresolved candidates** remain in the private output:

| Reason | Records |
|---|---:|
| dynamic_call_target | 13 |
| dynamic_or_partial_model_position | 51 |
| non_spatial_or_runtime_anchor | 92 |

The 12 BATTLE sites are retained with raw IDs among unresolved candidates;
none has an acceptable spatial anchor in this extraction policy. Battle UI is
tested using a clearly synthetic raw-ID-42 event, not a claimed real battle.
No enemy names, loot or scene database were inferred.

Private `gaia-events.json`: **266,566 bytes**, deterministic sorting and newline.
Repeated real-source exports are byte-identical. No geometry is copied into
this file. It is ignored and excluded from public delivery.

### Gold Saucer

Model 14 initialization header 0x4e00 provides an explicit complete mesh/local
placement, resolving a **script-defined object anchor only**. Its display name
remains neutral in the dataset. Field entrance/destination linkage remains
unresolved; an unrelated placement is not borrowed to fabricate a transition.
Runtime motion/state is unknown and not simulated.

### Northern Cave

System function 9 reaches model-3 function 30 (0x431e), ENTER_FIELD table 59,
scenario 0: **field 744, las0_1**. Classic-PC C_0076667C invokes system 9 under
terrain 27. Two source terrain components provide derived navigation anchors,
tagged `classic_pc_reference_derived`. This is not the MAP 3-bit script value 9.
Vehicle/descent/savemap conditions remain unknown at runtime; v1.1's original
POI policy and coordinates are unchanged. Current 2026 executable equivalence
is **UNKNOWN / NOT VERIFIED**.

## Viewer and tests

World Events defaults off; optional loading, category filtering, marker
selection/fly-to, script-trigger surface tint and Event Inspector are complete.
Advanced details expose call-table index, instruction word, block, raw arguments
and source anchor. Unknown fields are not shown as null rows. Triangle and
Location inspectors coexist; random encounters and traversal stay independent.
Source-only builds can load local Events with no data request or upload.

| Validation | Result |
|---|---|
| Python source-enabled regression | 148 passed: core 35, sphere 22, Web export 3, POI 17, encounters 19, traversal 22, events 30 |
| Web Vitest | 166 passed across 10 test files |
| Real-source event browser QA | 201 checks passed, no page errors |
| Existing traversal browser regression | 403 checks passed |
| npm build / build:release / audit:release | Passed |
| Public code-only build | 7 allowed files, zero game-derived files |
| Clean source copy: Python | 109 passed, 14 source-dependent skips across core/POI/encounters/traversal/events |
| Clean source copy: Web | 160 passed, 6 local-dataset skips; npm ci/build/build:release/audit:release passed |
| Git index audit | 237 public source files; no proprietary/generated files, large binaries or credential hits |

Python sphere tests use the installed QGIS 4.2.2 runtime; no reconstruction
outputs or climate simulation are regenerated. Public synthetic tests cover
branches/operand bounds, constants, dynamic values, scheduled calls, cycles,
guards, partial placement, lighting-point rejection, raw battle IDs, trigger
binding, multiple field/scenario paths, surface height, deduplication and export
determinism. Local source integration tests explicitly skip without FF7 data.

Browser QA covers real field entrance, script trigger, model-14 placement,
vehicle event and terrain-27 entrance in **Globe, Equirectangular, Mercator,
Mollweide and Orthographic**. Marker endpoints use existing projection functions;
surface geometry identity remains unchanged, and selected/unselected trigger
colors are checked on the same buffer. Corrupt/hash-mismatched optional files
are rejected without replacing prior data. A missing file leaves locations,
encounters and geometry usable. Both **390px and 320px** touch QA cover filters,
marker tap, Inspector, advanced-detail collapse and no horizontal overflow.
Private screenshots were visually inspected and remain ignored.

Latest headless local sample: page ready 953 ms; Events resource transfer 2.2 ms
(not full validation time); terrain/events FPS 240/240; draw calls **3/3**.
Maximum allocated Event DOM markers: 177. These are sanity measurements on this
machine, not portable performance guarantees. No second surface mesh is added.
The production bundle is approximately 652 kB minified / 168 kB gzip. Vite's
650 kB chunk-size warning remains advisory; type checking, builds and release
audits pass. No limit was raised to hide the warning.

## Fingerprints and safety

Before/after size and SHA-256 checks match for all 22 protected files, including
seven MAP/BOT/LGP inputs, V1 math/projection modules and existing private Web
datasets. No original game file was changed. Core known fingerprints:

| File | Bytes before = after | SHA-256 before = after |
|---|---:|---|
| wm0.map | 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map | 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map | 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp | 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |

Payload/source SHA-256 stored in the private export:

| Source | SHA-256 |
|---|---|
| wm0.ev | a020dace94f21b73094c204c54b01e13b3688002f65ffd9b1edf8ada5e372a64 |
| field.tbl | e20da8b862cf5d3c64ce1fefb73463d930703ebd46e92af09b7edd3cb4b805cb |
| maplist | d6ac24b79403a77feeb338450b7cb2169cdbcfa5d071a6cee4884e93b700bc29 |

Public derived data included: **NO**. Proprietary original files tracked: **0**.
FF7 source modified: **NO**. All caches, profiles, generated JSON, snapshots,
test logs and screenshots stay under the workspace. Local commit identity is
the user's configured Zaxaerith identity. v1.4 is a **local release candidate**;
publication requires a separate explicit instruction. No v1.5 work was started.

Remaining unknowns: dynamic call/placement values; Gold Saucer entrance
linkage; runtime story/model/vehicle availability; live object positions;
scripted battle spatial anchors; current 2026 executable behavior equivalence.
The release candidate is a conservative static inventory, not an exhaustive
runtime world-event map.
