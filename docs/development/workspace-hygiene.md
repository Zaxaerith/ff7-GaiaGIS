# Development workspace hygiene

This policy keeps reusable tooling and tests in one maintained source tree, one active QA workspace, and only the evidence needed to reproduce accepted decisions. It is local-development guidance; the audit command never removes files.

## Directory roles

- `tools/` contains maintained repository tools. Extend an existing module before adding another command. Tests for safe, synthetic behavior live with the existing `tools/tests` and `web/tests` suites.
- `output/dev/current/` is the active QA workspace. Do not create `v45/`, `v46/`, or other version-specific implementation directories for new work. Put temporary run output in a task-scoped directory and keep the tool implementation in `tools/` or the existing test tree.
- `output/dev/current/audit-tests/` is the ignored scratch root used by `web/tests/release-audit.test.ts`. The suite creates it and removes its case subdirectories; an empty parent can remain after the run.
- `output/dev/` may retain accepted historical QA evidence when reports, review snapshots, scripts, or commands still refer to those paths. Do not move an evidence tree until every relative and absolute reference has a verified migration plan, hashes have been compared, and the old launch/reproduction route still works. Keep one authoritative copy rather than making a second version archive tree.
- `output/local-workspace/`, its Manifest and Packs, and `.build/visual-recovery/` pairs are user research data. Do not include them in cleanup targets. In this checkout, the active recovery pairs are under `output/local-workspace/.build/visual-recovery/`.
- `output/exports/`, `qgis/`, and other user GIS/QGIS projects and datasets are preserved user data. Never infer that an ignored file is disposable.
- `output/distribution/` contains formal or candidate binaries and their checksums. Preserve them. Local package tests must not substitute their ZIP for the official Actions artifact.
- `.cache/` contains re-creatable but potentially expensive environments and package caches. Retain caches needed by an active RC; prune only individually identified files after checking consumers and active processes.
- `tests/`, `local_data/`, and generated geometry/coordinates may contain private source fixtures. Keep them ignored and never place original FF7 assets, complete derived datasets, or private QA files in a public package.

## Evidence and temporary files

1. Keep RC reports, independent pixel/source oracles, protection snapshots, accepted screenshots, recovery pairs, and other evidence that cannot be reconstructed from the public checkout.
2. One-off scripts that created an accepted result may stay beside that result as frozen historical evidence. Do not run report writers or destructive cleanup scripts again just because they are present.
3. Store reusable logic once in maintained tools or tests. Prefer explicit root, profile, scope, and output arguments. A private input path or user-specific browser/QGIS profile belongs in local configuration, not tracked source.
4. Before removing a generated file, verify its exact path, hash or reproducibility, consumers, and whether it is the sole record of a validation. Remove only explicit entries from an audited list; do not use `git clean`, broad `output`/`.build`/`.cache` recursion, or wildcard cleanup.
5. Avoid duplicate stdout logs when the same bytes already exist in a structured result. Preserve logs when they contain distinct diagnostics.
6. For a new large ignored file, record its source, reason, whether it can be regenerated, and a review/retention point in the task report.
7. At task close, keep only the active run state and unique evidence. Do not automatically delete unknown files or user-saved material.

## Read-only audit

From the repository root, run:

```powershell
python -B tools/workspace_audit.py --root .
```

The JSON report lists file/directory counts and bytes by scope, the largest files, tracked/untracked/ignored counts, version-named directories below `output/dev/current`, exact duplicate and highly similar scripts between those directories, and large files for human review. `--large-mib` changes the reporting threshold. The command follows no symlinks or junctions, does not write a report file, and has no cleanup operation.

An ignored-file count is a review signal, not a deletion decision. The tool deliberately does not inspect private file contents or decide that data is safe to remove.

## Evidence retention for the October 2026 hygiene pass

The v4.3 and pending v4.4 records remain in their existing locations because their reports and review snapshots use those paths. In particular, v4.4 `before.json` protects v4.3 files, the v4.4 report points to `verify_all.py` and `serve_web.py`, and the v4.3 report and validation commands use its original subtree. The v4.4 RC remains pending human acceptance. Do not move either evidence set until a separate migration can preserve those references and verify the old QA entry points.

The v4.3 and v4.4 scripts are private ignored evidence, not reusable public tools. They were reviewed individually:

| Script(s) | Classification | Decision |
| --- | --- | --- |
| v4.4 `summarize.py` | One-time evidence generator | Compares the v4.3 and v4.4 audit schemas and writes `audit-summary.json`; preserve with the report inputs. |
| v4.4 `final_evidence.py` | One-time evidence generator | Binds local package/source provenance and the protected-output snapshot; preserve, do not rerun after the report is finalized. |
| v4.3 `finalize_evidence.py` | One-time evidence generator | Stabilizes the v4.3 final protected-output snapshot and report byte accounting; preserve its result with the v4.3 report. |
| v4.4 `verify_contracts.py` | Unique historical verification | Checks the active Visual Pack against the named v4.3 recovery pair and proves unrelated resources stayed unchanged; preserve with `contract-protection.json`. |
| v4.4 `cleanup.py`, v4.3 `cleanup_qa.py` | Frozen, narrowly scoped cleanup records | Both use the existing `gaiagis.clean_output` safety helpers. They already ran against explicit lists; do not rerun as general cleanup tools. |
| v4.4 `write_report.py` | One-time evidence generator | Contains the finalized report text and writes the RC report; preserve and do not rerun. |
| v4.4 `serve_web.py`, v4.3 `serve_web.py` | Historical launch wrappers | Both delegate to maintained `gaiagis.local.make_server`; their workspace/web-root settings and report paths differ. Keep the old entrypoints while the RC evidence depends on them. |
| v4.4 `verify_all.py` | Unique independent source oracle | Walks original Section-9 records/pages separately and checks all source rectangles and descriptors; preserve as non-public evidence. |
| v4.4 `real_validation.py`, v4.3 `real_validation.py` | Version-specific independent pixel oracles | The later implementation adds v4.4 compositing and raw Layer 2/3 cases; neither is a duplicate of the public synthetic tests. Preserve both. |
| v4.4 `performance.mjs`, `performance_summary.py` | One-time benchmark evidence | Tied to the v4.4 Viewer run and its recorded samples; preserve the results and caveats, do not generalize timings into product constants. |
| v4.4 `reference_fetch.py` | One-time source research | Fetches external format references into the private evidence folder; preserve the retrieved citations and do not make it a build dependency. |
| v4.4 `increment.py`, `audit_candidate.py`; v4.3 `generate_candidate.py`, `measure_backgrounds.py` | One-time command adapters | Delegate to maintained `field-visual` functions. Future runs should use the documented CLI and an explicit ignored output path. |
| v4.3 `audit_baseline.py`, `inspect_structure.py` | One-time source analysis | Preserve source-specific counts and the pre-v2 comparison; the public parser and tests remain the maintained implementation. |
| v4.3 `protection_snapshot.py`, `verify_protection.py`; v4.4 `protect.py`, `final_evidence.py` | Historical protection evidence | Their schemas are tied to each run's baseline. Keep the captured snapshots; production hash/path safety already uses shared project helpers where applicable. |
| v4.3 `summarize_audit.py`; v4.4 `summarize.py` | One-time schema-specific summaries | Similar purpose, different v1→v2 and v3→v4 evidence schemas. Preserve each result rather than introducing a generic, under-specified report framework. |
| v4.3/v4.4 `run-browser.mjs` | Historical E2E launch wrappers | The high similarity is environment setup around the single maintained `web/tests/player-flows.e2e.mjs`; preserve RC invocations and use `npm run test:browser` for new work. |
| v4.3 `run_python_baseline.py`; v4.4 `test_python.py` | Historical private test runners | They select local non-Climate suites and configure each run's private source/output roots. Keep for RC reproduction; the maintained test code remains in the normal Python test directories. |
| v4.4 `browser-pixels.mjs`, `performance.mjs`; v4.3 `measure-codecs.mjs`, `measure-ui.mjs`, `verify-old-workspace.mjs` | One-time browser evidence | Their selectors, measurements, and images are tied to their respective Viewer runs. Preserve outputs and caveats; extend the maintained browser suite only for stable synthetic behavior. |

No v43/v44 Python or JavaScript helper had an identical file hash. The most similar cross-version pairs were the E2E launch wrappers (92.3%) and local server wrappers (80%); both delegate to the maintained test/server implementations. The two `real_validation.py` files share a validation outline but implement different format profiles and oracle coverage. No historic source-specific oracle was moved into public tests.

## Hygiene-pass baseline

At the start of the 2026-10-17 pass, the non-overlapping hygiene scopes (`output/dev`, `output/distribution`, `.build`, `.cache`, `tools`, `docs/development`, and `web/tests`) contained 4,791 files / 132,450,823 bytes and 672 directories. `output/dev` held 338 files / 34,956,052 bytes; `.cache` held 4,402 files / 80,066,117 bytes; `output/distribution` held the 16,856,363-byte v4.4 candidate ZIP plus two checksum files. The root `.build` directory was absent; the 54,005,790-byte v4.3 recovery Pack and matching Manifest live under the protected local Workspace recovery tree. `output/exports` held 15 GPKG and 2 QGZ projects.

The full scan found 74 exact duplicate-hash groups across the requested roots, 651 duplicate files, mostly intentional duplicate files inside the cached Python build environment. Within `output/dev/current`, three `.log` files were byte-identical to their same-run JSON result and had no consumer references; those exact log copies were removed. A stale Node compile cache (139 files / 1,319,620 bytes) was removed after verifying its exact path and that no Node process was active. An initial check also found `audit-tests` empty, but the Web suite review identified it as a consumed scratch root; the suite recreated it and left it empty. It remains available. Repeated `qgis.db`, `bookmarks.xml`, and QGIS project JSON files in separate QA profiles also had identical hashes; those profile copies were retained because their ownership/use is uncertain. A failed npm test-command invocation wrote a new debug log; npm's `logs-max=10` rotation also removed one older 1,011-byte cache log. The new error log was removed after verifying it contained only the CLI flag error; npm did not report the name of the older rotated log, and it was not recoverable from the cache. This affected only `.cache/npm/_logs`, not RC evidence. QGIS profiles, workspaces, exports, candidates, recovery files, and all non-duplicate RC evidence were retained.

At close, `output/dev/current` contains 195 files / 33,634,716 bytes and 34 directories (including the current root), down from 337 files / 34,956,050 bytes and 36 directories. `output/dev` contains 196 files / 33,634,718 bytes and 36 directories. Across the same non-overlapping hygiene scopes, the close inventory is 4,650 files / 131,133,044 bytes and 670 directories. The scoped difference includes the maintenance branch's v4.3 source baseline and three new tracked tool/test/policy files; in the ignored artifact roots alone (`output/dev`, `output/distribution`, `.build`, `.cache`), the inventory fell from 4,743 to 4,600 files and from 131,878,728 to 130,556,383 bytes. File removals were the three duplicate logs, the 139-file Node compile cache, and the one automatically rotated npm cache log described above.
