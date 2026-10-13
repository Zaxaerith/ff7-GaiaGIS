# Local workspace

A workspace is GaiaGIS-generated data, not the FF7 installation or its raw `wm` folder. The default location is **`output/local-workspace`**, relative to the checkout or portable package. The alternative root `local-workspace` folder is not the launcher default. Web is the primary Viewer; the same generated folder can be selected in its Data panel without running the native launcher.

Historical, unmaintained macOS behaviour (not a current distribution target): `output/local-workspace` is relative to the dedicated writable root **`~/Library/Application Support/GaiaGIS`**. App resources stay read-only in `GaiaGIS.app/Contents/Resources`. The launcher displays the writable root; remembered source, caches, temporary files and logs stay beneath it. `GAIAGIS_WORKSPACE_ROOT` or the Mac app's `--workspace-root` launch argument can explicitly select an absolute dedicated root. Developer/packaging tests always use a checkout-local override. Windows EXE and source-checkout defaults are unchanged.

## Automatic connection

Run `python -m gaiagis local --source "YOUR_FF7_INSTALLATION"` (or the portable EXE). The launcher generates missing components, reuses compatible components, serves only allowlisted workspace payloads and supplies local status. The Viewer connects automatically. The source installation is strictly read-only.

The Data status card distinguishes auto-local, manually selected folder and public source-only mode. Local mode can display the workspace path; paths are never put in public share links.

## Manual selection

Use **Data → Workspace Folder** and choose the generated folder containing `gaia-workspace.json`. Do **not** select the installation or its `wm` directory. The folder picker checks the manifest and reports missing/invalid components. Public source-only mode remains usable when optional components are absent. Manual file handles stay in the current page session; re-select the folder after refresh. Auto-local mode instead reconnects to its still-running loopback launcher/server.

An explicit build is available:

```powershell
python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
```

For an existing workspace, run this command with its **same output folder**. Generation checks component hashes and generator compatibility, preserves reusable world/GIS components, and updates the manifest. The explicit builder is incremental by default; avoid the local launcher's full `--rebuild` for a Viewer upgrade. A Viewer upgrade alone does not add missing private resources to an older workspace. Fresh source geometry generation requires GDAL/QGIS or a compatible existing Stage-1 cache; an incremental build with reusable core geometry does not regenerate it.

For Camera View / Background Overlay, the folder must contain `gaia-field-context.json`, `gaia-field-walkmesh.bin` and `gaia-field-visual.bin`, registered in `gaia-workspace.json`. After generation finishes, use **Data → Workspace Folder** in the browser to select that updated folder again. This works with the ordinary Web Viewer; neither the Windows EXE nor the auto-local server is required. The browser imports generated files only and does not generate resources from the game installation.

## Compatibility and failed imports

Application version and data-format version serve different purposes. v4.0 retains Manifest v1, Field Context schema 3, Walkmesh v1, visual pack v1, FieldLocal GeoPackage v1 and existing GaiaJSON/WM0 exchange contracts. An otherwise compatible v3.x Workspace does not need regeneration just because its `tool_version` differs from the Viewer version.

The manifest's asset lengths/hashes and dependencies are checked, followed by each component's bounded parser and source bindings. Unsupported format versions, truncation or inconsistent `flevel.lgp`/maplist/world hashes are rejected; selecting unrelated individually valid files does not make them a matched Workspace. Inspect **Data → Resources** for the affected component and availability, then re-select the complete, source-matched generated folder. Do not edit hashes or invent missing payloads to bypass validation.

Old Field Context v1/v2 can retain scene identity/Graph and compatible Walkmesh browsing. Missing Spatial Anchors disable exact entrance/arrival navigation; missing visual data leaves Plan View available. Missing private packs in Public source-only mode are expected, rather than proof of a parsing failure. Data replacement invalidates incompatible Field navigation history and caches. Manual import uses one page-session request identity across the normal UI remount during geometry adoption; older manual validation/status cannot replace a newer choice. Automatic-local responses cannot replace an already validated manual Workspace. A rejected manual choice keeps its alert through automatic connection but does not block that valid connection; a successful manual retry clears the alert. Page exit invalidates requests, and cancelled source reads do not begin owner adoption.

## Available resources

The manifest describes geometry/metadata, locations, encounters, events, routing, WM0 textures, WM2/WM3 native geometry and textures, transitions, Explorer models/animation, presentation audio, Atlas and optional Field Context. Availability depends on valid original inputs and enabled generation options. Data UI reports availability rather than implying a missing asset has loaded.

Generation uses component input hashes. Authored Atlas changes rebuild Atlas without re-extracting textures or geometry. Missing/corrupt optional Atlas does not invalidate the rest of the workspace. Native maps keep their own coordinate semantics. See [workspace format](../reference/workspace-format.md) for schemas, compatibility and components.

Workspaces, local launch receipts, private screenshots and user saves remain ignored and must never enter public packages. Keep the existing Workspace, research exports and unique private evidence during upgrades; no routine upgrade requires deleting them. Disposable QA/build cleanup is separate from Workspace maintenance.

## Private camera/background resource

`gaia-field-visual.bin` is optional and independent of Context schema 3 / Walkmesh v1. Its metadata binds `flevel.lgp` and maplist SHA256 to Field identities. Generator revision `field-visual-2` includes indexed Layer 0 and unconditional, unblended Layer 1 tiles, in stored depth/sub-ID order. The pack schema remains v1; the compact descriptor's texture byte uses bit 6 for Layer 1, preserving the layer-local tile ID and Section-9 offset. Older `field-visual-1` resources remain readable but contain only Layer 0; an incremental build replaces only the visual component to obtain the corrected static background. Indexed texels, only referenced palettes and fixed-size source descriptors are compressed per scene; the selected scene is bounded, hashed and decoded on demand. There is no PNG collection or copied LGP. The whole optional pack is capped at 64 MB, metadata at 8 MB, a decoded scene at 8 MB and composed image at 4 million pixels. One selected-scene cache is released on source/scene replacement and application disposal.

Generation is one separate incremental component; it reuses unrelated world/GIS outputs. Delete only this optional file to clear its private visual cache; the next workspace build regenerates it. Never put it in public Viewer assets or a Release. Failed background parsing leaves cameras and Plan View available, with explicit unsupported status; background omissions are not repaired with placeholder textures.


## FieldLocal GeoPackage research export

This optional source CLI exports one scene from an existing private workspace. It does not generate game data or modify the workspace. Use Python providing **GDAL >= 3.9**; on Windows an installed standalone QGIS/OSGeo4W environment can be selected through the existing runtime adapter:

```powershell
. tools/build/environment.ps1
$env:GAIAGIS_QGIS_ROOT = "C:/path/to/QGIS"
python -m gaiagis field-gis export --workspace output/local-workspace --field mds5_1 --output output/exports/fieldlocal/mds5_1.gpkg --start-triangle 16
```

The QGIS root contains `bin/python.exe`, `apps/Python3*` and `apps/qgis/python`. A Python environment already providing `osgeo` needs no root override. QGIS/GDAL is not included in the Windows portable Viewer; the browser requires neither. No browser button claims to generate a GeoPackage.

Omit `--start-triangle` for components only: Triangle 0 is never an implicit entrance. Add `--end-triangle 115` with a start for a minimum directed Access-hop path. An unreachable path has no fabricated geometry. Default/Alternative entrances retain independent IDs/triangles. No cross-Field route or runtime script execution is inferred.

Each output belongs to one Field and uses **Undefined Cartesian `srs_id=-1`**, original X/Y/Z, no axis change, translation, scale or geographic reference. Do not assign EPSG:4326, WGS84 or GaiaGame. In QGIS, keep ellipsoidal measurements disabled; Cartesian `length($geometry)` / `area($geometry)` results are Raw Unit / Raw Unit², not metres. Different Fields have independent coordinate spaces and should be opened separately.

The five spatial layers are `walkmesh_triangles` (Polygon Z), `walkmesh_edges` and `gateway_segments` (LineString Z), `field_entrances` and `arrival_points` (Point Z). Nonspatial tables are `raw_vertices`, `anchor_records`, `gateway_candidates`, `network_components`, `network_path` and `field_metadata`. Empty layers are retained. Query `triangle_id`, classify triangles by `wcc_id`/`scc_id`, and query edges with `blocked = 1` or a specific `from_triangle`; edge slots remain directed Access evidence. Gateway candidates preserve one-to-many exact 3D relations, without snapping XY-only geometry.

XYZ and raw4 retain original S16 integers and source-relative offsets. Raw4 is an integer attribute, never M or a verified collision/height flag. Point Z for entrances/arrivals is explicitly **Derived Raw Z** from the designated triangle plane; their original records provide XY only. Degenerate polygons remain unchanged, with diagnostics and independent vertex records. The private format is `gaiagis-fieldlocal-gpkg` version 1, recording source hashes and **Static Walkmesh Topology — Not Verified Gameplay Reachability**.

Only new `.gpkg` files beneath the ignored `output/exports/fieldlocal` directory are allowed. Existing files are refused; choose a new name. Export uses bounded staging, at least 256 MB free disk, a 128 MB output limit, source rechecks and SQLite/OGR validation before atomic delivery. It reads/hashes the existing pack but decodes only the selected raw Section 5. There is no automatic all-Field export or copied LGP/background collection.

Open the GeoPackage in QGIS, inspect all layers/tables and raw attributes, classify WCC/SCC, locate anchors, then save a **research copy** and reopen it. Editing that copy does not modify FF7 or update GaiaGIS source evidence. The exporter never writes changes back. Keep exports, projects and screenshots private and ignored; do not include them in Pages, source commits or Release assets. Camera/background visualization stays in Web; no GeoTIFF, orthophoto or geographic control points are exported.
