# Optional world encounter GIS data

`gaia-encounters.json` is generated locally from a user's own read-only English
FF7 installation. It is ignored by Git and excluded from `build:release`.
It contains no new geometry and never changes V1 or v1.1 POI coordinates.

```powershell
python -B scripts/build_encounter_assets.py --source 'YOUR_FF7_INSTALLATION'
```

Default output: `web/public/data/gaia-encounters.json`. `--output` accepts another
path inside the workspace. Layout discovery and LGP access reuse the existing
read-only parser. Unknown hashes are not rejected by the binary parser; length
and structure are checked independently. There is no asset writer or game API.

## Schema version 1

| Field | Meaning / provenance |
|---|---|
| schema / version | `gaiagis-encounters` / `1` |
| reconstruction | `v1-geometric-gaia`; no latitude transform is performed |
| sources | SHA-256 of WM0, archive and exact enc_w.bin payload |
| source_record | Archive TOC index, payload offset and byte length |
| lookup_profile | `classic-pc-reference`; see research's compatibility caveat |
| runtime_equivalence | `not-verified-steam2026` |
| regions | 16 IDs, four ordered terrain codes and Yuffie random thresholds |
| terrain_aliases | Only 16→0 and 24→8; reference engine facts |
| encounter_sets | 64 referenced sets, IDs `region:slot`, active/raw/rate/offset |
| records | normal(6), back_attack(2), side_attack(1), both_sides(1), chocobo(4) |
| yuffie | Eight level upper bounds and masked/raw formation IDs with offsets |
| chocobo_ratings | All 32 raw entries; ten-bit-valid flag distinguishes sentinels |

Each record retains `scene_id`, `weight`, `packed`, `encounter_type`, and
payload-relative `byte_offset`. `scene_id` means the enc_w formation identifier;
no enemy database or scene.bin interpretation is included. Padding is preserved
as hex rather than silently discarded. `active` is the low bit of `active_raw`.
First matching rating record wins, mirroring the reference behavior.

The JSON has deterministic key ordering and no timestamps, machine paths or
random identifiers. Identical inputs produce byte-identical output. A triangle
references tables through its existing canonical region/terrain/script/Chocobo
attributes; 142,586 triangles do not repeat the tables. Synthetic polar faces
are unassigned and never inherit encounter or Chocobo attributes.

The frontend validates source fingerprints against loaded V1 WM0 metadata,
version, reconstruction, profile, region/slot order, lookup/aliases, record
counts, integer ranges, bit-packing, byte offsets and Yuffie bounds. This is
compatibility/integrity checking, not cryptographic authentication of an
untrusted JSON. A corrupt optional file leaves the last valid geometry,
locations and encounter dataset intact and reports the error. Archive/payload
hashes are recorded but the browser has only the WM0 fingerprint to compare.

## Viewer behavior

The original two-file geometry chooser remains intact. **Load Locations** and
**Load Encounters** are independent optional controls. Missing encounters show
`Encounter data unavailable`; Geometry, Terrain, Regions and Locations work.
Local development loads an optional JSON when present. The public source-only
build never fetches game-derived files; users select them locally with no upload.

- **Encounter Zones** colors active table + script 0, inactive table, or a
  nonzero script gate. These are static contexts, not a prediction of battle.
- **Encounter Rate** displays the raw 0..255 game divisor intensity. Its legend
  explicitly says this is not battles/time or area and higher is not faster.
- **Chocobo Tracks** independently highlights every real MAP tracks flag in
  yellow, including without an encounter file. It does not create POIs or infer
  tracks from battle records. Synthetic caps remain unmarked.
- The existing surface color attribute is updated; no overlay mesh or additional
  draw calls are created. Projection position buffers/formulas are untouched.
- Triangle Inspector includes source/effective terrain and region, table/slot,
  active/rate, script gate, weighted groups, Chocobo ratings, Mystery Ninja
  metadata and expandable offsets. Formation weights are not percentages.
- Groups are collapsed initially and mobile panels scroll within a bounded
  height. Location Inspector/search/fly-to remain unchanged; no nearest-location
  or nearest-color encounter inference is added.

Runtime movement, traversal/vehicle, party, Materia/Lure, story/save, RNG/danger
and previous battle state are not simulated. Forced/scripted battles are excluded.
The source flag, weighted Chocobo records and actual runtime eligibility are
displayed as separate facts. Numeric rating values are preserved without
editorial quality names. Mystery Ninja thresholds are conditional on an already
triggered encounter and its other gates. [Research](encounter-research.md).
