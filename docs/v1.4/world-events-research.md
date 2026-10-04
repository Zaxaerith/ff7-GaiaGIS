# World events: static spatial evidence

Research phase, 2026-10-03. Scope: WM0 surface, V1 geometry unchanged.
Final local validation: 2026-10-04.
No VM, save-state evaluation, moving-entity simulation or enemy database.

## Observed input

The installed English `world_us.lgp` contains a 28,672-byte `wm0.ev`.
The existing v1.1 decoder finds 142 non-dummy call-table records and 124
distinct code starts. Aliased code starts must not inflate opcode counts.
Instructions are word-addressed; inline operands must never count as opcodes.
Inventory counts reachable unique instruction offsets, separately from
function-context analysis. FIELD.TBL and flevel/maplist retain their v1.1 roles.

## Reference-derived semantics

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

## Two investigation targets

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

## Conservative extraction policy

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

## References and reuse boundary

- [Classic-PC script engine](https://github.com/ergonomy-joe/ff7-worldmap/blob/bc7576e68b118e776ccefecfbc982a702a7f9e0f/NEWFF7/C_00760FB0.cpp)
- [Vehicle/system-9 invocation](https://github.com/ergonomy-joe/ff7-worldmap/blob/bc7576e68b118e776ccefecfbc982a702a7f9e0f/NEWFF7/C_007663E0.cpp)
- [Effect-point semantics](https://github.com/ergonomy-joe/ff7-worldmap/blob/bc7576e68b118e776ccefecfbc982a702a7f9e0f/NEWFF7/C_00753860.cpp)
- [World script format](https://ff7-mods.github.io/ff7-flat-wiki/FF7/WorldMap_Module/Script.html)
- [Landscaper opcode reference](https://github.com/maciej-trebacz/ff7-landscaper/blob/3e2708441a8335f14e10fb52bd9af4a82a2a6921/src/ff7/worldscript/opcodes.ts)

Reference repositories have no inspected explicit license: behavior/format
reference only, no copied implementation and no runtime dependency.
Current 2026 executable equivalence is UNKNOWN / NOT VERIFIED.
Final observed counts, target outcomes and unresolved reasons belong in validation.md.

## Analyzer bounds and interpretation

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
detected call cycles. [Complete opcode count inventory](opcode-inventory.csv)
includes neutral OP_ names where semantics are not needed for extraction.
This is bounded analysis, not a claim to cover every dynamic call or branch.

## Final target outcomes

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
