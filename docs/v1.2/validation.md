# GaiaGIS v1.2.0 local validation

Validated 2026-10-03, Asia/Hong_Kong. Status: **local release candidate**, with
the classic-PC lookup compatibility limitation below. No push, remote PR, tag,
GitHub release, metadata update or Pages deployment occurred in this phase.

## Baseline and preservation

Fetched origin for read-only comparison before development. Local and remote
main both pointed to `5a90fbc0556c7a2d4a0abad410ea1e33bded0c20`, containing
merged v1.1. Only the user's untracked local workflow AGENTS.md existed; it was
preserved and included in this local version. Work is committed locally on main;
remote main and existing v1.0 release/tag are preserved.

FF7 input root: `D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition`.
All source accesses are read-only; project writes, cache, browser profiles,
screenshots and test outputs remain under `D:\Project\FF7Gaia`.
**FF7 source modified: NO.** The following four known fingerprints, plus all
three BOT files, have identical before/after sizes and hashes:

| File | Bytes before = after | SHA-256 before = after |
|---|---:|---|
| wm0.map | 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map | 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map | 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp | 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |

V1 Web mesh/meta, generated v1.1 POI, reconstruction.py and all projection .ts
files also have identical hashes. No geometry/export rebuild or climate tests
or simulations ran. Existing sphere regression recreates its empty temporary
GeoPackage fixture under output/, without changing canonical data.
Private detailed evidence: ignored `output/v1_2/before.json`, `safety.json`.

## Actual encounter dataset

One enc_w.bin in `ff7/workingdir/data/wm/world_us.lgp`; payload offset 3,025,949,
size **2,208 bytes**. Independent parser uses existing discovery/LGP infrastructure.
It reads 16 region groups, 64 sets, 50 active. Actual record counts:

| Group | Stored records, including zero weights | Positive-weight records |
|---|---:|---:|
| Normal | 384 | 160 |
| Back attack | 128 | 40 |
| Side attack | 64 | 7 |
| Both sides | 64 | 17 |
| Chocobo | 256 | 28 |

Eight Yuffie level records. 32 rating records: 28 valid ten-bit formation
identifiers and four 9999 sentinel entries. Positive weight alone does not imply
active/reachable/eligible. These counts include all sets, not only active sets.
No enemies or scripted bosses are inferred from formation IDs.

WM0 base: 142,586 source triangles; **837** carry the independent Chocobo bit.
Reference lookup resolves 141,460 triangles to active tables; only 21,942 also
pass script==0. 87,668 source region IDs are clamped; 119,785 terrain lookups use
unmatched fallback. These large counts include sea and inaccessible gameplay
terrain, demonstrating why lookup/table-active is not runtime battle availability.

Lookup clamps to region 0..15, aliases 16→0 and 24→8, takes the first ordered
terrain match and otherwise uses slot 0. Original terrain is retained for Yuffie
Forest/Jungle conditions. Two behavioral references support this classic PC
profile. Actual 2026 bytes confirm format; equivalent 2026 runtime lookup code
is **NOT YET VERIFIED**. The profile and limitation are explicit in JSON,
Inspector, README and [research](encounter-research.md).

Deterministic private `gaia-encounters.json`: **93,386 bytes**; source hashes bind
WM0, archive and payload. Repeated export is byte-identical. No projection math,
POI transformation or coordinate dataset is regenerated.

## Functional and browser checks

Encounter Zones and raw Encounter Rate reuse the current surface color attribute.
Chocobo Tracks highlights the source flag independently of optional tables.
Inspector exposes active/raw rate, source/effective region and terrain, fallback,
script gate, normal/special/Chocobo weights, numeric ratings, Yuffie metadata and
expandable lineage. Groups are collapsed and mobile Inspector scrolls within 44%
height. Existing location/search/fly-to Inspector remains operational.

**215 browser checks passed**, with no page errors, in actual installed Chrome:

- Grass, Forest, Jungle, Tracks, inactive set and another region in all five
  projections; actual canvas picks match exact canonical triangle index/lineage.
- Actual color-buffer values checked for Encounter, Rate and Tracks after each
  projection; all track-marked rendered faces verified against source flag.
- Geometry object and position buffer remain the same through layer switching.
- 390px and 320px touch: layers, legend, five-projection tap/Inspector, expandable
  groups and no horizontal overflow. Desktop/mobile screenshots visually reviewed.
- Absent/corrupt/source-mismatched encounters, unchanged two-file chooser,
  independent POI/encounter loading and preserved location selection.
- Source-only build makes no game-data GET or uploads; local file loading works.

Final workstation headless run: Viewer + data ready 851 ms; local encounter
chooser reload wall time 81 ms; Terrain and Encounter ~240 FPS; three total draw
calls. These are environment-specific sanity measurements, not isolated parser
benchmarks or performance promises. No new overlay geometry/draw calls.
Private QA: `output/v1_2/browser-qa/results.json` and ignored screenshots.

## Automated tests and builds

Python 3.14; installed QGIS 4.2.2 only for existing sphere/GIS regression.
**96 Python tests passed**: core35, POI17, encounter19, sphere22, Web exporter3.
Only these selected suites ran; climate suites were not invoked.
**105 Web tests passed**. New tests include synthetic binary bit packing,
offsets/counts, active-bit preservation, aliases/fallback/clamp, Yuffie level
bounds, Chocobo sentinel/first-match ratings, deterministic export/source binding,
optional loader/corrupt rejection and gameplay coloring. Existing projection,
POI/search/fly-to tests remain green.

`npm run build`, `npm run build:release`, `npm run audit:release`: PASS.
Release artifact has seven permitted application/notice files, zero derived files.

A fresh source-only copy of the staged tree, without private data, also passed:
`npm ci`; Web100 pass /5 real-data skips; both builds and release audit;
Python encounter18 pass /1 skip, POI16 pass /1 skip. CI configuration adds the
encounter synthetic suite, but no new remote workflow was run or claimed passed.

## Code-only audit and remaining limits

Tracked/staged file audit: zero proprietary or complete derived files, no large
binary, no detected GitHub token/private-key patterns. Generated data, screenshots,
cache and source-only test copy are ignored. GPL-3.0-only remains limited to
GaiaGIS original code; dependency notices are retained.
**Public derived data included = NO.** Existing v1.1 POI and all raw game assets
remain local. No data distribution permission is inferred from code licensing.

Runtime state, traversal/vehicles, exact probabilities, current 2026 executable
equivalence and modified-engine adapters remain unknown/out of scope. No scene.bin
enemy database, forced/scripted battles, WM2 or next-version features were added.
v1.2 is ready for the user's publication decision with these documented limits;
development stops here pending explicit permission to upload.
