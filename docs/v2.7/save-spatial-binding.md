# Save coordinates and spatial authority

A raw world object is not automatically the player. Field saves retain world
records; parked vehicles also have records. GaiaGIS requires a valid slot,
world module 3, known map 0, and a matching current-model/object record before
offering any WM0 marker or action. Native maps 2 and 3 remain separate raw map
contexts with no established Gaia global transform.

## Evidence chain

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

## Frozen Gaia mapping

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

## Verification limits

WM0 packing/conversion is verified from cross-checked classic-PC format and
engine evidence, plus synthetic world-slot tests on actual local geometry.
The provided real saves are all field saves: a real world-module Steam 2013
save-to-live-player comparison is **NOT VERIFIED**. Alternate story-dependent
world geometry and Steam 2026 runtime equivalence are not claimed. Field,
unknown, corrupt and WM2/WM3 slots never produce a fabricated global marker.
