# Field entrances: evidence before implementation

Status: researched against the installed Steam 2026 dataset on 2026-10-03.
Scope: WM0 base geometry only. V1 reconstruction and v1.0.0 remain unchanged.

## Observed format and source relationships

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

## Reconstruction policy for this version

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

## References and licensing

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
