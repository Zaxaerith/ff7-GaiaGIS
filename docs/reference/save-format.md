# Read-only FF7 PC save format

GaiaGIS accepts the classic PC container used by Steam 2013: exactly **65,109
bytes**, nine header bytes followed by **15 slots of 4,340 bytes**. The first
four header bytes are `71 73 27 06`. The remaining header bytes are not treated
as an edition signature. A compatible file cannot prove which executable last
wrote it. PSX/card wrappers, other sizes and signatures are rejected; Steam 2026
runtime equivalence remains NOT VERIFIED.

The independent reader is `web/src/data/save.ts`. File API reads are explicit,
browser-local and read-only. Parsed summaries live in one session owner; raw
bytes, filename and private path are not persisted. Reload or Clear forgets the
save. Failed replacement is atomic; a late import cannot undo Clear. No save is
uploaded, repaired, exported or written back, and no Steam Cloud files are used.

## Evidence

Cross-checks use the [Qhimm savemap](https://wiki.ffrtt.ru/index.php/FF7/Savemap),
[ff7tk](https://github.com/sithlord48/ff7tk/tree/cb876ba93f384b3a90a06ece216ccd1a160fbbcf)
(`FF7Save.cpp`, `FF7Save_Types.h`, `FF7SaveInfo.*`, `Type_FF7CHAR.h`), and the
[classic-PC world-map reference](https://github.com/ergonomy-joe/ff7-worldmap/tree/bc7576e68b118e776ccefecfbc982a702a7f9e0f).
These are consulted format/behavior sources, not incorporated implementations.
No wiki article, reference cache or decompiled source is distributed.

All offsets below are relative to a slot, little-endian. CRC-16 starts at
`FFFF`, uses polynomial `1021` over bytes 4–4339, and ends with XOR `FFFF`.
The low word at 0 stores the result; the upper word must be zero. This checksum
detects corruption; it does not authenticate a save. A wholly zero slot or a
zero body with checksum `4D1D` is empty; a CRC collision alone is not emptiness.

| Field | Offset / shape | Interpretation |
|---|---|---|
| Location preview | `0028`, 32 bytes | Terminated Western printable FF text only; unsupported glyphs Unknown |
| Character records | `0054 + 132 × ID` | Ordinary IDs 0–8; level +1, HP +2C, MP +30, max HP +38, max MP +3A |
| Current party | `04F8`, three bytes | FF means unused; out-of-range character records are not read |
| Gil | `0B7C`, uint32 | Authoritative value rather than preview copy |
| Play time | `0B80`, uint32 | Elapsed seconds; never used to infer story |
| Module / location | `0B94` / `0B96`, uint16 | Field module 1, world module 3; unknown module unavailable |
| Progress counter | `0BA4`, uint16 | Raw counter, no inferred chapter or availability |
| Recorded visibility masks | `0C22` / `0C23`, byte | Chocobo / vehicle world visibility, **not ownership/unlock flags** |
| Disc | `0EA4`, byte | Only 1–3 recognized |
| World objects | `0F5C`, six eight-byte records | Packed positions; see spatial binding document |
| Current model / map | `0FA1` / `0FA2`, byte | Cross-checked against world save/load code |

Invalid checksum, upper checksum word, unsupported module or impossible bounded
party data makes the slot unavailable. Other slots remain independently usable.
No unknown byte is assigned a story or vehicle meaning. Acquired vehicles,
breeding/stable Chocobo status, story flag-to-Atlas relations and runtime
availability remain Unknown/Unverified. The raw masks are labeled accordingly.

## Private real-save observations

Four owner-provided files were read, not copied into public fixtures. All four
match the supported header/length. Ten populated slots have valid CRCs; fifty
are empty. All ten populated slots are field-module saves. Browser import was
exercised on private samples; their checksums and source hashes are recorded only
under ignored local evidence. Synthetic public Web fixtures cover world slots,
malformed containers, empty slots, CRC mismatches, bounds and unsupported cases.

## Save coordinates and spatial authority

A raw world object is not automatically the player. Field saves retain world
records; parked vehicles also have records. GaiaGIS requires a valid slot,
world module 3, known map 0, and a matching current-model/object record before
offering any WM0 marker or action. Native maps 2 and 3 remain separate raw map
contexts with no established Gaia global transform.

### Evidence chain

Sources are the [pinned ff7tk reader](https://github.com/sithlord48/ff7tk/tree/cb876ba93f384b3a90a06ece216ccd1a160fbbcf),
[Qhimm world-map notes](https://wiki.ffrtt.ru/index.php/FF7/WorldMap_Module), and
[pinned classic-PC world-map save/load reference](https://github.com/ergonomy-joe/ff7-worldmap/tree/bc7576e68b118e776ccefecfbc982a702a7f9e0f).
This document records independently expressed behavior facts.

`C_007660DB` packs a world object's position; `C_0076616A` restores it into
the world position. The first word has X in bits 0–18, model in bits 19–23
and heading in bits 24–31. The second has horizontal Z in bits 0–17 and
height in bits 18–31. ff7tk independently masks the same horizontal fields
(its accessor names call horizontal Z “Y”). Height is shown raw; no guessed
height-to-geographic-altitude conversion is claimed.

`C_00766B70` writes model/map at addresses `DC0CD9`/`DC0CDA` relative to
save base `DBFD38`, giving offsets `FA1`/`FA2`; the object array begins at
`DC0C94`, giving `F5C`. `D_0096DE80` selects the six saved records. Recognized
model-to-record facts are:

| Current model | Record |
|---|---:|
| 0, 1, 2 | 0 |
| 4 | 1 |
| 5, 19 | 2 |
| 3, 6 | 3 |
| 13 | 4 |
| 10, 11, 29 | 5 |

The saved record's model must match the current model. Unknown mappings fail
closed. `C_0074D330` returns the native map ID used by save/load: 0 WM0,
2 WM2, 3 WM3. An unknown map ID is not coerced to WM0.

World movement wraps X at `0x48000` (294,912) and Z at `0x38000` (229,376).
World script cell coordinates use `>>13` and `&1FFF`: 8,192 source units per
cell, matching the existing MAP reader's 36-by-28 cell grid. `map_reader.position`
constructs horizontal X/Z with these cell offsets and retains source Y as
height. This verifies common axes, units and origin, rather than assuming that
unidentified save bytes are geographic coordinates.

### Frozen Gaia mapping

The App's GaiaGame convention is:

`game_east = X`, `game_north = 229376 − Z`.

The existing `sourceGeographic(X, Z, 0)` applies the frozen V1 mapping:
longitude derives from the centered X extent and latitude from the centered
inverted Z row through the existing inverse-Mercator reconstruction. Some
historical POI fields use a `game_north` label for the raw row; the save adapter
passes raw X/Z to the existing conversion and does not reinterpret that label.
No EPSG/WGS84 claim, new reconstruction formula or per-projection save copy is
introduced. The same position drives Globe and thirteen projections.

Fly uses that horizontal geographic position. Explore and Route additionally
require an **exact containing source triangle**, with barycentric containment,
not a guessed nearest centroid. Existing terrain/profile eligibility is still
checked. Route uses the containing existing graph node; solver weights and
movement rules remain unchanged. Unsupported placement fails visibly.

The UI labels save state separately from GaiaGIS preview state. Explorer may
use the recorded party leader and recognized current foot/vehicle model; this
does not prove a vehicle was unlocked or modify a save. Atlas receives optional
raw Save Context, with no story filtering or change to spoiler controls.

### Verification limits

WM0 packing/conversion is verified from cross-checked classic-PC format and
engine evidence, plus synthetic world-slot tests on actual local geometry.
The provided real saves are all field saves: a real world-module Steam 2013
save-to-live-player comparison is **NOT VERIFIED**. Alternate story-dependent
world geometry and Steam 2026 runtime equivalence are not claimed. Field,
unknown, corrupt and WM2/WM3 slots never produce a fabricated global marker.


## Field identity binding

The field-module word (1) at slot 0xB94 and location word at 0xB96 are the only
inputs to Current Field lookup. This is cross-checked against [ff7tk FF7Save.cpp](https://github.com/sithlord48/ff7tk/blob/cb876ba93f384b3a90a06ece216ccd1a160fbbcf/src/data/FF7Save.cpp)
and its [FF7Location module/location identities](https://github.com/sithlord48/ff7tk/blob/cb876ba93f384b3a90a06ece216ccd1a160fbbcf/src/data/FF7Location.h),
plus the [Qhimm Savemap](https://wiki.ffrtt.ru/index.php/FF7/Savemap).
The locally generated maplist is the internal archive identity authority, not the
save preview string. The reviewed classic-PC ordering is pinned by maplist SHA-256
in the Field exporter; unknown/modded orderings leave every saveId null.

References disagree on several internal names, including debug scenes and the
ordering of datiao_2/datiao_3. IDs 88, 89, 90, 91, 404, 526, 593, 594 and 699 are
therefore deliberately unverified for save lookup. Their own archive topology may
still be browsed. Missing/corrupt scenes also have no saveId. The compact pack
serializes only a reviewed equal-ID binding or null, not a copied reference name
table. No Field X/Y, local triangle, camera or world coordinate is derived here.

Only a valid/checksum-accepted field slot and an available exact saveId match can
open Current Field. Field saves never reuse stale world packing for a marker.
Unknown IDs remain raw. See [Field Context](atlas.md#field-context).
