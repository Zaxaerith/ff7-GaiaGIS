# 资料、许可证与证据来源

查阅日期：2026-10-02（Asia/Hong_Kong）。GitHub tree/原文的本地研究缓存位于
`docs/research/references/`，被 Git 忽略；不执行这些代码，不从中复制实现到核心模块。
commit 标识由 GitHub tree API 获取，记录于本地 `*-tree.json`。核心 Python reader 为独立实现。

| 参考 | 查阅内容 | 许可证处理 |
|---|---|---|
| [ff7-landscaper](https://github.com/maciej-trebacz/ff7-landscaper) | MAP、LZSS、useMaps、map-data、field.tbl、LGP、EV、worldscript、encw、mes、TEX | 查阅的 tree 无 LICENSE，API license 为空；仅作为格式/行为研究，不复用源码 |
| [ff7-worldmap](https://github.com/ergonomy-joe/ff7-worldmap) | 经典 PC 世界引擎静态反编译研究，重点 C_0074FFC0、C_0074C9A0、C_00760FB0、C_0075F090、C_007663E0、C_00766B70 | 无明确许可；不复用、不编译、不运行；其中反编译内容亦有原游戏版权因素 |
| [WorldMap Module wiki](https://wiki.ffrtt.ru/index.php/FF7/WorldMap_Module) | MAP/BOT、分块、walkmesh、region | 历史格式研究，存在勘误；未复制页面正文 |
| [World scripts wiki](https://wiki.ffrtt.ru/index.php/FF7/WorldMap_Module/Script) | EV call table、word instruction pointers、context | 原理参考，不开展完整反编译 |
| [ff7-terraform-cli](https://github.com/maciej-trebacz/ff7-terraform-cli) | 项目 tree、README/许可证与编译工具边界 | GPL-3.0；本轮不复用其代码 |
| [ff7-wm-scripts](https://github.com/maciej-trebacz/ff7-wm-scripts) | tree、潜艇 function0/function4 文本 | 无明确许可；仅研究，且这些文本属于游戏脚本派生研究，不纳入 Git |
| [ff7-lgp-explorer](https://github.com/maciej-trebacz/ff7-lgp-explorer) | LGP 格式规格及项目 tree | 无明确许可；自写只读 TOC reader |

## 交叉核对与勘误

- wiki 将 WM0 写成 68 blocks、5 replacements，但同一段列出 63..68 六个编号。
  实际本地长度 / 0xB800 = 69；六个 alternatives 全部可解码。
- wiki 旧 triangle bitfield 声明与 PC 行为不一致。Landscaper readMesh、引擎
  `C_00762162`/`C_00762191` 分别支持 region=(ids>>9)&31、chocobo=(ids>>15)&1。
  引擎 wTerrainInfo 合并 byte3 与 ids 高字节；因此 texture 位不参与 terrain 判断。
  ids bit14 本轮保留、不赋予语义；实际三张 base map 均未置位。
- MAP 不包含 section grid 宽高和 alternative replacement 编号。
  引擎 `D_00969B30/D_00969B34` 提供各 map 的 9x7、3x4、2x2 profile；
  `C_00750F3C` 提供 replacement 选择。这是外部解释证据，不是通过文件长度唯一推导。
- `useMaps` 的 rendering XYZ 为 (raw_x+offset_x, raw_y, raw_z+offset_z)*SCALE。
  GaiaGIS 不采用 SCALE=0.05，保留原始单位。game_north 仅是项目第二水平轴的名称。
- 独立 LZSS 使用零初始化 ring、初始写指针 4096-18、LSB flags、length=nibble+3。
  本轮所有实际 compressed records 在严格 decoded length 检查下通过。
- `field.tbl` 是 field-local 进入位置与替代位置，不是 world POI 坐标表。
  世界位置需要 EV 的 entity/mesh/script context 联合解析，后续不能直接用该表作点图层。

## 定位到引擎函数的研究证据

固定 commit permalink 见 `reference-manifest.json`。

- `C_00750134`/`C_00750202`：世界 36x28 chunk 与水平 wrap。
- `C_00750F3C`：WM2 global block row-2、column-3，再以 4/3 block ranges 调整，
  本地 block index=row*3+column；支持局部窗口水平 offset 候选。
- `C_007533AF`：WM2 BOT 初始化嵌入 global block cols3..5、rows2..5。
- `C_0074D6BB`/`C_0074D6F6`、`C_0074DB8C`：surface/undersea 状态变化、淡出淡入、
  map id 选择；WM2 初始化设置 runtime model y=-3000。
- `C_0075378A` + `C_00766417`：3000 参数用于恢复后避碰/水平移动，移动方向取车辆朝向；
  不能把这个参数误解释成通用 vertical datum offset。
- `C_00760E1D`：加载后按 triangle UV 平均值向内调整每个 UV 分量一单位。
  本轮解析器保留文件里的原始 UV，不修改 MAP 或内存 reader 的数据。

经典 PC 反编译代码不是 2026 Steam executable 的逐指令验证；格式 fingerprint 匹配
也不能证明运行时 adapter 的所有行为一致。WM2 runtime transform 和垂直基准仍需下一阶段验证。

## Field entrances: evidence before implementation

Status: researched against the installed Steam 2026 dataset on 2026-10-03.
Scope: WM0 base geometry only. V1 reconstruction and v1.0.0 remain unchanged.

### Observed format and source relationships

`world_us.lgp` contains `field.tbl` (1,536 bytes) and `wm0.ev` (28,672
bytes). FIELD.TBL consists of 64 pairs of 12-byte records. Each record
contains signed field-local X/Y, field triangle, field ID, facing byte and
three padding bytes. These coordinates describe the destination **inside
the field**, not the world entrance. The alternative record is selected
by the scenario bit. Its direction must not be presented as world heading.

The installed English `flevel.lgp` has a `maplist` entry of 25,218 bytes:
uint16 count (788), followed by 788 fixed 32-byte, NUL-terminated ASCII
names. Indexing these names with the actual FIELD.TBL field ID identifies
the target. For example, the observed table identities include `mds5_5`,
`elm`, `farm`, `ujunon1`, `cos_btm`, `nivl_3` and `snow`.

WM0 EV has a 0x400-byte call table, with an initial dummy record excluded,
followed by 16-bit code words. There are 142 active records after that
exclusion. The prior inventory's 143 count included the dummy. A type-2
header encodes mesh column + 36 × row and a low-nibble function ID.
The engine calls that function when a triangle's script is >= 3, using
**function ID = triangle script - 3**. This was cross-checked against
`C_00764142` and `C_00765F61` in the PC engine research.

Opcode 0x318 pops scenario, then FIELD.TBL entrance ID. Those two values
select the destination record. Thirty-eight mesh functions contain this
instruction in the installed data, with matching MAP trigger triangles.
Control-flow branches include story flags and current vehicle/entity
checks; collecting an entrance does not establish that it is currently
available. Calls in model/system functions may instead refer to moving
vehicles or scripted transitions and have no static MAP trigger.

### Reconstruction policy for this version

The exporter will decode instruction boundaries and follow reachable
branches, rather than search raw words for 0x318 (an immediate could have
that value). It will resolve only an ENTER_FIELD preceded in the same
basic block by constant table/scenario pushes. Other cases remain
unresolved. It will not execute the world VM or infer story state.

For each resolved mesh function, connect matching **base** triangles by
shared edges. Keep each component and scenario separately. Use the
largest nondegenerate trigger triangle's centroid as a guaranteed
interior navigation representative. This is a
`derived_from_entry_trigger` point, **not** a stored exact trigger center
or radius. Height is interpolated from that source triangle, and its
region comes from the same triangle. Retain every source triangle ID,
call-table index, instruction word offset, table record and scenario.
Alternative sections are not substituted into the frozen V1 base map.

Location groups are named explicitly from verified field identities;
friendly names/categories are editorial annotations with cited mapping
sources. Position extraction is independent of that table. The default
navigation target is a deterministic primary entrance. A spherical
centroid is also reported as a derived center, retaining all entrances.

Unknown world heading, trigger radius and runtime availability remain
null. FIELD.TBL local coordinates and facing are retained separately.
Gold Saucer, Northern Cave and other model/system-only transitions must
remain unresolved unless independently traced; no visual estimation is
permitted. WM2 and field rendering are outside this version.

### References and licensing

- [FIELD.TBL format](https://ff7-mods.github.io/ff7-flat-wiki/FF7/WorldMap_Module/FIELD.TBL.html)
- [World VM and call table](https://ff7-mods.github.io/ff7-flat-wiki/FF7/WorldMap_Module/Script.html)
- [Field identity list](https://ff7-mods.github.io/ff7-flat-wiki/FF7/Field/Field_ID.html)
- [PC engine research](https://github.com/ergonomy-joe/ff7-worldmap/blob/master/NEWFF7/C_00760FB0.cpp):
  C_00764142, C_00765F61, opcode 0x318; and C_00766B70.cpp's C_007670F9
  for paired FIELD.TBL indexing.
- [Landscaper](https://github.com/maciej-trebacz/ff7-landscaper): fieldtblfile.ts,
  evfile.ts and worldscript constants, used to cross-check interpretation.

These repositories were read as format/behavior references. Their source
is not copied into GaiaGIS and they are not runtime dependencies. This
document separates observed binary relationships from derived navigation
points and unknown runtime behavior. Raw inputs and generated coordinate
datasets stay local and ignored by Git.

## World encounter research

Status: read-only format investigation, completed before implementation. No battle
simulation, executable patching, world-script UI or changes to V1 mathematics.

### Observed in the installed English Steam dataset

Input: `ff7/workingdir/data/wm/world_us.lgp` under the user's installation.
The existing GaiaGIS LGP inventory found one `enc_w.bin`: TOC record 665,
archive record offset 3,025,925, payload offset 3,025,949, length **2,208**
(`0x8a0`). Payload SHA-256:
`650700f91facfe41a87fbcf8be438eb6955e2dba9e7a553c5c81a4fb6bf6cb9c`.
Archive and WM0 fingerprints match the previously validated dataset.
Private observations and before hashes are in ignored `output/v1_2/`.

Independent little-endian inspection confirms these sections:

| Offset | Length | Structure |
|---|---:|---|
| 0 | 32 | Eight pairs of uint16 Cloud level upper bound, formation ID |
| 32 | 128 | 32 pairs of uint16 formation ID, numeric Chocobo rating |
| 160 | 2048 | 16 regions × four 32-byte sets |

A set contains active byte (bit 0 is tested by the engine), raw rate byte,
six normal, two back attack, one side attack, one both-sides and four Chocobo
uint16 records, followed by two padding bytes. Record low ten bits are formation
ID; high six bits are weight. These are battle formation identifiers, **not**
an inferred enemy name or an index into a parsed scene.bin database.
All 64 sets are structurally present; 50 have active bit 0 set. Observed active
bytes are 0/1; rates are 0,12,20,32,64,96; padding is zero throughout.
The rating section includes four `9999` sentinel records: preserve raw entries,
but do not interpret them as valid ten-bit formation IDs. Duplicate level bounds
in the Yuffie section are real records, not parser errors.

### External behavioral evidence

Sources consulted as format/behavior references, without copying their code:

- [Flat Wiki encounter page](https://ff7-mods.github.io/ff7-flat-wiki/FF7/WorldMap_Module/Encounters)
- [ergonomy-joe engine investigation](https://github.com/ergonomy-joe/ff7-worldmap/blob/master/NEWFF7/C_00766B70.cpp),
  functions C_00767540, C_00767641 and C_00767C55..C_00767D2C;
  wm_data.h defines the 0x8a0 structure.
- [Landscaper encwfile.ts](https://github.com/maciej-trebacz/ff7-landscaper/blob/master/src/ff7/encwfile.ts),
  reference only; its editor/save functionality is never called.

The wiki's final description as a one-byte ID plus six-bit rate is incomplete:
uint16 low-ten/high-six extraction is supported by the actual records and engine
mask `0x3ff`. The wiki uses one-based region numbers; GaiaGIS uses zero-based IDs.

Classic PC engine lookup, independently transcribed as a small format table:
clamp region to 0..15; alias terrain 16→0 and 24→8; compare in order against
that region's four terrain codes, taking the first match; no match→slot 0.
Duplicate zero codes are intentional and never override the first match.
Sea or unsupported terrain therefore may select a table; that is **not** proof
that a player can walk there or that battles occur there. Vehicle access is out
of scope. Triangle script must be zero in the random movement check; gameplay
context distinguishes table-active from this static script gate.

The engine increases its danger accumulator by a term inversely proportional
to raw rate, with a special zero-rate path. Thus rate is not battles/minute or
battles/km²; a higher raw value does not imply more frequent encounters. Battle
selection compares cumulative **packed words** against random thresholds, with
special precedence, Materia modifiers, party checks and reroll of the previous
formation. We expose packed values and weights; no absolute probability is
reconstructed and no normalized weight is claimed to be an exact probability.

Yuffie is checked after a battle trigger and before Chocobo/special/normal:
region-specific 0..255 threshold against a byte random value; original terrain
must be 1 (Forest) or 25 (Jungle); save flag must allow Mystery Ninja. Choose the
first Cloud-level upper bound ≥ current level, otherwise final entry; mask ID
to ten bits and add one for Jungle. Threshold/256 is conditional on these gates,
not an absolute chance of battle. Save/party/level are not simulated in Viewer.

Chocobo requires the independent MAP tracks bit, a nonzero Lure-related runtime
parameter and walking player model. Its four records belong to the resolved
set; first matching rating record supplies numeric rating. Tracks, table records,
and current runtime eligibility are three different facts.

### Compatibility and unknowns

The 2026 input bytes verify the format. Searching the two installed EXEs did
**not** find the contiguous classic terrain/chance tables. Consequently current
2026 runtime machine-code equivalence is **NOT YET VERIFIED**. v1.2 labels lookup
as `classic-pc-reference`, supported by two independent behavioral references
and compatible actual data, not as a traced running-game result. No AppID or EXE
offset is used by the parser. Modified encounter binaries can be parsed without
known hashes; incompatible or custom engine lookup semantics require an adapter.

Unknown runtime inputs remain unknown: save/story flag, model, Materia/Lure,
party size, movement/danger/RNG state, last formation. Forced/scripted bosses
are excluded. No original binary or complete derived table is committed.

## Traversal research

Scope: WM0 static classic-PC terrain predicates, independently expressed in
GaiaGIS. Research was completed before implementing the UI. Current Steam 2026
runtime equivalence is **not verified**. No game executable is run or modified.

### Evidence and sources

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

### C_0074CECA input and complete branches

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

### Boarding, exit and Highwind landing are separate

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

### Geometry, slopes and edges

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

### Special terrain and 2026 limitations

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

### Model inventory

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

### Complete ordinary 32-terrain matrix

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

## World events: static spatial evidence

Research phase, 2026-10-03. Scope: WM0 surface, V1 geometry unchanged.
Final local validation: 2026-10-04.
No VM, save-state evaluation, moving-entity simulation or enemy database.

### Observed input

The installed English `world_us.lgp` contains a 28,672-byte `wm0.ev`.
The existing v1.1 decoder finds 142 non-dummy call-table records and 124
distinct code starts. Aliased code starts must not inflate opcode counts.
Instructions are word-addressed; inline operands must never count as opcodes.
Inventory counts reachable unique instruction offsets, separately from
function-context analysis. FIELD.TBL and flevel/maplist retain their v1.1 roles.

### Reference-derived semantics

- `C_00764D59`: GOTO and false branches operate on word offsets; RETURN
  restores a pending context. CALL_FN is opcode minus 0x204, with a popped
  model argument: below 64 selects that model; >=64 selects a system function.
  It starts a scheduled context, not an ordinary synchronous Python call.
  Static call edges can carry a *trigger cause*, not a runtime entity position.
- `C_00764F9C`: LOAD_MODEL selects an entity and may invoke its load function;
  SET_ENTITY selects by model ID. SET_MESH_POS replaces high coordinate bits;
  SET_LOCAL_POS replaces low 13 bits. World east/north = mesh * 8192 + local.
  A partial pair or dynamic entity cannot establish a placement.
- `C_00754EBC`, `C_00754EEF`, `C_00754F72`: SET_POINT / MESH / LOCAL select and
  place color/effect zones. These are not automatically gameplay triggers.
  Only an explicit use connecting a point to a spatial event can justify an
  event anchor. Color, camera, sound, progress and visual layers remain inventory.
- Arithmetic and comparisons can propagate literal values only. Memory reads
  stay symbolic/unknown; no stored save/temp values are evaluated. WAIT and
  scheduled calls invalidate active entity/position assumptions. Unsupported
  operations poison abstract values instead of preserving stale constants.
- ENTER_FIELD pops scenario then table ID. BATTLE retains the raw battle ID.
  A scripted battle remains independent of random encounters.

### Two investigation targets

Observed Gold Saucer model 14 load function (header 0x4e00) defines a complete
mesh/local placement. This establishes an object anchor; it does not establish
that a field transition happens at that anchor. Model-only entrances must not
borrow unrelated placement points. Destination/transition linkage remains to
be checked independently; no nearest-POI or visual matching is allowed.

Observed system function 9 tests a savemap word and calls model 3 function 30
(header 0x431e), whose reachable code has ENTER_FIELD table 59 scenario 0.
`C_0076667C` invokes system 9 when current terrain is 27. Thus terrain-27 base
triangles can anchor a **reference-derived landing event**, distinctly from a
MAP script-bit trigger. Script 9 here is a system function ID, not the triangle's
3-bit script value. Runtime descent/story/model conditions remain unevaluated.

### Conservative extraction policy

Reuse the v1.1 call-table / instruction decoding in a shared module; preserve
its existing entrance policy and outputs. Add bounded CFG and abstract literal
stack analysis, explicit call graph and guards. Traverse both unknown branches.
Do not propagate a guessed player/entity location through scheduled calls.
Keep trigger triangles/component lineage and representative interior centroids.
Constant placements receive a surface-interpolated height only when a real
containing base triangle exists; otherwise height stays null (display-only
marker elevation is explicitly separate). Moving objects use script-defined
placement labels, never current position. Every unresolved spatial candidate
is retained with a reason and word/call-table provenance.

### References and reuse boundary

- [Classic-PC script engine](https://github.com/ergonomy-joe/ff7-worldmap/blob/bc7576e68b118e776ccefecfbc982a702a7f9e0f/NEWFF7/C_00760FB0.cpp)
- [Vehicle/system-9 invocation](https://github.com/ergonomy-joe/ff7-worldmap/blob/bc7576e68b118e776ccefecfbc982a702a7f9e0f/NEWFF7/C_007663E0.cpp)
- [Effect-point semantics](https://github.com/ergonomy-joe/ff7-worldmap/blob/bc7576e68b118e776ccefecfbc982a702a7f9e0f/NEWFF7/C_00753860.cpp)
- [World script format](https://ff7-mods.github.io/ff7-flat-wiki/FF7/WorldMap_Module/Script.html)
- [Landscaper opcode reference](https://github.com/maciej-trebacz/ff7-landscaper/blob/3e2708441a8335f14e10fb52bd9af4a82a2a6921/src/ff7/worldscript/opcodes.ts)

Reference repositories have no inspected explicit license: behavior/format
reference only, no copied implementation and no runtime dependency.
Current 2026 executable equivalence is UNKNOWN / NOT VERIFIED.
Detailed local evidence remains in ignored output; historical reports are retained in Git history.

### Analyzer bounds and interpretation

Basic blocks validate all branch targets. A worklist handles GOTO,
GOTO_IF_FALSE, literal arithmetic/comparison and RETURN. Per-PC abstract joins
widen differing values, models and position pairs to unknown, so loops are not
enumerated as runtime iterations. Guards limit 12,000 states per function,
200,000 total instructions and call-graph traversal depth 16. Call cycles are
reported; neither CALL_FN nor LOAD_MODEL initialization executes a second VM.
All call-table contexts are inventoried, including system/model contexts that
have no MAP anchor. Unknown values and unsupported effects cannot become
fabricated coordinates. Branches and scheduled contexts describe possible
outcomes, not proof that an outcome occurs at runtime.

The final observed inventory has 118 distinct opcodes at 8,640 unique reachable
word offsets, 131 static call edges, 11,788 analyzed states and no guard hits or
detected call cycles. Historical opcode inventory (`v2.6.0:docs/v1.4/opcode-inventory.csv`)
includes neutral OP_ names where semantics are not needed for extraction.
This is bounded analysis, not a claim to cover every dynamic call or branch.

### Final target outcomes

Gold Saucer's model-14 load function has a constant mesh/local pair. It yields
one script-defined model placement with containing-triangle height
interpolation. It does not establish a field entrance or current position;
transition linkage remains unresolved. Dataset labels use neutral model IDs.

Northern Cave's system-9 path resolves FIELD.TBL entry 59, scenario 0 to
field 744, `las0_1`. Two terrain-27 components supply derived navigation anchors
under the independently documented engine gate. Neither is a literal field
trigger point, and savemap/vehicle/descent conditions remain unevaluated. This
adds World Events records without changing v1.1 POI coordinates or policy.

Twelve reachable BATTLE instruction sites preserve raw identifiers, but no
site has a reliable anchor under the current policy. They remain unresolved;
the viewer's battle category is verified using an explicitly synthetic fixture.
Effect-point definitions do not become fabricated gameplay markers. No WM2
or WM3 geometry, enemy identities, visual layer animation or save data is used.

## WM0 texture research

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

Animated surface sources use explicitly named frames. The texture generator chooses frame
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

## Multi-map research

The authoritative baseline is v1.7.0, commit
`c0513d60f00b1bfc09e041add85a5a488c0aa0f7`. Development remains local.

## Evidence policy

Observed source geometry takes precedence over reference descriptions. WM2Native
and WM3Native are independent spaces until a transform is established. Neither
receives WM0 inverse-Mercator coordinates, spherical caps or gameplay rules.
Raw height is not a physical elevation/depth measurement.

## Initial reference findings

Classic-PC `C_0074D6BB` and `C_0074D6F6` select surface/undersea main states,
start a fade and reset field-transition information. These functions alone do
not establish a coordinate transform. The dispatcher `C_0074DB8C` chooses map 2
for specified entry IDs or undersea state, and map 3 for the snowfield entry
range; it invokes `C_00766C7A` to restore placement. The placement/save code must
be followed before claiming a generic affine mapping.

References: [classic-PC world-map research](https://github.com/ergonomy-joe/ff7-worldmap),
[Landscaper](https://github.com/maciej-trebacz/ff7-landscaper).
References supply format/behavior evidence only; implementation is independent.
Steam 2026 executable runtime equivalence remains NOT VERIFIED.

The existing `analysis.topology` performs periodic modulo welding and therefore
must not be reused as a native WM2/WM3 topology conclusion. New diagnostics must
count exact native position edges first, compare both opposite boundaries, and
only then report supported periodicity. Existing MAP/LGP/TEX readers are reused.

## Status

Source inventory and native analysis are complete. No global WM2/WM3 mapping is
established. See the current coordinate-space contracts and retained historical evidence.

## Observed source geometry

| Map | Bytes | Sections/base/alternatives | Meshes/base | Triangles/base | Vertex/normal table records |
|---|---:|---|---|---:|---:|
| WM0 | 3250176 | 69 / 63 / 6 | 1104 / 1008 | 142586 | 88950 / 88950 |
| WM2 | 565248 | 12 / 12 / 0 | 192 / 192 | 9967 | 6307 / 6307 |
| WM3 | 188416 | 4 / 4 / 0 | 64 / 64 | 8268 | 5222 / 5222 |

Each section is 47104 bytes, each has 16 bounded compressed meshes, and all
mesh buffers decompress/parse without invalid references or trailing bytes.
Counts are computed from actual data; placement profiles are explicitly
cross-checked against 9×7, 3×4, 2×2 classic-PC section grids. Vertex records are
table sums, not globally unique vertices. WM0 alternatives are not inherited
by either native map.

| Map | Native X/Z extent | Raw height | Terrain IDs | Region IDs | Script IDs | Texture IDs |
|---|---|---|---|---|---|---|
| WM2 | 0..98304 / 0..131072 | -7943..3891 | 0,3,15 | 0,18 | 0,1,3 | 0..7 |
| WM3 | 0..65536 / 0..65536 | -7..1372 | 1,2,9 | 11 | 0,1,6,7 | 0..3 |

The names of terrain/region values retain gameplay meaning; raw numbers do not
establish ecological cover or a physical elevation datum.

## Exact native topology diagnostics

| Map | Edges | Incidence-1 boundaries | Incidence >2 | Duplicate face excess | Collapsed edges | XY keys with multiple heights |
|---|---:|---:|---:|---:|---:|---:|
| WM0 base | 214270 | 1030 | 124 | 84 | 0 | 108 |
| WM2 | 14848 | 182 | 73 | 127 | 2 | 364 |
| WM3 | 12530 | 256 | 0 | 0 | 0 | 0 |

These are exact `(X,Z,height)` incidence diagnostics, not repaired topological
adjacency. Multi-height XY support is not by itself proof of broken geometry;
vertical faces and overlapping layers remain source data. WM2 incidence
histogram is `{1:182,2:14593,3:22,4:14,5:18,6:4,8:6,9:6,65:3}`.
WM3 is `{1:256,2:12274}`. No modulo weld is used in these counts.

WM2 E/W has 16/16 segments, 4 exact position+height matches; N/S 12/12, 7 matches.
It is not geometrically periodic across its archive domain. Only matched
segments permit attribute comparisons: terrain/region/script/texture all match
on those 4 and 7; normals match 1 and 2 respectively; raw/wrapped UV match zero.
We do not fabricate a wrap or infer a complete globally connected sea floor.

WM3 E/W and N/S each have 64/64 exact segment matches. Position, height,
terrain, region, texture and normals match all 64 on each axis. E/W scripts
match 64; N/S scripts match 56. Raw UV and texture-local wrapped endpoint UV
match zero on each axis. Thus WM3 is **geometrically periodic**, with explicit
attribute discontinuities. The Viewer presents the bounded native rectangle
without automatically changing topology or making a polar inset.

## Texture observations

Classic wmfile supplies 8 WM2 and 4 WM3 resource definitions. Actual source
dimensions all match; all IDs/resources are used, none missing or unused.
WM2 dimensions: 128×128 (3), 128×256 (1), 256×256 (4). WM3: 64×64 (4).
All use one 16-entry BGRA palette, bit-depth header 4, stored byte per index.
All have reference alpha255, color-key false, no actual alpha<255 pixels.
Transparent native-source QA has no real case; shared decoder/picking synthetic
alpha cases remain tested. No native surface animation group/frame replacement
was identified in the resource catalogs; 8/4 fixed images are rendered. The
classic extra overworld animation-frame allocation is map0-only. Native
environment FX/fog/snow overlays are not surface textures and are out of scope.

WM3 ID2 `snwfldl` has reference offset disagreement: Landscaper says V32,
classic table says V64; actual MAP V spans64..124. Use V64. The reader/shader
subtracts the signed page offset then repeats within each texture, retaining
source UV seams and corner values. No unlicensed parser/material code copied.

## Cross-map evidence and uncertainties

See coordinate-spaces.md and transitions.md. WM2 has a **reference-derived
native-engine placement offset**, not a proven modern-runtime global CRS. WM3
has field/script linkage and independent coordinates; no WM0 affine mapping.
Neither map receives V1 longitude/latitude, spherical caps, meters, gameplay
rules, measurement or routing. Potential engine address wrapping is not equated
with matching MAP boundary geometry. Current executable equivalence, field
re-entry pairing, runtime placement and vertical datum remain unverified.

[WorldMap Module documentation](https://wiki.ffrtt.ru/index.php/FF7/WorldMap_Module)
was cross-checked for format/identity. Its historical WM0 section-count and
bit-field statements contain known discrepancies; actual bytes and independent
reader invariants remain authoritative.
