# Testing

Public Web regressions live in `web/tests/`. Run `npm --prefix web test`, ordinary build, `build:release` and `audit:release`. Tests cover coordinates/projections, routing/analysis, Atlas/navigation, user geometry and save parsing/privacy. Synthetic fixtures contain no private save bytes or complete derived game dataset.

Field regressions extend the existing Atlas tests with bounded identity codecs,
direct entrance evidence, directed gateways/cycles, entry-rooted MAPJUMP and
instruction boundaries, conflicting native targets, ambiguous or missing parents,
reviewed save/header alias gates, provenance chains, private contextual precision
promotion and the unchanged no-global-coordinate Field policy. The optional
private Field/POI pair is checked only when an ignored local workspace exists;
CI uses the synthetic cases. Browser checks also replace POI/workspace inputs to
ensure stale scene cards, search entries and save bindings are invalidated.

Private Python `tests/` remain local, ignored and untracked. Select non-climate suites and use disposable workspace-local output, optionally with read-only source. QGIS/GDAL is needed for established CRS/export regressions. Sealed climate tests and retired climate candidate diagnostics are excluded; do not re-add private tests to Git. Disposable output is not a place to store the test runner itself.

For real-source acceptance, set `GAIAGIS_SOURCE_ROOT` to the supported original PC data before importing the test modules; `skipUnless` conditions are evaluated at import. Use the installed QGIS Python entry point for GDAL/PyQGIS, preserve the workspace-local TEMP/profile environment, and restore project `src`/`tests` paths if that entry point clears PYTHONPATH. In the v4.1 private suite, omitting this variable produces 30 skips: 27 source-gated cases (four also require old Stage-1 fixtures), plus three other old-fixture cases. Providing the read-only source restores 23 cases, leaving seven genuine fixture skips: four SphereDataset Stage-1 checks and three WebExport checks. Synthetic format, safety and network tests do not require this variable; missing GDAL/PyQGIS is not a passing GIS result. Record every skipped test ID/reason from the actual run rather than comparing totals alone.

Browser acceptance checks source-only and local workspace modes; Save Explorer, User Mapping, analysis, Atlas, Explorer, routing and map transitions; all thirteen projections, Globe, Compare, five locales, desktop and 390/320px containment. Verify source hashes before/after private-input tests. All QA profiles, screenshots, performance captures and logs use ignored `output/dev/current/`, then are removed on success. Retain only necessary failure evidence until the next successful check. Do not create permanent per-version output folders.

Python QA harnesses use `with gaiagis.output_lifecycle.OutputRun('qa') as job:` and write artifacts only below `job.path`. Child processes inherit its workspace-local temporary environment. Successful exit deletes the job tree; exceptions retain the current failed job. `gaiagis validate` applies the same lifecycle by default; `--keep-artifacts` is an explicit temporary retention override. Run `gaiagis clean-output` to preview remaining disposable data.

Portable acceptance extracts a fresh ZIP into a unique current-job directory, removes developer PATH/environment, verifies embedded runtime, Viewer integrity, licences, source/public-asset audit and loopback security. Success deletes the entire extraction/temp tree; failure moves it to `output/dev/failed-smoke/`, cleared after the next successful smoke. A local process-isolation smoke is not a claim of testing a fresh Windows VM. A release runner additionally repeats clean-checkout build and package smoke, explicitly keeping upload artifacts.

Windows checks always launch the actual frozen HTTP server with a small synthetic manifest/asset pair when private inputs are absent, checking status, manifest, compiled Viewer, payload checksums, Host/Origin denial and forbidden paths. This is labelled synthetic HTTP smoke, never real reconstruction acceptance. `--source` additionally runs a real cold build, warm geometry reuse and before/after fingerprints of required WM/Field plus present character/sound inputs. Original files are read-only.

Maintained acceptance targets are Web and Windows x64. Retained Mac extraction/Mach-O/signature code is historical compatibility code; CI/Release no longer exercise it and current versions make no native Mac/Gatekeeper claim. Local workflow checks and package smoke do not establish cloud Actions success. [Build commands](building.md).

Historical numerical acceptance reports remain available through Git tags, commits and Releases. This document describes current test responsibilities rather than storing another version-specific validation report.

Interaction regression uses the same Section-1 decoder and synthetic operand/entry/branch cases, the exact Section-8 sentinel and both lengths, SLINE literal/bank separation, geometry classification and the optional pack's bounded/hash/source validation. The source CLI must leave unrelated Workspace files and existing research GeoPackages unchanged. Original-source counts are regression expectations gated by the matching source hash, never generic parser rules.

The existing browser owner runs also exercise the optional pack during repeated imports and BFS → selected Trigger → World exit. Retired interaction header/geometry references must be collectible alongside old Shell/Viewer/Canvas owners; retained shared-Inspector buttons are not a scene cache. Interaction-specific checks use the ordinary Web folder importer (automatic-local discovery disabled), all five locales, desktop/390/320px, keyboard/touch and overlapping line choice. They preserve all candidates, compare camera projection against current original visual bounds, distinguish modifications/dynamic operands and discard a delayed interaction scene after a switch. Missing interaction data in a v4 Workspace retains ordinary Walkmesh. Run the complete player suite normally, or focus a local check with `GAIA_BROWSER_SCOPE=interaction`; use `GAIA_BROWSER_SCOPE=owners` for owner/cache/document release. Both need `GAIA_BROWSER_URL` and `GAIA_BROWSER_WORKSPACE`; `GAIA_CHROME_PATH` can select an installed Chrome instead of downloading a browser. Temporary profiles remain beneath the project through `tools/build/environment.ps1`.

FieldLocal default/explicit v1 still has eleven original tables. Explicit v2 has nineteen with separately strict table/field validation. Extend the existing private FieldGIS test owner: Pack/header/span/hash/source/record bounds, duplicate IDs/memberships, full exact/XY contacts, dynamic operands without geometry, state-bit masks, control/modification evidence, no-overwrite and changed-input atomic cleanup. Validate the original five files through read-only SQLite/OGR, and use byte copies for any PyQGIS comparison: opening an editable provider may update GeoPackage caches/metadata even without feature edits. Fingerprint originals before and after. Check a fresh v1 and new v2 samples using actual GDAL and PyQGIS. Compare complete attributes/XYZ/raw4/Access, all memberships/candidates, SQL joins and BFS, not only row counts. Record selected decompression, geometry work, export/readback, output bytes and PyQGIS load separately; repeat same-process timings without claiming cache optimization. Runtime activation and complete background behavior remain UNKNOWN. Set `GAIA_FIELD_GIS_ORACLE` to an ignored five-scene Section-5/Python-network oracle for the existing cross-language labels/reach/path check, and `GAIA_FIELD_NAV_WORKSPACE` to the private Workspace for real WM0 entry validation; leaving these unset is a skip, not acceptance.

PyQGIS checks load every spatial layer/table, query/filter, classify symbols, save/reopen private projects and edit/re-read a disposable research copy. Keep the two optional research projects and new v2 GeoPackages; remove QA copies/logs on success. Desktop GUI acceptance is a separate human task. Check filtered records as well as provider counts: the installed QGIS may report -1 on multi-layer filtered COUNT even for unchanged v1. Preserve/report that environment limitation; never convert it into a passing count or change CRS to hide PROJ warnings.

## Repeatable player flows

With a built local Viewer running, use the existing Playwright dependency:

```powershell
. tools/build/environment.ps1
$env:GAIA_BROWSER_URL = "http://127.0.0.1:5173/"
$env:GAIA_CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe"
npm --prefix web run test:browser
```

The one player-flow suite exercises Atlas/Field, Explorer preview movement and model switching, routing/analysis, authored geometry editing/export/import, a synthetic multi-slot save, map/projection switching and compact touch layouts. It uses an isolated browser context and disposes profiles/downloads on exit. No original saves are fixtures. `GAIA_MEASURE_ONLY=1` runs the same loaded-UI and Save Inspector mutation measurements for a before/after comparison without changing application code. Actual model aesthetics, ground-contact fidelity, the native chooser on an ordinary user's desktop and a live Steam world-module save comparison require human acceptance. Synthetic player-binding success does not verify Steam runtime equivalence. v3.9 and v4.0 have subsequently completed human acceptance. v4.1 browser human acceptance is also complete; this does not validate original-game runtime behavior.

Repeat timings under the same Viewer build, browser, viewport, Workspace and cache conditions. Report initial boot/import, cold scene/visual decode, warm scene reopening, algorithm/geometry work and complete UI interaction separately. Repeat several times and report individual samples or range; historical timings are references rather than cross-machine thresholds. Inspect observer/capture/listener cleanup over repeated navigation and data replacement, and distinguish cached JS heap from total process memory. A single GC comparison cannot prove absence or presence of a leak.

With `GAIA_BROWSER_WORKSPACE` set, the player-flow suite also checks three fresh contexts, eight folder reimports each, four identical warm Field/background/network cycles, owner disposal and navigation to an empty document. Old Shell/World/Field Canvas references are weak; the single Explorer panel must remain connected and usable across imports. Memory measurements use scoped CDP file-input handles and return values, avoiding automation-held old DOM nodes; unconsumed `waitForSelector` handles and Playwright's file-input retarget handles can otherwise pin entire old shells. For a suspected regression, inspect actual retaining paths in a private ignored heap snapshot, separating debugger handles, session caches and application owners. No application GC calls, forced WebGL context loss or private snapshots are shipped.

Set `GAIA_BROWSER_SCOPE=owners` to repeat just these lifecycle checks against the same local Viewer and existing Workspace. Clear that variable for the full suite. `GAIA_STABILITY_MEASURE=1` adds three cold/warm interaction timing runs; `GAIA_MEASURE_ONLY=1` limits that invocation to measurements. Disposal counters use the same GC observation conditions as active/cached stages, including after navigation away from the Viewer; an uncollected discarded document is not a live application owner.

Multiscale UI acceptance follows real actions, not only DOM existence: WM0 Midgar → validated `mds5_5` entrance/Triangle 16 → BFS 85/87 → World; `mds5_1` Gateway 0/candidates 115,116 → `mds5_3` Arrival 40 → Back; and separate `farm` starts 10/79, each 184/191. Verify the saved map/projection/camera/Zoom/Compare/layers, 32-step session bound, identity-only MAPJUMP, self-relations, pseudo-world targets and missing/mismatched/late resources. Field-local selections must not offer active World routing or metre measurement. Exercise panel folding/focus across redraw and locale change; all five languages need desktop/390px/320px, keyboard and touch coverage. UI grouping preserves existing control IDs and spatial semantics.

Real private checks also retain `mds5_1` 163 triangles, `bugin1c` 496/no non-invalid Gateway, `nivl_b1` variable Raw Z and `itown1b` component evidence. Use all existing optional fixture gates honestly: an absent legacy Stage-1 fixture is **skipped**, not passed. QGIS/GDAL tests need an actual supporting runtime; missing `osgeo` is not acceptance.

Field anchor regressions extend the same Atlas/Field owner with synthetic
boundary, winding, degenerate, vertical and extreme-coordinate cases, damaged
record rejection, old-context fallback and target-only arrival placement.
`GAIA_TEST_WORKSPACE` optionally redirects private Web tests to an isolated
checkout-local generated workspace. For the audited source hashes, the regression
baseline is 128 records / 65 entrances / 63 placeholders, 1036 source lines,
978 arrivals (14 boundary), 58 world targets, and 801/225/10 source relations.
These counts are source-specific test evidence, never generator constants.
The player-flow suite checks marker picking, paired scenarios, navigation,
geometry warnings and ordinary Field lifecycle/mobile/public regressions.

Static network cases use the same test owners: exact WCC/SCC sets, raw-slot BFS
paths/depths, one-way chains, cycles/self-links, equal-depth choices, blocked and
invalid IDs, geometry mismatch evidence and a 65535-node iterative chain.
Optional private scenes are cross-checked with independent all-pairs directed
reachability and undirected closure, without hardcoding component counts.
Browser flows verify entrance/arrival starts, all 3D Gateway candidates,
XY-only exclusion, UNKNOWN states, cache reuse and source/mode cleanup. Algorithm
time, geometry association time and full UI interaction time are separate.


Camera/background tests extend the existing Atlas, private Field and player-flow owners. Use malformed section lengths, palette/texture references, truncated data and bounded inflate-stream tests as well as real source counts. Compare the camera formula independently and record rectangle inclusion counts for `mds5_1` (all three cameras), `bugin1c` and `nivl_b1`. Background reconstruction and visual/runtime correspondence are separate claims. Browser acceptance checks shared transforms, Plan restoration, five locales/compact layouts, late scene/source results and resource disposal. Neither inverse-matrix residual nor agreement between two projection implementations measures game-screen alignment.

References are format evidence, not copied engine code: Makou Reactor `src/core/field/BackgroundTilesIO.cpp` (`BackgroundTilesIOPC::readData`, `tilePC2Tile`) and `BackgroundTexturesIO.cpp` (`BackgroundTexturesIOPC::read`); LGP Explorer `src/fieldfile.ts` (`parseCameraSection`, `parseBackgroundSection`, `getTextureRGBA`); Fenrir `app/field/field-backgrounds.js`; FFNx `src/ff7/field/background.cpp`. The first two inform bounded layout/indexed transparency; Fenrir/FFNx also implement runtime scrolling, blending and visibility that this static preview does not. Upstream code is not imported or executed; proprietary scene captures/pixels never become public fixtures.


FieldLocal export tests use the existing private `test_poi.py` owner: exact CRS/Z/M and coordinate/raw4/Access preservation, iterative directed components, BFS slot/tie order, degenerate vertices, paired entrances, 3D/XY-only/disjoint Gateway cases, boundary arrivals, source mismatch, truncation, output authorization, no overwrite and failure cleanup. Run these in actual GDAL >= 3.9 Python, not by treating optional skips as acceptance.

For a private cross-language oracle, set `GAIA_FIELD_GIS_ORACLE` to a checkout-local JSON array of five scene records: each item has `name`, original Section-5 hex string `section5`, nullable `start`/`end`, and the Python `network` result. The existing Atlas test compares actual Web `WalkmeshNetwork` groups/labels, isolated IDs, BFS distances/parents/Access slots and paths to Python. No real scene bytes become tracked test fixtures.

QGIS acceptance distinguishes real PyQGIS provider load/query/classification/render, project save/reopen and `QgsVectorFileWriter` research-copy export followed by OGR verification from interactive desktop GUI acceptance. Use an isolated checkout-local QGIS profile and undefined Cartesian CRS; do not suppress its lack of geographic reference by assigning EPSG. Compare integer XYZ/raw4 with zero tolerance, raw Access/offsets and all Gateway candidate pairs. Manual GUI review and game runtime passability remain separate checks. Windows package validation excludes the optional exporter/GDAL runtime; the source archive includes its code.

## Accepted version and reproducible review

v3.9/v4.0/v4.1 have completed browser human acceptance. Preserve published history and use the exact-tag release process after publication approval. Stop an older Viewer server and close its page before rebuilding a checkout, because branch changes alone do not replace ignored compiled assets:

```powershell
. tools/build/environment.ps1
npm --prefix web run build:release
npm --prefix web run audit:release
npm --prefix web run preview:release
```

Open a fresh `http://127.0.0.1:5175/` page (use the port printed by Vite), confirm the current locally built version, and import the existing Workspace folder after its optional interaction increment. Review the plain-language Inspector, original lines, overlapping record choice, all candidates and UNKNOWN limits. No full Workspace or GIS regeneration is required. Technical checks do not perform human gameplay validation or authorize publication.
