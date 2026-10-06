# GaiaGIS v2.4.0 local RC validation

Baseline: published v2.3.0, `d60c8794b4d3cf62f3831a6f821a29f5b380cd31`.
Date: 2026-10-06. Author Zaxaerith; local main only. No publication.

## Reproduction and resulting behavior

Baseline screenshots and computed styles confirmed the scientific header/footer
and fixed-background user dialog coexisting with FF7 gradient docks, including a
second window inside the Inspector. Baseline docking used unrelated fixed offsets,
different WM0/native reservations and 700/767px breakpoints, plus a 520px app minimum
that did not fit short windows. Workspace import offered generic errors and no clear
distinction between a generated folder and raw game input.

The shared shell now bounds both docks between one header/footer pair. Inner scroll
owns long forms, data lists and expanded Atlas cards. Collapse returns space to the
map; compact widths use exclusive overlays. The default FF7 skin and explicit
Scientific mode share component tokens. Connected resources and canonical workspace
guidance replace ambiguous folder selection and undifferentiated errors.

## Results

| Check | Result |
|---|---|
| Python | **304 passed**, 0 failed/errors/skips; actual source enabled |
| Climate tests executed | **0** |
| Web | **638 passed / 5 explicit optional skips**, 25 files |
| New meaningful Web tests | 11 manifest/import/path-boundary cases |
| New Python check | Private display metadata confined to status; manifest stays path-free |
| Browser | **231/231**: 103 shell/workspace + 70 Navigation + 48 Atlas + 10 fallback |
| Desktop default / both docks | PASS; internal scroll and Inspector collapse/reopen |
| Short desktop 1440×420 / compact 1024×600 | PASS; no page or dock overflow; usable map |
| 390×844 / 320×568 | PASS; Data and expanded Inspector drawers bounded |
| Globe / Mercator | PASS; existing 13-projection navigation regression also passed |
| WM2 / WM3 | PASS; native viewport uses shared bounds, resources Loaded |
| Explorer | PASS; entrance launch/exit and lifecycle regression |
| Default / Scientific | Shared window style/containment checked; screenshots reviewed |
| Public source-only | Disconnected/source-only guidance, authored Atlas and graceful unavailable spatial controls |
| Local automatic workspace | Connected without picker; all 14 resource groups Loaded |
| Manual files | Manifest/core/optional validation and successful complete import |
| Manual directory picker adapter | Folder name shown; partial workspace keeps geometry and identifies unavailable packs |
| Raw FF7 selection / malformed manifest | Specific guidance, no generic catch-all message |
| Missing core / checksum rejection | Missing filenames or regeneration guidance; rejected preflight preserves existing connection/resources |
| Five locales | Browser PASS and catalog parity; **769 keys each** |
| Path boundary | Workspace path only in advertised private status/local display; absent from storage, diagnostics, shares and public artifact |
| Browser page errors / automatic external requests | **0 / 0** |
| build:release / audit:release | PASS; source-only, game-derived files **0** |
| FF7 inputs | **12 unchanged**, FF7 source modified **NO** |
| Frozen algorithms/data owners | Reconstruction/projections/analysis/routing/Atlas/Explorer unchanged |
| Public derived data / proprietary assets added | **NO / 0** |
| External private/user uploads | **0** |
| Working tree | Clean after the local commit checkpoint |

The recommended folder is **output/local-workspace**, relative to the repository.
The launcher prints its absolute generated location; a custom output/ subdirectory
is displayed accurately. Root local-workspace remains a historical/manual option,
not a conflicting launcher default. See [workspace UX](workspace-ux.md) and
[app shell](app-shell.md).

## Evidence and scope

Private evidence stays ignored in output/v2_4/: baseline reproduction.json and
screenshots; browser/report.json; navigation-regression/report.json;
atlas-regression/report.json and fallback-report.json; Web/Python/build/audit logs;
safety-final.json. Browser scripts use workspace-local profiles/temp and original
inputs remain read-only. Directory selection is exercised through the directory API
adapter in headless Chrome; multi-file import uses real generated File inputs.

P0 and P1 are complete. Existing analysis controls/results were grouped; no new
calculation, sample feature, tour import/export, minimap, coordinate dataset or P2
Spatial Analysis extension was added. V1 assumptions, Steam 2026 NOT VERIFIED status
and sealed Experimental/Inconclusive climate policy remain unchanged.

This document is included in the final local commit; its exact SHA is Git HEAD and
is recorded in the ignored final handoff and user report. Stop after commit/clean.
