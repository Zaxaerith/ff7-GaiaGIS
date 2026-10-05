# Post-v2.0 release cleanup

This is artifact cleanup, not a new version or functional change. Before cleanup, main was clean and matched origin/main at `e575dbaa6e30960f9d425d190977d41399c67849`; annotated tag v2.0.0, the published non-draft GitHub Release and successful Pages deployment were verified.

## Before inventory

Logical file bytes are summed without following junctions/symlinks (nine staging node_modules junctions excluded), not filesystem allocated blocks. Root files are included in the total.

| First-level directory | Bytes | Files | Descendant directories |
|---|---:|---:|---:|
| output | 2592254684 | 27950 | 4294 |
| .cache | 180003338 | 322 | 544 |
| web | 163111496 | 4267 | 467 |
| research | 37815377 | 351 | 80 |
| docs | 5194879 | 129 | 19 |
| .git | 1330775 | 213 | 137 |
| .venv | 522203 | 9 | 4 |
| scripts | 485415 | 41 | 0 |
| src | 422676 | 73 | 4 |
| tests | 124957 | 17 | 0 |
| qgis | 61990 | 1 | 0 |
| config | 8236 | 7 | 3 |
| crs | 4204 | 12 | 0 |
| .github | 2994 | 2 | 1 |

Project total before: 2981580353 bytes.

### output second-level inventory, descending size

| Directory | Bytes | Files | Descendant directories |
|---|---:|---:|---:|
| output/v2_0 | 700292240 | 1219 | 161 |
| output/gis | 630894592 | 3 | 0 |
| output/v1_4 | 169961534 | 5147 | 736 |
| output/climate_v2 | 160964744 | 162 | 23 |
| output/v1_3 | 133449472 | 5059 | 530 |
| output/v1_1 | 130625024 | 4354 | 506 |
| output/v1_2 | 128974182 | 4365 | 507 |
| output/web_release_v1 | 112523899 | 2994 | 999 |
| output/3d | 108193250 | 2 | 0 |
| output/climate_v22 | 60389497 | 69 | 12 |
| output/v1_6 | 60024378 | 770 | 132 |
| output/web | 54221775 | 494 | 127 |
| output/climate_v21 | 40083516 | 119 | 18 |
| output/v1_7 | 30572538 | 433 | 80 |
| output/runtime | 18928787 | 1038 | 93 |
| output/v1_9 | 15908697 | 485 | 87 |
| output/v1_5 | 15355591 | 420 | 85 |
| output/v1_8 | 11725416 | 515 | 104 |
| output/public_release_v1 | 4235307 | 252 | 62 |
| output/reconstruction | 3294813 | 24 | 2 |
| output/qgis_profile | 998450 | 4 | 5 |
| output/validation | 621934 | 18 | 0 |
| output/releases_v1_2_v1_3 | 12886 | 3 | 0 |
| output/post-release-cleanup | 0 | 0 | 0 |
| output/tmp | 0 | 0 | 0 |

## Classification and allowlist

- **KEEP_ACTIVE:** all tracked files and `.git`, source/config/schema/docs/research/QGIS/scripts/tests; `.venv`, `web/node_modules`; one complete workspace at `output/v2_0/workspace`.
- **KEEP_ARCHIVE in place:** entire sealed `output/climate_v2`, `climate_v21`, `climate_v22`; protected `output/gis`, `3d`, `reconstruction`, `validation` and legacy `web/public/data` files. Freeze manifests reference47 non-climate output files plus original Web/CRS files; documentation/tests use existing relative paths. Moving these would break references; none are moved, regenerated or edited. The small protected legacy Web payloads are an intentional exception to duplicate-pack removal, not another complete v2 workspace.
- **KEEP_ARCHIVE externally:** unique compact historical QA/research scripts/reports and final v2.0 fingerprints, validation/benchmark/safety/browser summaries and selected final screenshots, under `D:\ProjectArchive\FF7Gaia-v2.0-private-evidence`. Original relative paths are preserved below `workspace/`. Current workspace manifest is copied as evidence. Archive remains private and outside Git.
- **REGENERABLE:** duplicate gameplay/native/texture/Explorer packs, duplicate fresh Stage1 GIS and web builds, using existing parsers/exporters.
- **CACHE:** npm content/log caches, matplotlib font cache, runtime temp and disposable Vite cache. Active dependencies/venv remain.
- **OBSOLETE:** old source checkout/staging copies, browser profiles/screenshots, temporary exports and duplicated release builds. Unique small scripts/reports are archived first.

Exact directory deletion allowlist:

- `output/v1_1`
- `output/v1_2`
- `output/v1_3`
- `output/v1_4`
- `output/v1_5`
- `output/v1_6`
- `output/v1_7`
- `output/v1_8`
- `output/v1_9`
- `output/web_release_v1`
- `output/public_release_v1`
- `output/web`
- `output/qgis_profile`
- `output/runtime`
- `output/releases_v1_2_v1_3`
- `output/tmp`
- `.cache/npm`
- `.cache/climate-matplotlib`
- `web/dist`
- `web/dist-release`
- `web/node_modules/.vite`
- `web/node_modules/.vite-temp`
- `output/v2_0/baseline`
- `output/v2_0/browser-qa`
- `output/v2_0/final-python`
- `output/v2_0/fresh-workspace`
- `output/v2_0/legacy-v17`
- `output/v2_0/legacy-v19`
- `output/v2_0/pages-artifact`
- `output/v2_0/source-only`
- `output/v2_0/test-tmp`

Obsolete root files in `output/v2_0`, a root test log and unprotected ignored Web payloads are individually enumerated in the private plan. Targets are checked against resolved workspace boundaries, tracked files and protected manifests. Junctions are detached without recursive traversal. No blanket git clean/reset/rebase or manual Git object deletion is used. Git is about1.33MB with no garbage; GC is unnecessary.

## Reproducibility

The retained complete workspace contains13 payloads plus its schema1 `gaiagis-workspace` manifest. V2 Explorer is851,560bytes; legacy v1 is regenerable using the existing version1 exporter. Source/asset SHA-256 bindings remain in this manifest and the private archive.

```powershell
. ./scripts/use_workspace_environment.ps1
$env:PYTHONPATH = Join-Path (Get-Location).Path 'src'
python -B -m gaiagis.build_workspace --source "YOUR_FF7_INSTALLATION" --output local-workspace
```

Immutable Stage1 GIS remains at `output/gis`, with matching `output/reconstruction` metadata; default builder discovery can reuse it. Fresh generation remains supported with existing QGIS/GDAL, as validated for v2.0. Cleanup smoke reuses the complete workspace, without heavy GIS/climate runs. `npm run dev` retains protected legacy Web data and the local chooser can load `output/v2_0/workspace`.

## Completion

Final sizes, integrity checks, sanity results and largest remaining files are appended after cleanup. Only this documentation is added to Git; no feature/version changes or remote publication.

### After cleanup and sanity checks

Logical sizes measured after removing rebuilt disposable caches/builds; subsequent small documentation/Git commit overhead is excluded from this snapshot.

| Scope | Before bytes | After bytes | Reduction bytes |
|---|---:|---:|---:|
| Project | 2981580353 | 1203679982 | 1777900371 |
| output | 2592254684 | 1025650970 | 1566603714 |
| .cache | 180003338 | 0 | 180003338 |
| .venv | 522203 | 522203 | 0 |
| web | 163111496 | 131811987 | 31299509 |
| .git | 1330775 | 1330775 | 0 |

Reduction: 59.63%. Retained node_modules: 123636906 bytes. Archived: 1418 evidence entries, 4725747 bytes; one current manifest copied, others moved. Project reduction includes archival moves, not solely filesystem-space reclamation.

### Integrity and sanity

- All356 originally tracked files are byte-identical. Only this cleanup document is added; no source/config/schema/version file changes.
- All461 protected/private evidence hashes match the cleanup-start snapshot, including every climate file. V2/V2.1/V2.2 remain sealed in place.
- Seven core FF7 size/SHA-256 values match before/after. The builder also checked source binding, including field archive. **FF7 source modified = NO**.
- Python imports and11 synthetic workspace smoke tests PASS. No climate work or heavy GIS generation ran.
- Web:490 passed,5 skipped,495 total; skipped cases require removed historical private fixture packs. Zero failures.
- `npm run build`, `build:release`, `audit:release` PASS;14 code/license files,0 game-derived files. Disposable builds removed again after successful checks.
- Unified builder against the actual retained workspace: all8 steps reused,13 payloads, no GIS rebuild, manifest SHA-256 `cd6fed0d6c83e4c17dddb1ab6469ce02b01f5770099c87aa492508f9908baa30` unchanged.
- One complete v2 workspace retained. Historical standalone Web payloads remain because climate freeze protects them. No old v1 Explorer pack remains.
- Full before inventory, exact allowlist, archive hash ledger and deleted-target ledger are under the private archive's `cleanup/`; sanity logs remain ignored locally.
- No Git GC needed. No root Git objects manually deleted; no push/tag/Release/Pages and no new-version development.

### Largest20 remaining files

| Relative file | Bytes |
|---|---:|
| `output/gis/gaia_projections.gpkg` | 340992000 |
| `output/gis/gaia_geographic.gpkg` | 196689920 |
| `output/climate_v2/gaia_climate_v2.gpkg` | 117170176 |
| `output/3d/gaia_sphere_metadata.json` | 103317298 |
| `output/gis/gaia_raw.gpkg` | 93212672 |
| `web/node_modules/@typescript/typescript-win32-x64/lib/tsc.exe` | 24520544 |
| `web/node_modules/@rolldown/binding-win32-x64-msvc/rolldown-binding.win32-x64-msvc.node` | 21176832 |
| `research/repos/ff7-landscaper/.git/objects/pack/pack-d26963420b9e45fa7e79daee6a1b946e076d625b.pack` | 9647974 |
| `output/climate_v22/soil/strong_fields.npz` | 9644562 |
| `output/climate_v22/soil/weak_fields.npz` | 9633070 |
| `output/climate_v22/soil/weak_periodic_fields.npz` | 9632864 |
| `output/climate_v22/soil/medium_fields.npz` | 9626272 |
| `output/climate_v22/soil/medium_periodic_fields.npz` | 9626264 |
| `web/node_modules/lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node` | 9484800 |
| `output/v2_0/workspace/gaia-routing.bin` | 7971076 |
| `output/climate_v21/earth_benchmark/weak_fields.npz` | 7122776 |
| `output/climate_v21/earth_benchmark/medium_fields.npz` | 7118884 |
| `research/repos/ff7-worldmap/.git/objects/pack/pack-46dd711be9132a884073ab097dfa64e20b804a6f.pack` | 7118838 |
| `output/climate_v21/earth_benchmark/strong_fields.npz` | 7115736 |
| `research/repos/ff7-worldmap/FF7LIB.lib` | 5871386 |

The largest files are intentionally retained sealed/freeze-protected GIS/climate evidence and active dependencies. Moving protected outputs would break existing references. Working tree is clean after the local cleanup-documentation commit; its SHA is reported on completion.
