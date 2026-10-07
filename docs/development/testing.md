# Testing

Public Web regressions live in `web/tests/`. Run `npm --prefix web test`, ordinary build, `build:release` and `audit:release`. Tests cover coordinates/projections, routing/analysis, Atlas/navigation, user geometry and save parsing/privacy. Synthetic fixtures contain no private save bytes or complete derived game dataset.

Private Python `tests/` remain local, ignored and untracked. Run the owner-maintained non-climate runner in `output/dev/run-python-tests.py` when present, with workspace-local output and optional read-only source. QGIS/GDAL is needed for established CRS/export regressions. Sealed climate tests and retired climate candidate diagnostics are excluded; do not re-add private tests to Git.

Browser acceptance checks source-only and local workspace modes; Save Explorer, User Mapping, analysis, Atlas, Explorer, routing and map transitions; all thirteen projections, Globe, Compare, five locales, desktop and 390/320px containment. Verify source hashes before/after private-input tests. Browser profiles, screenshots, raw receipts and full logs belong in ignored `output/`.

Portable acceptance extracts a fresh ZIP, removes developer PATH/environment, verifies embedded runtime, Viewer integrity, licences, source/public-asset audit and loopback security. A local process-isolation smoke is not a claim of testing a fresh Windows VM. A release runner additionally repeats clean-checkout build and package smoke.

Historical numerical acceptance reports remain available through Git tags, commits and Releases. This document describes current test responsibilities rather than storing another version-specific validation report.
