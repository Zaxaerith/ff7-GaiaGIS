# GaiaGIS v1.3.0 local validation

Validated 2026-10-03, Asia/Hong_Kong. Local release candidate with explicit
classic-PC-reference/runtime limitations. No remote upload, tag, PR, release,
metadata change or Pages deployment is part of this version.

## Baseline and preservation

Development stayed on local main, initially `674a9cd257382c9f50db77eac22a111fdca38252`
(v1.2). Read-only fetch confirmed origin/main
`5a90fbc0556c7a2d4a0abad410ea1e33bded0c20` (merged v1.1), local ahead one.
No reset, pull-overwrite, new branch or history rewrite occurred.

Source root: `D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition`.
Workspace: `D:\Project\FF7Gaia`. Core source hashes, three BOT hashes,
V1 Web mesh/meta, POI/encounter data, MAP reader, reconstruction and all projection
modules were measured before coding and after validation: **22 protected files,
all unchanged**. No geometry/GIS/POI rebuild or climate simulation ran.
**FF7 source modified: NO.**

| File | Bytes before = after | SHA-256 before = after |
|---|---:|---|
| wm0.map | 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map | 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map | 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp | 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |

All four match the supplied known-compatible fingerprints. WM2/WM3 are hashed
for preservation only, not integrated into traversal. Private detailed evidence
is ignored `output/v1_3/before.json` and `safety.json`.

## Static profiles and real source aggregates

Ten independently implemented movement profiles share one public JSON rule
profile. All 32 terrain codes have explicit normal-context results. These counts
assume script 0 and ordinary, non-bridge context; Highwind is a landing-initiation
diagnostic. A conditional grass/script-7 synthetic test also covers the distinct
exit destination gate; no such grass triangle occurred in this base WM0.

| Profile | Allowed | Blocked | Conditional | Unknown | Actual WM0 allowed | Actual WM0 conditional |
|---|---:|---:|---:|---:|---:|---:|
| On Foot | 17 | 15 | 0 | 0 | 24135 | 0 |
| Buggy | 17 | 15 | 0 | 0 | 23917 | 0 |
| Tiny Bronco 路 water | 3 | 29 | 0 | 0 | 15565 | 0 |
| Highwind Landing | 1 | 30 | 1 | 0 | 10596 | 48 |
| Chocobo 路 Yellow | 16 | 16 | 0 | 0 | 24103 | 0 |
| Chocobo 路 Green | 17 | 15 | 0 | 0 | 32249 | 0 |
| Chocobo 路 Blue | 19 | 13 | 0 | 0 | 39668 | 0 |
| Chocobo 路 Black | 22 | 10 | 0 | 0 | 54523 | 0 |
| Chocobo 路 Gold | 25 | 7 | 0 | 0 | 142260 | 0 |
| Submarine 路 WM0 surface | 4 | 28 | 0 | 0 | 87441 | 0 |

Actual source has 142,586 WM0 base triangles, 29 observed terrain codes. Terrain
15, 23, 31 have no base WM0 samples; all remain covered by synthetic rule tests.
Synthetic caps (9,792) have no source attributes and are classified Unknown.
No point coordinates or complete derived traversal map is publicly included.
The full 32-row matrix and model inventory are in [research](traversal-research.md).

Human uses the actual normal mask, including Back Entrance 30; it does not imply
that its field script is currently open. Buggy permits River Crossing but its
current-terrain departure mask is separate. Water Bronco permits codes 4/5/6,
not Sea/Beach; its displaced exit destination allows Riverside/Beach. Five
Chocobo types preserve distinct masks and named tint evidence. Submarine is
WM0 surface only, with Sub Pen departure initiation; no underwater data is loaded.
Highwind air travel is not a map layer: Grass initiates ordinary landing,
Northern Cave invokes script 9 and is Conditional. Completed landing remains
unknown without destination/candidate/runtime state.

No slope/normal rejection threshold is invented. Normal averaging is used for
Buggy rendering tilt in the reviewed caller. A verified reference Chocobo exit
sample constraint, |raw height difference| <200, has strict boundary tests;
it is not applied as a per-triangle slope filter. Surface cache/height history,
bridge override, model proximity/collision and displaced candidate checks are
explained rather than converted into false reachability. Current 2026 runtime
code equivalence remains **NOT VERIFIED**.

## Web and browser validation

Traversal color layer, ten-mode selector, four-state legend, selected-mode
Inspector, expandable comparison matrix, evidence/source and explicit runtime
limits are implemented. Foot/vehicle occupancy and Highwind landing scope are
separate. Encounter/Tracks and existing Locations/search/fly-to coexist.
No additional dataset/loader is needed; missing/corrupt optional encounters
cannot disable the embedded Traversal profiles or loaded geometry.

**403 traversal browser checks passed** in installed Chrome: actual Grass,
Forest, Mountain, Sea, River Crossing, Desert, Beach, Wutai Bridge and Northern
Cave samples; all five projections preserve color/source identity. Every mode's
colors and Inspector state were checked after each projection, along with
Python/TS 320-cell matrix agreement and identical geometry/position-buffer
objects. 390px and 320px touch cover selector, legend, triangle tap, comparison
matrix and no horizontal overflow. Desktop/mobile screenshots were visually
inspected and remain private under ignored output/.

QA exposed a prior flat-view selection ambiguity: source bridge surfaces and
underlying water/terrain can overlap at identical projected depth. Picking now
uses the later drawn face for numerical depth ties, preserving nearer surfaces
and visibility masking. Five focused tests verify tie ordering, actual depth,
roundoff, mask-candidate ordering and empty hits. No projection formula, geometry
or source height is changed. Vertical bridge side faces can have zero projected
area; they have no selectable 2D interior, so the real QA uses a nondegenerate
bridge deck. Ordinary bridge surface and exact source lineage pass all views.

The original **215 v1.2 browser checks** also pass from a private test-side copy
(with Vite HMR module URL capture); historical v1.2 QA artifacts are preserved.
Source-only preview loads the required two local files, uses traversal without
optional datasets, keeps independent local optional loaders, makes no game-data
GET or upload, and reports no page errors.

Final headless workstation sanity: ready 867 ms;
Terrain and Traversal 240/240 FPS;
3/3 total draw calls with identical
selection state. Direct color/profile switch 17.9–20.0 ms.
Playwright dropdown wall time 22–27 ms includes
DOM actions and Inspector refresh. These are environment-specific observations,
not performance promises. No per-mode mesh or geometry copy is made.

## Tests, build and distribution

**118 Python tests passed**: core35, POI17, encounters19, traversal22, sphere22,
Web exporter3. Only these selected suites ran; installed QGIS is used solely for
existing sphere/GIS regression. No climate suite or simulation was invoked.
**141 Web tests passed**: existing105, traversal31, picking5.
`npm run build`, `npm run build:release`, `npm run audit:release`: PASS.
The release artifact contains seven permitted app/notice files and zero game
assets or complete derived datasets. Version metadata is 1.3.0; no tag exists
for this local version. Third-party notices/own-code GPL boundaries are retained.

A fresh export of the staged source tree, with no private datasets, passed
`npm ci`, Web136 pass /5 real-data skips, both builds and release audit.
Python source-only traversal21 pass /1 skip, encounters18 pass /1 skip and
POI16 pass /1 skip. **225 public tracked files**: zero proprietary/complete
derived files, zero large binaries, zero detected credential/private-key patterns,
and no user-home paths. Code-only release has seven permitted files.
All private browser outputs/profiles, generated map/POI/encounter data and source
checkout remain ignored under this workspace. Remote CI is not run or claimed green because no upload is allowed.
The old v1.0 historical-audit script reports the already committed v1.1/v1.2
`web/public/data/README.md` update beyond its original allow-list. Git confirms
that file is unchanged from the v1.2 baseline; no missing historical files,
climate source changes or source hash differences were detected. This historical
README-only discrepancy is recorded, not treated as a failed v1.3 source gate.

## Remaining limits and stop

Runtime availability, complete movement/collision, boarding/exit success,
script/field access and current 2026 runtime equivalence remain unknown.
Unsupported model IDs and unresolved tint sentinel are not selectable profiles.
Bridge-history overrides are documented and tested through the explicit local
predicate, but the map shows ordinary static masks, without a current-player
state. No reachability, routing, vehicle inventory, story simulation, WM2,
full script VM or next-version feature is added.

**Public derived data included = NO.** FF7 originals, generated V1/POI/encounter
assets and private screenshots stay ignored. No gaia-traversal.json is created.
This is a v1.3.0 local release candidate within the documented static reference
scope, awaiting the user's explicit permission to upload.
