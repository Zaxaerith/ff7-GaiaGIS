# GaiaGIS v2.6.0 local RC validation

Baseline: local main = origin/main
`eceeb41408657b274b372c3dda73afb06ab7ac62`, verified clean before development.
Local main RC only; no push, tag, Release, Pages or v2.7 work.

## Acceptance

| Requested item | Result |
|---|---|
| 1 UserFeature schema | GaiaUserState version 2; id/layerId/type/WM0 geometry/name/note/tags/style/timestamps; v0/v1 migration |
| 2 UserLayer | id/name/visible/opacity/order; default My Places |
| 3 Point/Line/Polygon | PASS; WM0 only, simple polygons |
| 4 Edit/delete/duplicate | PASS; touch/mouse vertex drag, insert/remove, whole move, confirmed delete, new duplicate identity |
| 5 Stored coordinates | wm0 / GaiaGame; game_east/game_north; one geometry independent of display |
| 6 Line distance | Minor great-circle arcs on unchanged R = 6,371,008.8 m |
| 7 Polygon area | Signed solid-angle triangle fan, absolute winding-independent result; perimeter great-circle sum |
| 8 Antimeridian | Canonical periodic storage, vector measurement, seam-split display lines/fills; no long screen bridges |
| 9 Layer controls | Create/rename/delete/reorder/visible/opacity; nonempty deletion confirms member count |
| 10 Search | Names/tags, local and public source-only cards |
| 11 Tours | Actual Point uses local user-feature identity; persisted Tour stop verified |
| 12 Nearby | Separate actual user Point group; no line/polygon centroid distances, no weak Atlas upgrade |
| 13 ShareState | Private geometry/note/layer/coordinate leakage = 0; strict public allowlist unchanged |
| 14 GaiaJSON | gaiagis-user-features version 1; explicitly NOT GeoJSON / NOT WGS84 |
| 15 Import/export | Explicit local roundtrip; append/rekey; finite/bounded/schema/simple-polygon validation; atomic rejection |
| 16 Storage | One existing key, 4 MiB UTF-8, 32 layers/500 features/20,000 vertices/512 per feature; corrupt/quota fallback |
| 17 Rendering | Three shared objects per viewport, dirty compilation/projection buffers, Globe shader mask; Compare shares compiled frame |
| 18 Performance | 500 features / 8,100 vertices; stationary geometry rebuilds 0; figures below |
| 19 Desktop | PASS; dual docks, Inspector, user/source overlap selection and exchange |
| 20 390px | PASS; touch Point, Line, Polygon, edit/delete/layers/Inspector/import/export; no horizontal overflow |
| 21 320px | PASS; same touch workflow and production source-only Inspector; no horizontal overflow |
| 22 Thirteen projections | PASS; stored geometry invariant, native source ownership unchanged |
| 23 Globe | PASS; placement/selection/back-face behavior, shared geometry |
| 24 Compare | PASS; shared compiled frame, both primary and B user picking/Inspector |
| 25 Web | 770 passed / 5 explicit optional skips, 28 files |
| 26 Browser | 525 / 525; breakdown below |
| 27 Five locales | PASS; en/zh-CN/zh-TW/ja/ko, 859 keys each; user text retained |
| 28 Proprietary assets added | 0 |
| 29 Public derived dataset added | NO |
| 30 FF7 source modified | NO; all 12 inspected hashes unchanged |
| 31 Local commit | Final local main HEAD, recorded in delivery report; commit author Zaxaerith |
| 32 Working tree | Clean after the RC commit |
| 33 v2.6 local RC | YES; awaits human acceptance, no publication |

## Executed checks

- Web: `npm --prefix web test`: **770 passed / 5 skipped**.
- `npm --prefix web run build`, `build:release`, `audit:release`: **PASS**.
- Public release artifact: source-only, **game-derived files = 0**, private paths = 0.
- Private `python -B scripts/test_application.py --source ...`: **304 passed**,
  actual read-only inputs enabled, **climate tests executed = 0**.
- Real local launcher warm reuse: fourteen workspace assets reused, manifest valid,
  auto connection and **2.6.0** status verified; observed ready **2.58 s**.
- Public source-only startup/card/search/import management remains graceful;
  drawing/Fly-to is disabled without the spatial viewer. Manual workspace and
  missing/corrupt optional Atlas workflows pass the retained regression checks.

| Browser suite | Pass |
|---|---:|
| User Mapping desktop / 390px / 320px / projections / public | 127 / 127 |
| User/source overlap, layer membership/deletion, Compare, gestures/Esc | 20 / 20 |
| Actual production local/public smoke | 21 / 21 |
| 500-feature performance/containment | 12 / 12 |
| v2.5 spatial analyses and nine-character Explorer locomotion | 114 / 114 |
| v2.4 shell, workspace, native modes and layout | 103 / 103 |
| v2.3 navigation, routing/playback, sharing, layers and scale | 70 / 70 |
| Atlas | 48 / 48 |
| Atlas fallback | 10 / 10 |
| **Total** | **525 / 525** |

No page/shader errors or automatic external requests were observed in the new
mapping and production suites. No test report, screenshot, browser profile,
exchange example containing private geometry, or FF7 workspace payload is tracked.
Private Python tests/QA remain local, ignored and untracked.

## Observed performance

Synthetic authored dataset: 100 Points, 350 twenty-vertex Lines, 50 twenty-vertex
Polygons; **500 features / 8,100 vertices**. Five compilation observations:
12.3, 9.4, 7.9, 8.3, 8.8 ms; median **8.8 ms**. Validating, persisting and updating
the UI took **41.5 ms**. State **632,096 bytes**, render buffers **651,600 bytes**;
three objects, 100 display points, 15,300 line vertices and 2,700 fill vertices.
Stationary frames retain the same geometries and rebuild count. User-only Nearby
indexes 100 actual Points; reported median query 0 ms at the browser timer's
resolution. These are local observations, not device-independent guarantees.

## Safety and provenance

The full historical **862-item** safety evidence is retained and reconciled with
the actual v2.6 baseline. Three historical source differences already exist in
baseline main (routing worker, Explorer controller/model); the launcher difference
in this task is exactly its 2.5.0→2.6.0 status string. No unexpected current-baseline
protected change exists. All **735 sealed config/CRS/research/output records** and
**12 FF7 inputs** retain their authority hashes. Frozen analysis, projection,
source data, reconstruction, climate and Explorer owners have no v2.6 diff.

The attempted reduction of the old audit scope was rejected by automatic approval
review; it was not executed. The replacement retains every historical row and
checks both historical raw hashes and current-baseline Git blobs. The four
historical differences are explicitly recorded, not suppressed.

New tracked additions and public artifact: private paths 0, proprietary files 0,
copied Wiki prose/images 0, public complete derived dataset NO. ShareState remains
public identities/registered layers only. External uploads 0, FF7 source modified NO.
All private evidence and temporary files are workspace-local under ignored
`output/v2_6`; raw/reconciled audits both remain available there.

## Limits and stop

WM0 overview drawing only; no native transform, CAD, holes/multipolygons, altitude,
cloud sync or GeoPackage export. Polygons must fit an open hemisphere. Display
tessellation is approximate and bounded; discontinuities/back-faces are clipped.
Storage is browser-origin local; export before closing if quota fallback is shown.
V1/reference-sphere and Steam-runtime assumptions remain unchanged. Climate stays
sealed. See [user features](user-features.md) and [GaiaJSON](gaiajson.md).

Commit locally, verify clean main and unchanged origin/main, then stop for human
acceptance. No publication or next-version work is authorized.
