# World encounter research — v1.2

Status: read-only format investigation, completed before implementation. No battle
simulation, executable patching, world-script UI or changes to V1 mathematics.

## Observed in the installed English Steam dataset

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

## External behavioral evidence

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

## Compatibility and unknowns

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
