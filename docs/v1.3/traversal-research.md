# Traversal research — v1.3

Scope: WM0 static classic-PC terrain predicates, independently expressed in
GaiaGIS. Research was completed before implementing the UI. Current Steam 2026
runtime equivalence is **not verified**. No game executable is run or modified.

## Evidence and sources

Primary behavioral reference: [ergonomy-joe/ff7-worldmap](https://github.com/ergonomy-joe/ff7-worldmap),
especially `NEWFF7_C_0074C9A0.cpp`, `NEWFF7_C_007663E0.cpp`,
`NEWFF7_C_00760FB0.cpp`, `NEWFF7_C_0075AC80.cpp` and `NEWFF7_wm_data.h`.
This decompilation has no confirmed reuse license: reference only, no copied
implementation, compiled reference code, or runtime dependency.
The local reference tree is pinned to `bc7576e68b118e776ccefecfbc982a702a7f9e0f`;
Landscaper reference tree is `3e2708441a8335f14e10fb52bd9af4a82a2a6921`.

Independent identity cross-check: [Landscaper world opcodes](https://github.com/maciej-trebacz/ff7-landscaper/blob/3e2708441a8335f14e10fb52bd9af4a82a2a6921/src/ff7/worldscript/opcodes.ts)
(cached `src_ff7_worldscript_opcodes.ts`, Chocobo tint argument 0–4), and
[FF7 reverse-engineering Savemap](https://ff7-mods.github.io/ff7-flat-wiki/FF7/Savemap.html)
(Chocobo type record and riding model IDs). Decompilation RGB tint application
independently supports yellow/green/blue/black/gold ordering. These sources are
behavior/format evidence, not official statements about 2026 runtime.

Evidence classes: `verified_reference_logic` means verified against the cited
classic-PC reference branch, not against a running game;
`cross_checked_reference` applies to tint names;
`data_compatible` means present source fields can represent the inputs;
`script_dependent` describes a reference script path;
`runtime_unknown` applies to unobserved state. No missing rule is guessed from a
terrain name or wiki prose. Hypotheses remain outside the evaluator.

## C_0074CECA input and complete branches

`C_0074CC07` composes terrain info from triangle byte 3 and byte 11 shifted by
eight. Low five bits select the terrain mask bit, bits 5–7 are the script index.
Higher bits contain part of texture/location/flags; they are not mask selectors.
The script gate used by exit-state branches is **script != 7**, not script == 0
(the latter is the separate random encounter condition).

| Model | Normal terrain mask | Exit-state 2 destination mask / gate |
|---|---|---|
| Human 0/1/2 | 0x721B6F83 | Same as normal |
| Wild Chocobo 4 | 0x321B6F83 | Same mask, script != 7 |
| Owned Chocobo 19 | Tint mask below | Yellow mask, script != 7 |
| Highwind 3 | Air state >=0 allows all; descent permits terrain 0 | 0x021B6F83, script != 7 |
| Tiny Bronco 5, water state | 0x00000070 | 0x00020800, no script gate |
| Tiny Bronco 5, flying flag | Air state >=0 allows all; descent uses 0x70 | 0x70 |
| Buggy 6 | 0x331B6F13 | 0x021B6F83, script != 7 |
| Submarine 13 | 0x04048008 | 0x021B6F83, script != 7 |
| Unresolved model 8 | 0x04040008 | Same normal branch |
| Zolom model 100 | Terrain 7 only | Same normal branch |

For humans and both Chocobo branches, when the **current player terrain** is
13 or 14 and tested model equals current player model, mask 0x20006000 replaces
the usual mask. This is a previous/current surface context, not merely a property
of a destination bridge triangle. `C_00761735` returns player model;
`C_00761844`, `C_007618B7`, `C_0076192A` identify Chocobo IDs 4/19/41/42.
IDs 41/42 have no explicit branch in C_0074CECA. Its default success cannot safely
be interpreted as a supported player traversal profile.

`C_0074DB52` returns the tint index selecting `D_00969A40`:

| Tint | Cross-checked color | Mask |
|---:|---|---|
| 0 | Yellow | 0x321B6F83 |
| 1 | Green | 0x321B6F87 |
| 2 | Blue | 0x321B6FF3 |
| 3 | Black | 0x325B7FF7 |
| 4 | Gold | 0x375B7FFF |
| 5 | Unresolved zero/sentinel; not selectable | 0 |

## Boarding, exit and Highwind landing are separate

`C_00766B53` returns the leave state (0 idle, 1 requested, 2 exit candidate).
`C_007666FF` checks **current** terrain before requesting departure:
Chocobo 0x221B0F03, Buggy 0x221B0F83, water Bronco 0x70, Highwind terrain 0.
Submarine predicate returns true, but its input caller requires terrain 18
(Sub Pen); the combined surface exit initiation therefore requires 18.

`C_0076667C` separately invokes world script 9 at terrain 27, outside the ordinary
landing predicate. Northern Cave is therefore conditional/script-dependent for
the Highwind Landing layer, not ordinary grass landing. A grass triangle with
script 7 permits initiation but fails the exit-state destination gate; it is
reported conditional, not as a guaranteed completed landing. The landing layer
is a static initiation diagnostic; it does not claim that the plane can land
at the selected exact point.

`C_00766417` constructs a displaced candidate using heading: normally 300 raw
units, water Bronco/Submarine 800, flying branch 100 unless overridden.
`C_007667B2` advances states and accepts changed coordinates. Destination
terrain, script, model/candidate state and orientation are distinct from the
initiation mask. `C_00766574` boarding also needs model proximity and flags.
No triangle-alone Boolean proves boarding or full land↔water transition.

## Geometry, slopes and edges

`C_0074CC07` first tests a six-entry surface cache. Without a usable cached
triangle, ordinary models select a containing surface using height difference
from the previous surface; Highwind/Bronco/WM2 have different surface selection.
Compatibility is then applied to the selected surface. `C_00762A21` additionally
handles nearby model collisions with periodic position differences and previous
positions. This is not a static triangle adjacency reachability rule.

Further caller tracing in `NEWFF7_C_0074FFC0.cpp`, `C_00752D02`, found an explicit
**Chocobo exit-state 2 height gate**: each of five candidate surface samples in
an attempted group must pass compatibility and absolute height difference from
the model position must be **strictly less than 200 raw units**. Multiple groups
are attempted. This is a displaced-candidate condition, not a triangle slope
or ordinary riding threshold. A small raw-height diagnostic implements that
predicate; no candidate sampling/runtime state is inferred from one triangle.

No normal/slope threshold or fixed maximum landing elevation was found in the
reviewed compatibility, departure, candidate surface and ascent/descent paths.
`C_0074F916`'s flight height is not a landing slope/elevation cutoff. Therefore
no invented slope gate, normal transport extension or route graph is added.
The reviewed air-input branch also compares raw vertical position to 500 and
`D_00DF5420` when adjusting Highwind up/down motion, with a Northern Cave
exception. These are state/input-dependent air control conditions, not a static
landing-terrain altitude threshold; they are not converted to a map filter.
This bounded source review does not prove absence of constraints elsewhere.
Actual movement, surface overlap/cache, collision, displacement and height
history remain runtime-unknown.
`C_007537AE` averages stored vertex normals; the reviewed caller in
`C_0076328F` uses this to tilt the Buggy rendering model. It supplies no
compatibility rejection threshold in that path. Rendering tilt is not a
traversability test.

## Special terrain and 2026 limitations

All 32 codes are evaluated by mask bits, including Cliff, both Bridges,
Mountain Pass, Bridgehead, Northern Cave, Back Entrance and unused codes.
Human normal mask permits terrain 30. C_0074CECA does **not** establish a
script-controlled exception to that occupancy bit; whether its field entrance
is currently open remains unknown. It would be incorrect to change that bit
merely because its name is Back Entrance. Bridge movement has the context
override described above; no names are used as surrogate predicates.

Observed WM0 fields are data-compatible with these inputs; equivalence to the
2026 executable remains **UNKNOWN / NOT VERIFIED**. No new disassembler,
injection, runtime memory access or executable investigation is required.

## Model inventory

| ID | Interpretation / movement role | Evidence | Selectable |
|---|---|---|---|
| 0/1/2 | Cloud/Tifa/Cid human leader | Player-model mapping, common compatibility branch | On Foot |
| 3 | Highwind aircraft | Landing/ride control; Savemap cross-check | Landing only |
| 4 | Wild Chocobo | Chocobo predicates, fixed yellow mask | Represented by yellow normal mask; exit difference documented |
| 5 | Tiny Bronco, flying/water states | Ride/exit branches and model state | Water mode only |
| 6 | Buggy | Ride branch and animation branch | Yes |
| 8 | Unresolved sea-compatible entity | Explicit mask, identity unresolved | No |
| 9 | Highwind propeller attachment | Model inventory | No |
| 13 | Submarine | Surface/underwater branches; Savemap | WM0 surface only |
| 19 | Owned tinted Chocobo | Tint mask lookup, Savemap | Five types |
| 21/22/23 | Snow pole props | Collision exclusions / inventory | No |
| 27 | Wrecked submarine prop | Inventory | No |
| 41/42 | Chocobo-related entities, role unresolved | Chocobo predicates; default mask branch | No |
| 100 | Zolom swamp entity | Terrain 7 predicate | No |

Decision: ten public, small static profiles reuse terrain/script/lineage already
in the Web transport. **No gaia-traversal.json is necessary.** Existing geometry,
POI and encounters remain optional local generated data; no new derived map is
published. Original evaluator code expresses necessary behavior facts rather
than copying decompiled source. Four-state classification is scope-limited:
normal terrain profiles use allowed/blocked; conditional is used only for
documented landing/context exceptions, unknown for missing source information.

## Complete ordinary 32-terrain matrix

A=allowed, B=blocked, C=conditional, U=unknown. Script=0, ordinary non-bridge context. Highwind column is landing initiation, all other columns terrain occupancy. Each non-C cell has `verified_reference_logic` evidence; Northern Cave C has `script_dependent`. Missing WM0 source/caps use U; no runtime guarantee is implied.

| Code / terrain | Foot | Buggy | Bronco water | Highwind landing | Yellow | Green | Blue | Black | Gold | Sub surface |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 Grass | A | A | B | A | A | A | A | A | A | B |
| 1 Forest | A | A | B | B | A | A | A | A | A | B |
| 2 Mountain | B | B | B | B | B | A | B | A | A | B |
| 3 Sea | B | B | B | B | B | B | B | B | A | A |
| 4 River Crossing | B | A | A | B | B | B | A | A | A | B |
| 5 River | B | B | A | B | B | B | A | A | A | B |
| 6 Water | B | B | A | B | B | B | A | A | A | B |
| 7 Swamp | A | B | B | B | A | A | A | A | A | B |
| 8 Desert | A | A | B | B | A | A | A | A | A | B |
| 9 Wasteland | A | A | B | B | A | A | A | A | A | B |
| 10 Snow | A | A | B | B | A | A | A | A | A | B |
| 11 Riverside | A | A | B | B | A | A | A | A | A | B |
| 12 Cliff | B | B | B | B | B | B | B | A | A | B |
| 13 Corel Bridge | A | A | B | B | A | A | A | A | A | B |
| 14 Wutai Bridge | A | A | B | B | A | A | A | A | A | B |
| 15 Underwater Tunnel | B | B | B | B | B | B | B | B | B | A |
| 16 Hill Side | A | A | B | B | A | A | A | A | A | B |
| 17 Beach | A | A | B | B | A | A | A | A | A | B |
| 18 Sub Pen | B | B | B | B | B | B | B | B | B | A |
| 19 Canyon | A | A | B | B | A | A | A | A | A | B |
| 20 Mountain Pass | A | A | B | B | A | A | A | A | A | B |
| 21 Unknown | B | B | B | B | B | B | B | B | B | B |
| 22 Waterfall | B | B | B | B | B | B | B | A | A | B |
| 23 Unused | B | B | B | B | B | B | B | B | B | B |
| 24 Gold Saucer Desert | B | A | B | B | B | B | B | B | A | B |
| 25 Jungle | A | A | B | B | A | A | A | A | A | B |
| 26 Sea (2) | B | B | B | B | B | B | B | B | A | A |
| 27 Northern Cave | B | B | B | C | B | B | B | B | B | B |
| 28 Gold Saucer Desert Border | A | A | B | B | A | A | A | A | A | B |
| 29 Bridgehead | A | A | B | B | A | A | A | A | A | B |
| 30 Back Entrance | A | B | B | B | B | B | B | B | B | B |
| 31 Unused | B | B | B | B | B | B | B | B | B | B |
