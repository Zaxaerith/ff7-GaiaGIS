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

Browser acceptance checks source-only and local workspace modes; Save Explorer, User Mapping, analysis, Atlas, Explorer, routing and map transitions; all thirteen projections, Globe, Compare, five locales, desktop and 390/320px containment. Verify source hashes before/after private-input tests. QA profiles, screenshots, performance captures and logs use ignored `output/dev/current/`; remove task-owned temporary output on success. Keep unique RC evidence at its existing path while reports or acceptance depend on it, and do not create permanent per-version folders for new work. See [workspace hygiene](workspace-hygiene.md) for retention and migration rules.

Python QA harnesses use `with gaiagis.output_lifecycle.OutputRun('qa') as job:` and write artifacts only below `job.path`. Child processes inherit its workspace-local temporary environment. Successful exit removes only that run's temporary tree. A failure is moved to a unique `output/dev/failed-<kind>-<run-id>/run/` directory with a `run.json` record; legacy fixed-name failure directories are left untouched. Failures are never rotated automatically. `gaiagis clean-output` excludes archived failure evidence and marked fallback runs; inspect and remove an individual record only after its evidence has been reviewed. `gaiagis validate` applies the same lifecycle by default; `--keep-artifacts` explicitly retains a successful run.

Portable acceptance extracts a fresh ZIP into a unique current-job directory, removes developer PATH/environment, verifies embedded runtime, Viewer integrity, licences, source/public-asset audit and loopback security. Success deletes only the current extraction/temp tree; failure gets its own `failed-smoke-<run-id>` archive and is not cleared by a later smoke. A local process-isolation smoke is not a claim of testing a fresh Windows VM. A release runner additionally repeats clean-checkout build and package smoke, explicitly keeping upload artifacts.

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

V4.3 adds public synthetic Section-4/9 tests in `tools/tests/test_field_background.py` and Web v1/v2/state/pixel cases. Run `python -B -m unittest discover -s tools/tests -p test_field_background.py` under the workspace-local environment, alongside the existing non-Climate private suite. Check exact terminal variants versus arbitrary trailing bytes, zero-count Palette with PC16 versus invalid indexed references, page-authoritative depth versus unused tile depth, truncation, UV/Palette references, all 36 descriptor bytes, U8 source operands with nonzero unused following bytes, source byte +28 U8 blendType versus unused +29, inconsistent Group/mask and out-of-preview evidence, source offsets, indexed nibble order, PC16 words and transparency, scene limits and candidate validation. With unchanged compressed pixels/SHA256, tamper scene bounds/type/area, completeness status, page uniqueness/depth/length/offset, source-hash pairs and missing static payloads; every case must reject. Application input/layer budgets are unsupported, unverified negative dimensions are unknown, while confirmed span/reference faults remain invalid_source. Check the v2-only 96 MB total bound and unchanged v1 64 MB bound, owned audit path/schema and atomic failure preservation, candidate rejection before replacement, source mismatch, exception rollback with/without a previous Pack and concurrent-update preservation. Keep legacy Visual v1 generator fixtures and their record semantics separate.

Reaudit every archived Field before comparing coverage: Camera, Palette header, all four layers/tile counts, page depth, Group/mask and blend operands must be reported independently of drawable-base classification. The historical source audit was 520 accepted / 182 rejected among 702 Fields; it is a comparison reference, not a parser rule or an assumed current result. Distinguish an invalid source, unsupported rendering, absent static base and UNKNOWN. Real-source QA must check bytes/offsets/pixels/order/hashes, not only screenshots. Include `mds5_1`, `mds5_5`, `itown1b`, `elm`, `nivl_2`, `church`, `bugin1c` and distribution-selected complex/unsupported samples. Preserve `mds5_1` Group 4/2/3 bit-0 counts 8/9/7 and `elm` Group-1 eight-bit associations without rewriting the existing Interaction Pack.

The v4.3 full-source audit for flevel SHA256 `af695ccf7c681be222f5f716758160e39469ec02bc0af3dd6f20a5e9c2a34807` remeasured 702 archived Fields and 918 valid Cameras:

| Classification | v4.2 / Visual v1 | v4.3 / Visual v2 |
|---|---:|---:|
| Drawable static base | 520 | 695 |
| Complete applicable static base | 118 `static_base` | 401 `static_complete` |
| Drawable with omissions | 402 `partial` | 294 `static_partial` |
| Rejected source/format | 182 undifferentiated rejections | 7 `invalid_source` |
| No safely drawable base after valid structure | Not separately classified | 0 `unsupported` |
| Insufficient resource-format evidence | Not separately classified | 0 `unknown` |

The 175 newly drawable scenes are measured coverage, not guessed images. The two completeness columns are **not equivalent**: v1 counted conditional tiles among omissions; v2 `static_complete` concerns only the applicable unconditional base, while research selections retain their own unsupported counts. Zero resource-format `unknown` does not resolve runtime state, scrolling, blending, occlusion or Camera/background registration.

The seven retained rejections are `fship_4`, `blackbgb`, `las2_1` (non-exact Section-9 terminal data), `onna_4` (Palette declared/actual length mismatch), and `fr_e`, `lastmap`, `md_e1` (indexed Palette references outside the available count). Four scenes with original target X=10000 retain those raw descriptors as code-4 omissions and now have safe partial previews; the game's use of those coordinates remains unverified. `bugin1a` and `las4_2` retain byte +29 as unused rather than folding it into the U8 blend type.

`mds5_5` was rejected by the old exact-`END` requirement; its valid `ENDFINAL FANTASY7` variant now yields 383 supported base tiles from 474 raw tiles, 17 supported conditional tiles and 74 omitted blend tiles (`static_partial`). `itown1b` was rejected when 473 unused tile-depth operands disagreed with their valid 8-bit pages; page-authoritative decode now yields 1299 base tiles from 1791 raw tiles, 19 supported conditional tiles and 473 omitted conditional blend tiles. Its base is `static_complete`; those conditional blend combinations remain partial. Neither repair changes Walkmesh, LINE or Disjoint Trigger evidence.

The validated full v2 candidate is **86,084,554 bytes**, header **990,285 bytes**, maximum decoded scene **528,384 bytes**, generated in about **79 seconds** on this local environment. The old v1 Pack is **54,005,790 bytes**. The v2-only 96,000,000-byte ceiling covers the measured additional Fields, conditions and PC16 pixels; v1 stays at 64,000,000 and scene/Canvas limits stay at 8,000,000 bytes / 4,000,000 pixels. Header/File lazy reads and one decoded scene keep disk growth separate from browser texture memory. These measurements are source/runtime-specific, not generic parser rules or cross-machine timing thresholds.

State Explorer browser QA covers default unconditional state, explicit single Group/bit, base/conditional visibility, partial/empty counts, reset, source details and explicit Trigger preview across all five locales, desktop and 390/320px keyboard/touch layouts. Trigger selection alone must not activate a state. Verify Camera/Overlay independence, unchanged projection inputs, source-footprint viewport/picking, late decode discard, repeated import, Field/World navigation and retained shared-Inspector release. Record import/header/decompression/composition/state-switch/redraw/scene-switch/World-return separately; a state switch must reuse decoded pixels. Include a folder with the nested matching recovery pair: both native and folder-input paths must adopt only root products. Public `test_visual_workspace.py` also injects failed default-launch upgrades, later source/Manifest failures and source mismatch; a reusable old Visual retains its original codec entry rather than being deleted or relabelled.

Before the increment, fingerprint every existing Workspace asset, Interaction, GeoPackage/project and discoverable original WM/Field/character/audio input. After candidate generation and failure injection, verify only the Visual Pack and Manifest changed, the recovery pair is usable and all source/research hashes match. Never regenerate unrelated data to improve background coverage. New Viewer/old v4.2 Workspace and missing-v2 fallback must retain Walkmesh, Camera and existing static preview. Run ordinary/release Web build, public asset audit and Windows x64 frozen build/smoke as separate checks; no private imagery, Palette or full derived pack enters Git or packages.

References are format evidence, not copied engine code: Makou Reactor `src/core/field/BackgroundTilesIO.cpp` (`BackgroundTilesIOPC::readData`, `tilePC2Tile`) and `BackgroundTexturesIO.cpp` (`BackgroundTexturesIOPC::read`); LGP Explorer `src/fieldfile.ts` (`parseCameraSection`, `parseBackgroundSection`, `getTextureRGBA`); Fenrir `app/field/field-backgrounds.js`; FFNx `src/ff7/field/background.cpp`. The first two inform bounded layout/indexed transparency; Fenrir/FFNx also implement runtime scrolling, blending and visibility that this static preview does not. Upstream code is not imported or executed; proprietary scene captures/pixels never become public fixtures.


FieldLocal export tests use the existing private `test_poi.py` owner: exact CRS/Z/M and coordinate/raw4/Access preservation, iterative directed components, BFS slot/tie order, degenerate vertices, paired entrances, 3D/XY-only/disjoint Gateway cases, boundary arrivals, source mismatch, truncation, output authorization, no overwrite and failure cleanup. Run these in actual GDAL >= 3.9 Python, not by treating optional skips as acceptance.

For a private cross-language oracle, set `GAIA_FIELD_GIS_ORACLE` to a checkout-local JSON array of five scene records: each item has `name`, original Section-5 hex string `section5`, nullable `start`/`end`, and the Python `network` result. The existing Atlas test compares actual Web `WalkmeshNetwork` groups/labels, isolated IDs, BFS distances/parents/Access slots and paths to Python. No real scene bytes become tracked test fixtures.

QGIS acceptance distinguishes real PyQGIS provider load/query/classification/render, project save/reopen and `QgsVectorFileWriter` research-copy export followed by OGR verification from interactive desktop GUI acceptance. Use an isolated checkout-local QGIS profile and undefined Cartesian CRS; do not suppress its lack of geographic reference by assigning EPSG. Compare integer XYZ/raw4 with zero tolerance, raw Access/offsets and all Gateway candidate pairs. Manual GUI review and game runtime passability remain separate checks. Windows package validation excludes the optional exporter/GDAL runtime; the source archive includes its code.

## v4.4 integer compositing and layer research

Run the existing non-Climate suite plus `tools/tests/test_field_compositing.py`. Exhaustively check all 65,536 input byte pairs for each supported indexed Type 1/2 operation, RGB555 expansion, transparent sources, saturating/clamped boundaries and sequential overlap. Fractional Type 0/3 and PC16 blends must remain omitted. Keep legacy generator-3 support codes and pixel semantics separate from generator 4. Test source spans at zero/last-byte/exact-end/one-byte-overflow, negative/fractional/unsafe operands and both real Section-9 and 8 MB limits; Tile offsets below 52 and page offsets below 40 are rejected by both readers. Verify source-order storage, whole-span content deduplication, no partial overlaps or unreferenced bytes, status/bounds derivation and decoded hashes.

The full original archive still has 702 Fields and 647,531 raw Tiles (Layer 0/1/2/3: 342,792 / 290,712 / 7,062 / 6,965). Generator 4 retains all 695 drawable Fields and the same seven invalid sources. With the same unconditional-base completeness definition, classification changes from 401 complete / 294 partial to 617 complete / 78 partial. No source-format rejection was relaxed. Among the 638,667 descriptors in valid scenes, 620,310 have static-profile support, including 91,267 newly supported Layer-1 indexed blends; 13,886 carry raw-position research pixels (Layer 2: 7,062; Layer 3: 6,824), 4,463 still omit blending, and eight omit out-of-budget targets. Research pixels stay outside static-supported/completeness counts. Layer 0's unused blend operands are not counted as new blending.

Recheck all required scenes plus a real subtraction sample such as `trnad_1`. Independent QA uses a second raw Section-9 cursor, all 695 source-rectangle readbacks, a Python reference renderer that reads full source pages rather than the compact pool, Web RGBA SHA256, and actual browser ImageData SHA256. Keep private source bytes, RGBA goldens and screenshots ignored. Old generator-3 scenes and original pixel goldens must still pass; new opaque-only RGBA must match those old results. Test nontransparent black, transparent overlaps, Z/Sub order and stable source-footprint bounds; screenshots alone are insufficient.

For `hill`, raw Layer 2 has 160 conditional tiles: Group 1 / bit 0 and bit 1 each select 80. Default base-only Layer 2 must show zero. Raw Layer 3 has 67 tiles, of which 34 are base; base plus Group 2 / bit 1 selects 40. Layer/Experimental switches alone must never activate a conditional state. Verify both 32px states, individual layers, opaque-only rendering, research outlines, reset, explicit Trigger preview, all five languages and 320/390px keyboard/touch. Cached switches must add zero decompression streams and leave Camera/viewport/picking unchanged.

The full generator-4 pack measures 98,099,799 bytes, header 1,041,935 and largest decoded scene 762,856. Only this explicit profile permits 100 MB, compared with generator-3's unchanged 96 MB and v1's 64 MB; metadata/scene 8 MB and Canvas 4 MP limits remain. Before allowing the extra capacity, record the complete distribution and temporary integrity-hash ArrayBuffer cost, measure observable heap/backing storage, and reject old profiles borrowing the new limit. Preserve every earlier recovery pair when incrementing. Tests inject publication failures and verify matching rollback, source identity, concurrent-writer preservation and unrelated Workspace/GIS hashes.

Compare performance under the same Viewer, machine, viewport and operation sequence; identify that as a data-profile comparison rather than a historical Viewer benchmark. Record import/header I/O, cold decode+validation+base composition, cached state/layer changes, Canvas redraw, Field switch, World return and repeated import. Report natural GC, sample-count and native/GPU memory limits; do not force GC or treat short-term retained heap as proof of a leak. Ordinary/release Web builds, public-asset audit and native Windows frozen smoke remain separate gates.

## Accepted version and reproducible review

v3.9/v4.0/v4.1 have completed browser human acceptance. Preserve published history and use the exact-tag release process after publication approval. Stop an older Viewer server and close its page before rebuilding a checkout, because branch changes alone do not replace ignored compiled assets:

```powershell
. tools/build/environment.ps1
npm --prefix web run build:release
npm --prefix web run audit:release
npm --prefix web run preview:release
```

Open a fresh `http://127.0.0.1:5175/` page (use the port printed by Vite), confirm the current locally built version, and import the existing Workspace folder after its optional interaction increment. Review the plain-language Inspector, original lines, overlapping record choice, all candidates and UNKNOWN limits. No full Workspace or GIS regeneration is required. Technical checks do not perform human gameplay validation or authorize publication.


## Script evidence and registration gates

Synthetic Python tests cover the 19 BG/Palette widths, formal bounded-CFG
interfaces, literal/variable operands, BGPDH bank ambiguity, entry ownership,
unknown stops, source spans, resource binding and incremental rollback. The
independent `field_registration.rational_projection` uses exact fractions and
never calls the Web or Python production projection. Compare real source vertex
IDs across Cameras, including depth and screen/Canvas Y conventions; numerical
agreement is not screenshot alignment.

Web tests cover optional evidence codecs, tampered ranges/counts/operands,
source hashes, cancellation, all screen footprint candidates, strict bounded PNG
structure/decompression, explicit mapping, excluded points, residual statistics
and private export. Browser Lab checks use synthetic PNGs, the existing Field
Canvas/Inspector and the same player-flow runner. Exercise five locales at
1440/390/320px, empty/limited/rejected-background scenes, no automatic BGON state
change, delayed image/index completion, source/Camera replacement and World
return. Keep original frames and pixel/control-point oracles ignored.

Archive acceptance must actually index all 702 Fields and report statuses,
coverage and stops. Compare every retained raw instruction span and Section hash
with read-only input. Existing Visual pixels and 617 complete / 78 partial / 7
invalid classification are independent of the new script-index status. No new
blend formula is part of these tests. Final RC also requires non-Climate Python,
Web/Browser, public-asset audit and isolated Windows validation; record actual
skips and failures, not prior release numbers.

## Native GIS gates

`tools/tests/test_native_analysis.py` and `test_native_gis.py` use synthetic data, exact fractions and staged export failure injection. The maintained `tools/native_map_audit.py --source-dir YOUR_WM_DIRECTORY --workspace output/local-workspace --output output/dev/current/YOUR_TASK/source-oracle.json` independently reads original mesh records and Native v1, validating every corner, normal, padding, attribute and Fraction plane. Do not publish its private oracle. Set `GAIA_NATIVE_ORACLE` and `GAIA_BROWSER_WORKSPACE` for all-face Web regression. The existing browser runner includes Native GIS checks (focused scope `GAIA_BROWSER_SCOPE=native`) for five languages/1440/390/320px, raw values, filters, keyboard/touch, relief invariance and map release. Real SQLite/OGR and PyQGIS readback/render use disposable copies, recording raw-unit/Meter limitations separately from desktop human acceptance.
