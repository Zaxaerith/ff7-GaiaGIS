# v1.5 local release-candidate validation

Development baseline: v1.4 main `029c14a102ac65845ec7e4d76df5854ac37b3002`.
Only local development/commit is authorized. No push, tag, release or Pages
deployment is performed. V1 mathematics, source geometry and climate research
remain frozen. Private evidence, screenshots and full datasets are under ignored
`output/v1_5/` and `web/public/data/`; they are not part of public delivery.

## Exact-source topology and static routing

Observed on the installed English Steam dataset, through the existing WM0 parser:

| Diagnostic | Count |
|---|---:|
| Source triangle nodes | 142586 |
| Undirected graph edges | 213301 |
| E/W periodic edges | 224 |
| Boundary edge keys excluded | 582 |
| Non-manifold edge keys excluded | 124 |
| Ambiguous/duplicate incidence-two edge keys excluded | 39 |
| Duplicate faces, retained as isolated source nodes | 168 |
| Synthetic cap nodes | 0 |

Adjacency uses exact source integer edge endpoints **including height**. Only
east is reduced modulo 294912. North stays cut; no Float32 matching, nearest
triangle inference, epsilon repair or N/S wrap is performed. Duplicate/ambiguous
incidences are excluded conservatively. These exclusions can disconnect genuine
gameplay passages; this is a documented limitation, not silent geometry repair.

| Ordinary movement profile | Components, conditional excluded |
|---|---:|
| On Foot | 183 |
| Buggy | 178 |
| Tiny Bronco water | 30 |
| Yellow Chocobo | 183 |
| Green Chocobo | 128 |
| Blue Chocobo | 154 |
| Black Chocobo | 82 |
| Gold Chocobo | 66 |
| Submarine WM0 surface | 7 |

Highwind Landing is excluded from routing. Bridge codes 13/14 and compatible
Back Entrance code 30 are conditional; inclusion is off by default. Unknown and
blocked triangles never pass. Rules inherit v1.3's classic-PC reference caveat;
2026 executable equivalence remains **NOT VERIFIED**.

Deterministic multi-source/multi-target Dijkstra considers all verified entrance
triangle references and returns the actual entrance IDs chosen. Weights use
great-circle distances between raw centroids transformed by existing Float64 V1
Mapping. Radius 6371008.8 m is an assumption. The result is a **reference-sphere
graph-corridor distance**, not current gameplay reachability, continuous surface
shortest path or travel time. Components include triangle count, reference area
and associated Location count. Worker caches keep queries off the render thread.

The optional `gaia-routing.bin` is **7971076 bytes**, SHA-256
`EB16D6E3C87FF70256A2D3B1A2D1F5746E2DF75BBB2599FCE2636658ED9A4631`.
Two independent exports are byte-identical. It stores source lineage/attributes,
CSR adjacency, area and weights, without copying complete triangle geometry.

Real UI routes include Chocobo Farm → Impaled Zolom (On Foot, 46 nodes,
3454.76 reference km), Chocobo Farm → Kalm (Buggy, 103 nodes, 8218.97 km), and
Bone Village → Chocobo Sage's House (Green Chocobo, 54 nodes, 3170.62 km).
Blue/Black/Gold routes and multi-entrance selection also pass. Midgar → Wutai
returns no static foot route. A real E/W source-edge diagnostic joins two nodes
at ±179.583333° with 18055.37 m weight; these are explicitly diagnostic source
triangles, not invented Location entrances.

No eligible pair of currently resolved Location entrances was found for Tiny
Bronco or Submarine surface. Real UI correctly returns no route; synthetic
compatible-edge solver tests cover both modes. No entrance coordinates were
invented to satisfy QA. Event routing and Fit Route remain optional/unimplemented.

## Internationalization and projections

Five locales: en, zh-CN, zh-TW, ja, ko. **377 unique stable translation keys**
have five complete columns and matching interpolation sets. URL overrides saved
preference, then browser languages, then English. Missing translated entries
fall back to English; unknown keys warn in development and remain safe in
production. Technical IDs and source provenance remain unchanged. Switching,
ARIA, persistence, URL override and cache eviction do not reload geometry.

All thirteen views pass finite-position, unchanged surface identity, marker
forward-coordinate, event/route coexistence and actual triangle-picking checks.
The original five formula files remain byte-identical. The eight additions are
Equal Earth, Winkel Tripel, Robinson, Natural Earth I, Sinusoidal, Gall–Peters,
Lambert Azimuthal Equal-Area and Azimuthal Equidistant. Independent PROJ fixtures,
D3 test-only oracles, equal-area Jacobians and AEQD radial-distance tests pass.
Robinson interpolation has an explicit 3e-4 normalized PROJ tolerance.

Equal Earth, Winkel Tripel, Robinson, Natural Earth I, LAEA and AEQD screenshots
were visually inspected. LAEA/AEQD intentionally omit the singular antipodal
neighborhood and conservatively hide long-edge triangles; small holes remain.
This is not exact curved-boundary clipping. Picking preserves source lineage;
changing projection only reprojects existing analysis and does not solve again.

Browser QA covers desktop and 390px/320px mobile layouts in English, Simplified
Chinese and Japanese, with no horizontal overflow. Traditional Chinese/Korean
switching and dictionary parity pass automatically. Analysis controls, reachable
lists/results, projection selector, language selector, legend and reduced-motion
handling are included. Private screenshots remain ignored.

## Tests, build and performance

| Check | Result |
|---|---|
| Non-climate Python regression | 166 passed, no errors/failures/skips |
| New Python routing tests | 18 synthetic tests, included above |
| Local Web tests | 259 passed across 13 files |
| Code-only snapshot Web tests | 252 passed, 7 real-data tests explicitly skipped |
| Code-only snapshot Python routing | 18 passed without generated assets |
| Locations browser regression | 179 passed |
| Encounters browser regression | 215 passed |
| Traversal browser regression | 403 passed |
| World Events browser regression | 201 passed |
| v1.5 browser QA | 210 passed, no browser errors |
| Final production Worker/13 morphs/five locales smoke | 21 passed, no errors or data requests/uploads |
| npm build / build:release / audit:release | Passed |

The public CI configuration now includes synthetic routing tests. No remote CI
is started or claimed here. Existing browser drivers were adjusted for localized
error summaries and Vite module URLs; source/picking assertions were preserved.

Representative headless Chrome observations: graph parse/Worker adoption around
115–128 ms; component/UI evaluation around 13–47 ms; route queries around
3–34 ms including Worker communication. Surface uses the same buffers across
all modes. Baseline 3 draw calls becomes 4 with the route line visible. Observed
globe FPS varies with concurrent QA/GPU load; one isolated run measured about
240 baseline / 222 route FPS, another 240 / 113; the final full run measured 240 / 240. These are sanity measurements,
not device-independent guarantees. Final full-run graph adoption is 127.5 ms,
component/UI evaluation 13.8–35.6 ms and route queries 5.1–28.1 ms. Final
production morph completion, including selector/automation overhead, measures
1115–1312 ms across thirteen transitions; reduced motion skips the animation.
Projection morph uses the existing animation and reduced-motion policy. The production JS size triggers Vite's advisory
chunk-size warning; no runtime framework/dependency was added to conceal it.

Both local and geometry-free snapshot release builds produce eight code/notices
files, including the routing Worker. The release audit reports source_only=true,
game_derived_files=0. Production-local dist may contain private local data;
**only dist-release is suitable for public delivery**. Its browser test loads
V1/POI/routing through local choosers, computes a route and sends no data requests
or uploads. Complete graph/source assets are never bundled.

## Source preservation and audit limits

Read-only input root:
`D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition`.
All project outputs are under `D:\Project\FF7Gaia`.

| Source | Bytes before = after | SHA-256 before = after |
|---|---:|---|
| wm0.map | 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map | 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map | 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp | 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |

All three BOT fingerprints also match. The current before/after manifest covers
22 protected records: seven FF7 files, frozen transport/GIS metadata/parser and
projection files. Twenty match; the only two expected changes are projection ID
union/registration, adding eight entries without modifying old formulas.
`check_web_source.py` independently confirms seven FF7 fingerprints and Stage 1
geographic/build-metadata preservation. No climate simulation is executed and
the climate source diff is empty.

The older v1.0 `check_web_release_safety.py` reports failure against its historic
V2.2 manifest because normal test runs and prior releases regenerated diagnostic reports and
updated status/readme documents. It reports no missing files, no FF7 hash change
and no climate-code changes. That old manifest was not rewritten to make it
pass; current v1.5 preservation checks and code-only release audits are the
applicable gates.

One early diagnostic launched Chrome after a relative workspace-environment
script path failed. Its automatically removed transient profile may have used
system temp. This does not affect the game hashes, but it was a workflow
isolation deviation. Subsequent QA uses absolute environment-script paths and
explicit workspace TEMP/TMP/profile locations. No project dataset, screenshot
or persistent cache was deliberately written outside the workspace.

Public delivery remains original code, schemas, docs and synthetic fixtures.
GPL-3.0-only applies to GaiaGIS original code; third-party notices remain intact.
The final index contains **264 tracked public files**. The audit finds zero
proprietary/generated assets, zero credential-pattern matches, zero absolute
private user paths and no files over 1 MB. `docs/screenshots/README.md` is only a
policy document; no private image is present. Root package, lock metadata and
Python project version are 1.5.0. The local main commit preserves the v1.4
ancestor; its final SHA is reported with delivery rather than embedded in its
own content. Working-tree cleanliness is checked after committing.
**Public derived data included = NO. FF7 source modified = NO.**
