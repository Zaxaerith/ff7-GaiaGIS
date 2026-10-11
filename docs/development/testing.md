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

Both platforms always launch the actual frozen HTTP server with a small synthetic manifest/asset pair when private inputs are absent, checking status, manifest, compiled Viewer, payload checksums, Host/Origin denial and forbidden paths. This is labelled synthetic HTTP smoke, never real reconstruction acceptance. `--source` additionally runs a real cold build, warm geometry reuse and before/after fingerprints of required WM/Field plus present character/sound inputs. Original files are read-only.

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
