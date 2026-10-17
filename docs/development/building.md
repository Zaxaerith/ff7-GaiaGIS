# Building and development

All project writes, caches and outputs belong in the checkout. Original installations and saves are read-only. Start PowerShell sessions with `. tools/build/environment.ps1` to set workspace-local temporary/npm/Playwright paths.

The maintained targets are **Web and Windows x64**. The retained POSIX environment helper and Mac-specific packaging/audit paths are historical compatibility code; current CI/Release do not build them.

## Python

Use a workspace `.venv`, install `pyproject.toml` with `pip install -e .`, or use the root checkout adapter. `src/gaiagis/_version.py` is the single application-version authority; setuptools metadata, launcher status, Viewer build and portable packaging derive from it. Schema/generator compatibility versions are separate contracts.

```text
gaiagis --version
gaiagis local --source YOUR_FF7_INSTALLATION
gaiagis build-workspace --source YOUR_FF7_INSTALLATION --output output/local-workspace
gaiagis validate --help
gaiagis build-sphere --help
gaiagis user-gis --help
gaiagis field-gis --help
gaiagis field-interaction --help
gaiagis field-visual --help
```

The full developer spherical GIS exporter can use an installed QGIS/GDAL runtime selected with `GAIAGIS_QGIS_ROOT`. The portable workspace runtime uses its bundled transport and needs no QGIS installation. The shared native-map workspace exporter is used by both source and frozen launchers.

## Increment only Field background resources

For an existing source-matched Workspace, use the dedicated updater rather than a full build:

```powershell
. tools/build/environment.ps1
python -m gaiagis field-visual --source "YOUR_FF7_INSTALLATION" --workspace output/local-workspace --audit output/dev/current/field-background-audit.json
```

The optional `--audit` target must be `.json` under `output/dev/current`; existing files must be owned `gaiagis-field-background-audit` version-1 reports. It cannot overwrite an existing Workspace, research product or source file; report replacement is atomic.

This writes explicit Visual v2 (`field-visual-4`) and its Manifest entry after candidate/source validation. It preserves world/GIS products, Walkmesh, Interaction, GeoPackages and research projects. Exception rollback and `.build/visual-recovery` protect the old matching pair; later backups use a manifest-SHA256 subdirectory so earlier recovery pairs survive. Interrupted two-file replacement is recoverable rather than crash-atomic. Re-import the folder into the current locally built Viewer. Visual v1 and v2 generator-3 remain readable without this upgrade. See [format and limits](../reference/workspace-format.md#optional-field-visual-transport).

## Web

Node 24: `npm --prefix web ci`, `npm --prefix web test`, `npm --prefix web run build`. Source-only public builds use `build:release` followed by `audit:release`; they never copy private packs. Vite reads the Python version authority through `web/scripts/version.mjs`.

## Local Windows x64 recipe verification

Use pinned CPython 3.14.7, create `.cache/packaging-venv`, install `tools/build/requirements.txt`, and run its Python on `tools/build/local_package.py`. The recipe automatically performs portable launch smoke and removes the local ZIP/build on success. Add `--keep-artifacts` only when intentionally retaining a temporary candidate. A separately invoked `portable_smoke.py` accepts a read-only `--source` for cold workspace verification; it always removes its extracted tree on success, and removes input distribution artifacts unless `--keep-artifacts` is supplied.

```powershell
. tools/build/environment.ps1
python --version # Must be 3.14.7 for the native build below.
python -B -m venv .cache/packaging-venv
.cache/packaging-venv/Scripts/python.exe -B -m pip install --cache-dir .cache/pip -r tools/build/requirements.txt
npm --prefix web ci
npm --prefix web test
npm --prefix web run build
.cache/packaging-venv/Scripts/python.exe -B tools/build/local_package.py
```

The recipe performs release Viewer build/audit, a real frozen executable build, deep compressed-bytecode audit, ZIP/SHA256 creation and isolated localhost smoke. The result is `development-validation-only`, with the actual source commit and dirty state; it cannot pass as an official exact-tag artifact. A test does not need a real release tag. The embedded source ZIP and licences accompany the runtime; original FF7 resources, private workspaces, GeoPackages and saves are excluded. Optional GIS exporters/GDAL stay outside the frozen Viewer runtime.

Local artifacts validate the recipe only. Jobs use disposable `output/dev/current/`; failures retain only current necessary evidence under `output/dev/failed-package/` or `failed-smoke/`. The next successful corresponding job clears its previous failure. See [release process](release-process.md) for the exact-tag Actions build that explicitly retains official upload artifacts.

## Historical macOS compatibility

Mac-specific roots, `.app` layout, confined-link ZIP handling and native architecture/signature guards remain in source to preserve history. They are not a maintained release recipe, tested current distribution or prerequisite for Windows/Web acceptance. Earlier source versions and their candidate instructions remain available in Git history. No current Mac binary, Finder/Gatekeeper acceptance or cloud build is promised.

## Output cleanup

`gaiagis clean-output` previews paths and expected bytes without deleting. `gaiagis clean-output --execute` deletes disposable output while retaining `output/local-workspace` and `output/dev/STATUS.md`. Add `--all` to include the regenerable workspace. Filesystem redirects and active job ownership are rejected; contained framework links are accepted only in dedicated package/smoke output trees and are never followed during deletion. The command never acts outside workspace/output.

New distribution maintenance is Windows x64 + Web only. CI and Release no longer build macOS; historical recipes are retained without a promise of a working Mac bundle. Camera/background generation uses stdlib parsing/compression and private workspace storage; it does not add GDAL or an FF7 engine to the portable app.
