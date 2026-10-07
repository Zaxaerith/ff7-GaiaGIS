# Windows x64 portable distribution

Historical v2.5 and v2.6 Releases are code-only. No binary has been retroactively
claimed. v2.7's Windows package is a **local candidate**, pending human acceptance
and explicit publication approval.

Extract `GaiaGIS-v2.7.0-windows-x64.zip` into a writable directory, run
`GaiaGIS/GaiaGIS.exe`, select your own FF7 installation in the native folder
picker, and wait for a loopback Viewer. No Python, Node, npm or Vite installation
is required to run the package. Generated data stays in that extracted program's
`output/local-workspace`; never extract into the game installation. Stop with
Ctrl+C in the launcher. `--source`, `--no-open`, `--build-only` and `--port` are
available for automation. Save import is browser File API only; the launcher
does not expose arbitrary-file reading or an HTTP file chooser.

## Rebuilding

Use Windows x64, Python **3.14.7**, Node 24, the committed npm lockfile, and the
pinned PyInstaller **6.22.3** requirements. Development GDAL/QGIS is not a
portable runtime dependency.

```powershell
. ./scripts/use_workspace_environment.ps1
$env:PYTHONUTF8 = '1'
python -B -m venv .cache/packaging-venv
.cache/packaging-venv/Scripts/python.exe -B -m pip install --cache-dir .cache/pip -r scripts/packaging-requirements.txt
npm --prefix web ci
.cache/packaging-venv/Scripts/python.exe -B scripts/build_windows.py
python -B scripts/smoke_windows.py output/distribution/GaiaGIS-v2.7.0-windows-x64.zip --source "YOUR_READ_ONLY_FF7_INSTALLATION"
```

The onedir freeze includes Python, required stdlib/DLLs and Tk, compiled audited
source-only Viewer, original data-format metadata, default config, README,
GPL-3.0-only license and dependency notices. Full Python/PyInstaller/Tcl/Tk/
OpenSSL notices and a corresponding authored source ZIP are included. No
research implementation is vendored. The source ZIP excludes sealed climate,
private tests/evidence and unrelated historical documents; Git history remains
unchanged. Runtime source hashes and Viewer hashes are in portable-manifest.

The frozen geometry builder uses a stdlib Float64 SQLite **private transport**,
not a claimed GeoPackage. It feeds the existing exporter and frozen mapping,
avoiding GDAL at runtime. Real-source checks found fourteen generated payloads
byte-identical to development output; only honest transport provenance differs.
The normal development exporter remains available.

The builder uses explicit source/asset allowlists, normalized ZIP timestamps
from the source commit, and a pinned toolchain. This is reproducibility of inputs
and process; byte-for-byte reproducibility across machines is not claimed.
Package audit inspects files, embedded source and compressed Python bytecode,
rejecting game/save/workspace data, screenshots, private paths and sealed or
developer modules. A `.zip.sha256` sidecar covers the exact final archive.

## Portable smoke and limits

Smoke extracts a fresh ZIP inside the workspace, uses workspace-local TEMP,
AppData and profile roots, removes developer environment variables, and limits
PATH to Windows System32. It launches the bundled EXE/Tk, performs cold
workspace generation, verifies textures/models/native packs and localhost
allowlists, and checks loaded DLL paths against package/Windows roots. It
compares input hashes before/after. Browser smoke uses the compiled Viewer.

This is a clean extracted package and isolated process environment, **not a
fresh Windows VM**. A clean-OS/Windows Sandbox run is still an external acceptance
item; it must not be reported as completed. The package is unsigned. Windows
reputation prompts are possible. No false independent-installation claim is
made from the development launcher alone.

## Complete publication transaction

`scripts/release.ps1 -Version 2.7.0` defaults to **local tests/build/smoke only**.
Adding `-Source` enables the real-source smoke/private Python suite. The ignored
private tests are for owner validation and are not distributed. The manual
`windows-portable.yml` workflow builds an artifact with read-only permissions;
it does not publish a tag, Release or Pages and cannot access licensed FF7 data.

Only after explicit human publication approval, an operator may run
`scripts/release.ps1 -Version VERSION -Source INSTALLATION -Notes NOTESFILE -Publish`.
GitHub CLI must be authenticated; `GAIAGIS_GH_EXECUTABLE` can select its path
without changing global Git credentials. The transaction is:

1. Clean main/version/ancestor preflight; Web tests/build/release audit.
2. Windows build, private real-input smoke, package audit and SHA256.
3. Normal fast-forward main push, wait for actual successful Web CI.
4. Annotated tag at the tested SHA; never replace a tag or Release.
5. Published Release containing the ZIP and SHA256, with reviewed notes.
6. Dispatch Pages **on main**, matching github-pages environment policy;
   wait for deployment success and verify Release/tag/main consistency.
7. Download the public ZIP/checksum again and smoke; inspect Pages in browser.

Any failed step stops the script. If remote publication partially succeeded,
inspect the actual main/tag/Release/CI state and finish missing steps explicitly;
do not rerun by deleting or overwriting published objects. A successful main
push alone is not a release. Historical Releases remain intact.
