# GaiaGIS v1.6 local validation

Scope: Analysis & Adaptive Cartography on local main, based on published v1.5
`7c0f82b3e7807c59b07c027d79d88069e6362ac9`. No upload, tag, release or Pages
deployment is authorized for this version. V1 mapping, thirteen projection
formulas, source geometry, POIs, encounters, traversal rules, events and routing
topology are unchanged. Climate remains sealed; no simulation is run.

## Implemented analysis

- Auto/fixed/off adaptive graticule, optional dim minor lines, locale-aware major
  labels, antimeridian splitting and conservative projection clipping. Screen
  estimation is per projection and viewport; target 120 CSS px, retained inside
  60–190 px hysteresis. Candidates 90/60/45/30/20/15/10/5/2/1/0.5/0.25/0.1°.
- Reference-sphere great-circle distance and smaller-region spherical polygon
  area. Exact coordinates or surface/marker taps; undo, finish and clear. Results
  are stored independently of display projection; assumed radius 6371008.8 m.
- Numerical Jacobian/SVD scales, area factor, maximum angular deformation and
  Tissot ellipses. Equal-area checks, conformal Mercator checks and AEQD-center
  checks; unavailable metrics at 3D/singular/clipped points remain explicit.
- Temporary linked projection comparison, left/top navigation, independently
  adaptive B grid, reused B cameras/buffers and cleanup on close. Mobile stacks
  views vertically. Locations, routes and measurements remain linked.
- Four-class static occupancy/reachability comparison, nine independent route
  results with exact entrance/node/component provenance and at most three
  selected overlays. Existing Worker and graph are reused. No vehicle transfer
  or runtime/story simulation is inferred.
- Four accordion groups; English/简体中文/繁體中文/日本語/한국어 each have 440 unique
  translation keys with parity. No additional derived-data file is introduced.

## Validation evidence

Final checks:

| Check | Result |
| --- | --- |
| Python, v1.0–v1.5 non-climate regressions | 166 passed; 0 skipped, failures or errors |
| Web, real local dataset available | 313 passed across 14 files |
| Clean code-only source snapshot | 306 passed; 7 real-data tests explicitly skipped |
| v1.6 real/browser and code-only production checks | 233 passed; no browser errors |
| Existing POI / encounters / traversal / events / v1.5 browser regressions | 179 / 215 / 403 / 201 / 210 passed |
| Original direction, touch/zoom and geometry browser checks | 16 passed |
| `npm run build` | passed |
| `npm run build:release` / `npm run audit:release` | passed; 8 code/notice files, 0 derived data |
| Clean source build/release audit | passed with no game-derived files present |

The independent analytical suite adds 54 tests, including D3 spherical area and
forward-difference factor oracles, all thirteen display inversions, camera-aware
spacing, hysteresis, singular clipping, seam handling and locale labels.

Real-source browser QA covers all thirteen A views and all thirteen B choices;
measurement invariance, four reachability classes, nine-route core parity,
three-overlay limit, shared buffers and disposal. Desktop is 1440×1000;
390/320×844 mobile runs in en/zh-CN/ja include grid, measurement, distortion,
comparison, route controls and overflow checks. Five locales are switched live.
Code-only production QA loads files locally and verifies zero data fetch/upload.
Private evidence stays in ignored `output/v1_6/`; no screenshots are public.

Chrome 154 / ANGLE Intel UHD local representative snapshot: ready 1086 ms,
adaptive generation 5.9 ms, Tissot generation 0.5 ms, 1000 distance+area kernel
iterations 17.6 ms. Idle grid regeneration stays unchanged. Baseline draw calls
are 3; with measurement, Tissot and three routes the two comparison viewports
each use 8. Representative FPS is 221.5 baseline and 90.9 during comparison;
the separate rotating-Globe regression averages roughly 100 FPS. These are
scenario/device measurements, not benchmarks promising the same FPS elsewhere.
Comparison adds a renderer/display position buffer only while open and releases
it on close. Surface color changes do not create a second gameplay geometry.

The older direction QA initially failed because its English assertion ran under
the browser's default Chinese locale. Numerical north-up was correct. The driver
now explicitly selects English; five-language testing remains separate.
An exploratory globally set `VITE_GAIA_SOURCE_ONLY=true` unit-test run intentionally
disabled automatic optional fetches and conflicted with four development-fetch
mock tests. The applicable clean-source gate uses the actual CI commands with
no game-derived files, rather than that build-only flag on the unit-test process.

## Preservation and publication boundary

The before/after manifest compares 73 protected files: seven FF7 files, frozen
projection sources, core routing/traversal, V1 private data and climate code/
configuration. All 73 match. `check_web_source.py` separately verifies all seven
game fingerprints and original Stage 1 GIS/build metadata. Four core records:

| File | Bytes | Before and after SHA-256 |
| --- | ---: | --- |
| wm0.map | 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map | 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map | 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp | 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |

Production distribution is executable code and notices only. GPL-3.0-only
applies to original GaiaGIS code; third-party licenses remain retained.
The final public index has 281 files. Tracked-file auditing finds zero assets,
generated datasets, private user paths, credential patterns or files over 1 MB.
Version metadata is 1.6.0 in the Web package/lock and Python project. The final
local main commit SHA is returned with delivery rather than embedded in its own
content. The working tree is checked after committing. No remote mutation occurs.
**Public derived data included = NO. Proprietary FF7 assets = 0.
FF7 source modified = NO.** No textures/models, WM2/WM3 rendering or next version
work is included. CPU/GPU timings are local browser sanity evidence, not portable
performance guarantees. Numerical display picking is visualization precision;
canonical Stage 1 coordinates remain authoritative.
