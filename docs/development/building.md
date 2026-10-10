# Building and development

All project writes, caches and outputs belong in the checkout. Original installations and saves are read-only. Start PowerShell sessions with `. tools/build/environment.ps1` to set workspace-local temporary/npm/Playwright paths.

On macOS use `source tools/build/environment.sh` from bash/zsh. This also scopes pip/PyInstaller caches and the frozen Mac workspace to this checkout; it does not modify global settings.

## Python

Use a workspace `.venv`, install `pyproject.toml` with `pip install -e .`, or use the root checkout adapter. `src/gaiagis/_version.py` is the single application-version authority; setuptools metadata, launcher status, Viewer build and portable packaging derive from it. Schema/generator compatibility versions are separate contracts.

```text
gaiagis --version
gaiagis local --source YOUR_FF7_INSTALLATION
gaiagis build-workspace --source YOUR_FF7_INSTALLATION --output output/local-workspace
gaiagis validate --help
gaiagis build-sphere --help
gaiagis user-gis --help
```

The full developer spherical GIS exporter can use an installed QGIS/GDAL runtime selected with `GAIAGIS_QGIS_ROOT`. The portable workspace runtime uses its bundled transport and needs no QGIS installation. The shared native-map workspace exporter is used by both source and frozen launchers.

## Web

Node 24: `npm --prefix web ci`, `npm --prefix web test`, `npm --prefix web run build`. Source-only public builds use `build:release` followed by `audit:release`; they never copy private packs. Vite reads the Python version authority through `web/scripts/version.mjs`.

## Local portable recipe verification

Use pinned CPython 3.14.7, create `.cache/packaging-venv`, install `tools/build/requirements.txt`, and run its Python on `tools/build/local_package.py`. The recipe automatically performs portable launch smoke and removes the local ZIP/build on success. Add `--keep-artifacts` only when intentionally retaining a temporary candidate. A separately invoked `portable_smoke.py` accepts a read-only `--source` for cold workspace verification; it always removes its extracted tree on success, and removes input distribution artifacts unless `--keep-artifacts` is supplied.

Local artifacts validate the recipe only. Jobs use disposable `output/dev/current/`; failures retain only current necessary evidence under `output/dev/failed-package/` or `failed-smoke/`. The next successful corresponding job clears its previous failure. See [release process](release-process.md) for the exact-tag Actions build that explicitly retains official upload artifacts.

## Native macOS ARM64 candidate

Build on an Apple Silicon Mac using native **CPython 3.14.7**, Node 24 and the existing pinned build requirements. Windows cannot cross-build this package; Intel/Rosetta and universal2 distributions are outside scope. Runtime users need none of these build tools. Native Mac execution has not yet been verified for this local Windows implementation; Python/Tcl/Tk availability and the actual deployment minimum are checked by the recipe on that host, not inferred from the YAML.

In a clean Mac checkout of the v3.3 source:

```sh
source tools/build/environment.sh
python3.14 --version
python3.14 -B -m venv .cache/packaging-venv
.cache/packaging-venv/bin/python -B -m pip install --cache-dir .cache/pip -r tools/build/requirements.txt
npm --prefix web ci
npm --prefix web test
npm --prefix web run build
.cache/packaging-venv/bin/python -B tools/build/local_package.py --keep-artifacts
```

The build asserts native ARM64 and the pinned Python version, freezes an onedir/windowed `GaiaGIS.app`, bundles authored assets, creates corresponding source/notices, derives `Info.plist` version and deployment minimum from the bundled Mach-O files, and finally ad-hoc signs. Every native file, dependency path, signature, public package, ZIP and isolated frozen service is checked. ZIP entries preserve permissions and contained framework links. The manifest records target, build OS, derived minimum, signing and source provenance. Only macOS versions actually exercised can be called verified; the declared minimum is not a claim of testing all older systems.

Candidate output is `output/distribution/GaiaGIS-v3.3.0-macos-arm64.zip`. No Developer ID/notarization, Intel package, automatic update service or QGIS/GDAL bundle is added.

Repeat the isolated smoke with your legally held original PC data, after the code-only build passes:

```sh
.cache/packaging-venv/bin/python -B tools/build/portable_smoke.py \
  output/distribution/GaiaGIS-v3.3.0-macos-arm64.zip \
  --source "/ABSOLUTE/PATH/TO/ORIGINAL_FF7_PC_DATA" --keep-artifacts
open -n output/distribution/build/GaiaGIS.app --args \
  --workspace-root "$PWD/output/dev/current/mac-workspace"
```

The first command performs real cold generation, warm geometry reuse, input fingerprints (including present Field/character/sound inputs), frozen service and security checks. The second opens the native UI with an explicit checkout-local root even when LaunchServices does not inherit the shell environment. Select the source with the native chooser, check progress/retry/cancel, browser launch, exit shutdown and warm relaunch. Inspect Globe/projections, WM2/WM3, Atlas/Explorer, routes/encounters, Save Explorer, Field Graph/Walkmesh, audio and GaiaJSON on the target MacBook Neo. Test moved app, spaces/Unicode/external-volume paths and case-sensitive storage. A downloaded quarantined ZIP/Gatekeeper check is separate and must not be reported from local build smoke.

`--self-test --report ABSOLUTE_WORKSPACE_FILE` records frozen runtime/Tk/Viewer details without relying on windowed stdout. `--smoke-server ABSOLUTE_WORKSPACE_FILE` creates only a bounded synthetic workspace for CI's real HTTP process; it never proves real geometry generation. `--ready-report ABSOLUTE_WORKSPACE_FILE` reports a real launch URL for headless source smoke. Report files must remain in the authorized runtime root. Mac windowed diagnostics overwrite one private `output/portable-startup.log`; game inputs are never served through HTTP.

Source `user-gis` still requires GDAL-enabled Python. The app uses the existing stdlib transport and does not invoke Windows QGIS fallback or promise a Mac QGIS installation layout. Windows build/CLI and all existing GIS contracts remain unchanged.

## Output cleanup

`gaiagis clean-output` previews paths and expected bytes without deleting. `gaiagis clean-output --execute` deletes disposable output while retaining `output/local-workspace` and `output/dev/STATUS.md`. Add `--all` to include the regenerable workspace. Filesystem redirects and active job ownership are rejected; contained framework links are accepted only in dedicated package/smoke output trees and are never followed during deletion. The command never acts outside workspace/output.
