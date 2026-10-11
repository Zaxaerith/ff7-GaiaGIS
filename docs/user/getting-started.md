# Getting started

GaiaGIS is a local-first GIS viewer of the original Final Fantasy VII world. Public delivery contains code, authored knowledge and open-source runtimes; game-derived assets come from your own installation.

## Windows portable

When an approved version's GitHub Release contains a Windows ZIP, extract the entire ZIP and run `GaiaGIS.exe`. The startup window lets you choose your own original FF7 installation, shows resource progress and opens the browser when ready. A successfully validated folder is remembered; the next launch reuses unchanged resources automatically. The launcher reads game inputs, generates `output/local-workspace` inside the extracted folder, starts a loopback server and opens the Viewer. Python, Node and QGIS are not required by the portable runtime. Extract into a folder you can write to (for example a folder you choose on a data drive), rather than running inside the ZIP or a protected directory. The EXE location determines the data root; there is no developer drive path or silently created AppData workspace. The initial build requires at least 256 MB of free disk space.

If validation fails, select the installation root again and use Start / Retry; Remake/Rebirth folders and folders without the required original-game data are not supported. Details identify the missing input. Cancellation waits for the current resource to finish; restarting checks which completed resources can be reused. Closing the launcher stops its local server. Occupied/reserved ports are skipped automatically.

Explore contains a compact Start exploring section: Find a place, My Save, My map, Routes and Game data help. It can be collapsed and reopened without a welcome overlay. Data shows the current connection; the detailed resource inventory is optional. Atlas Fly-to is directly available when a verified anchor (or clearly labelled parent-place anchor) exists; raw source details remain folded.

Local candidate ZIPs are developer validation products, not official Release artifacts. Source ZIP/TAR downloads alone are not Windows executables.

To browse a place's local scene geometry, open its Atlas card → Field Context,
select a scene and choose **Open Field Workspace**, then **Walkmesh**. Select triangles by clicking/tapping
or by triangle ID; drag to pan and use the zoom/reset buttons. This is a local XY
plan with optional raw-Z colouring, not a global map or playable Field engine.
Older workspaces keep their scene connections but need regeneration for the
optional Walkmesh pack. The Graph/Walkmesh main viewport shares scene selection with the Inspector and returns to the original World camera. [Field workspace controls](navigation.md#field-spatial-workspace). Public mode never contains original-game scene geometry.

## macOS Apple Silicon candidate

The current local recipe produces `GaiaGIS-v3.4.0-macos-arm64.zip` containing **GaiaGIS.app**. Native Mac build and ordinary-device acceptance are still pending; an edited recipe is not a published binary. After a verified build, extract the entire ZIP with Archive Utility and open the app. The app can be moved to Applications; its generated data and remembered source remain in `~/Library/Application Support/GaiaGIS`, never inside the app bundle. The startup window displays the workspace location. Moving/upgrading the app does not relocate this workspace.

Select a complete supported original FF7 **PC data directory** that you legally own. A copy transferred from another computer works with the same supported `data/wm`, `wm` and `workingdir/data/wm` layouts, and adjacent `field` resources. Required inputs are WM0/WM2/WM3 MAP/BOT, `world_us.lgp` and `field/flevel.lgp`; `char.lgp` and `sound/audio.fmt`/`audio.dat` supply optional models/audio. No FF7.exe is run. PS1 discs, arbitrary ports and Remake/Rebirth are not supported inputs. Resources remain read-only, including those on external volumes. Python, Node, Wine, CrossOver, Rosetta and QGIS are not needed by the portable Viewer.

Advanced launches may set `GAIAGIS_WORKSPACE_ROOT` to an absolute dedicated directory, or pass `--workspace-root ABSOLUTE_DIRECTORY` through `open --args`. Development smoke always overrides it inside the checkout. A workspace cannot contain the app or lie within it or within the selected game source. Configuration, private startup log, generated data and temporary files all stay below that workspace. An unwritable workspace or missing/moved game folder requires correcting the location and retrying; the app does not silently write elsewhere.

The recipe uses **ad-hoc signing**, with no Developer ID or Apple notarization. This does not guarantee Gatekeeper acceptance for a downloaded app. After checking provenance/checksum, follow Apple's [Open an app from an unidentified developer](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac) guidance (System Settings → Privacy & Security → Open Anyway when offered). Do not disable Gatekeeper or remove quarantine as a routine step. Downloaded-app acceptance must be checked on the actual Mac separately from local command-line smoke.

GaiaJSON remains available in the Viewer. Optional `user-gis` GeoPackage exchange uses the existing GDAL-enabled Python tool, separately from the portable app. Neither bundled GDAL nor Mac QGIS integration has been verified. See [Mac build and acceptance](../development/building.md).

## Source checkout

Use Python 3.12+ and Node 24. In the checkout:

```powershell
. tools/build/environment.ps1
npm --prefix web ci
python -m gaiagis local --source "YOUR_FF7_INSTALLATION"
```

For an installed CLI, install into a workspace-local virtual environment with `python -m pip install -e .`, then use `gaiagis local --source "YOUR_FF7_INSTALLATION"`. The small root adapter also preserves `python -m gaiagis.local` in an uninstalled checkout.

On macOS, source `tools/build/environment.sh` in bash/zsh instead of the PowerShell helper. Source development continues to use the checkout as its workspace and the established GDAL requirement for full GIS generation. The frozen app uses the existing stdlib transport; these are separate runtime paths.

## Viewer without game data

The source-only [Pages Viewer](https://zaxaerith.github.io/ff7-GaiaGIS/) opens public authored Atlas cards, search and local user state. It does not contain the complete derived map or original textures/models. Missing spatial anchors remain unavailable.

See [Workspace](workspace.md), [Explorer](explorer.md), [Save Explorer](save-explorer.md), [User Mapping](user-mapping.md) and [development](../development/building.md).
