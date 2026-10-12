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

Browser acceptance checks source-only and local workspace modes; Save Explorer, User Mapping, analysis, Atlas, Explorer, routing and map transitions; all thirteen projections, Globe, Compare, five locales, desktop and 390/320px containment. Verify source hashes before/after private-input tests. All QA profiles, screenshots, performance captures and logs use ignored `output/dev/current/`, then are removed on success. Retain only necessary failure evidence until the next successful check. Do not create permanent per-version output folders.

Python QA harnesses use `with gaiagis.output_lifecycle.OutputRun('qa') as job:` and write artifacts only below `job.path`. Child processes inherit its workspace-local temporary environment. Successful exit deletes the job tree; exceptions retain the current failed job. `gaiagis validate` applies the same lifecycle by default; `--keep-artifacts` is an explicit temporary retention override. Run `gaiagis clean-output` to preview remaining disposable data.

Portable acceptance extracts a fresh ZIP into a unique current-job directory, removes developer PATH/environment, verifies embedded runtime, Viewer integrity, licences, source/public-asset audit and loopback security. Success deletes the entire extraction/temp tree; failure moves it to `output/dev/failed-smoke/`, cleared after the next successful smoke. A local process-isolation smoke is not a claim of testing a fresh Windows VM. A release runner additionally repeats clean-checkout build and package smoke, explicitly keeping upload artifacts.

Windows checks always launch the actual frozen HTTP server with a small synthetic manifest/asset pair when private inputs are absent, checking status, manifest, compiled Viewer, payload checksums, Host/Origin denial and forbidden paths. This is labelled synthetic HTTP smoke, never real reconstruction acceptance. `--source` additionally runs a real cold build, warm geometry reuse and before/after fingerprints of required WM/Field plus present character/sound inputs. Original files are read-only.

Mac smoke restores ZIP permissions and confined framework links, overrides HOME/workspace/temp into the checkout, scrubs Python/dynamic-library environments and checks every bundled Mach-O's ARM64 slices, dependency paths and signatures. Windowed self-test writes an explicit workspace-local result file. Native ARM64 build, Tcl/Tk, frozen service, Finder chooser/browser/exit, moved app, real cold/warm data, quarantined download/Gatekeeper and target-device functions are distinct acceptance items. Local Windows implementation and workflow lint do not claim any unexecuted Mac/Actions result. [Commands](building.md).

Historical numerical acceptance reports remain available through Git tags, commits and Releases. This document describes current test responsibilities rather than storing another version-specific validation report.

## Repeatable player flows

With a built local Viewer running, use the existing Playwright dependency:

```powershell
. tools/build/environment.ps1
$env:GAIA_BROWSER_URL = "http://127.0.0.1:5173/"
$env:GAIA_CHROME_PATH = "C:/Program Files/Google/Chrome/Application/chrome.exe"
npm --prefix web run test:browser
```

The one player-flow suite exercises Atlas/Field, Explorer preview movement and model switching, routing/analysis, authored geometry editing/export/import, a synthetic multi-slot save, map/projection switching and compact touch layouts. It uses an isolated browser context and disposes profiles/downloads on exit. No original saves are fixtures. `GAIA_MEASURE_ONLY=1` runs the same loaded-UI and Save Inspector mutation measurements for a before/after comparison without changing application code. Actual model aesthetics, ground-contact fidelity, the native chooser on an ordinary user's desktop and a live Steam world-module save comparison require human acceptance. Synthetic player-binding success does not verify Steam runtime equivalence.

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
