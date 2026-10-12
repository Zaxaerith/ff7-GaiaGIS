# Local workspace

A workspace is GaiaGIS-generated data, not the FF7 installation or its raw `wm` folder. The default location is **`output/local-workspace`**, relative to the checkout or portable package. The alternative root `local-workspace` folder is not the launcher default.

Historical, unmaintained macOS behaviour (not a current distribution target): `output/local-workspace` is relative to the dedicated writable root **`~/Library/Application Support/GaiaGIS`**. App resources stay read-only in `GaiaGIS.app/Contents/Resources`. The launcher displays the writable root; remembered source, caches, temporary files and logs stay beneath it. `GAIAGIS_WORKSPACE_ROOT` or the Mac app's `--workspace-root` launch argument can explicitly select an absolute dedicated root. Developer/packaging tests always use a checkout-local override. Windows EXE and source-checkout defaults are unchanged.

## Automatic connection

Run `python -m gaiagis local --source "YOUR_FF7_INSTALLATION"` (or the portable EXE). The launcher generates missing components, reuses compatible components, serves only allowlisted workspace payloads and supplies local status. The Viewer connects automatically. The source installation is strictly read-only.

The Data status card distinguishes auto-local, manually selected folder and public source-only mode. Local mode can display the workspace path; paths are never put in public share links.

## Manual selection

Choose the generated folder containing `gaia-workspace.json`. Do **not** select the installation or its `wm` directory. The folder picker checks the manifest and reports missing/invalid components. Public source-only mode remains usable when optional components are absent.

An explicit build is available:

```powershell
python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
```

## Available resources

The manifest describes geometry/metadata, locations, encounters, events, routing, WM0 textures, WM2/WM3 native geometry and textures, transitions, Explorer models/animation, presentation audio, Atlas and optional Field Context. Availability depends on valid original inputs and enabled generation options. Data UI reports availability rather than implying a missing asset has loaded.

Generation uses component input hashes. Authored Atlas changes rebuild Atlas without re-extracting textures or geometry. Missing/corrupt optional Atlas does not invalidate the rest of the workspace. Native maps keep their own coordinate semantics. See [workspace format](../reference/workspace-format.md) for schemas, compatibility and components.

Workspaces, local launch receipts, private screenshots and user saves remain ignored and must never enter public packages. Deleting a generated workspace is safe once unique private evidence has been preserved; the launcher can rebuild it.

## Private camera/background resource

`gaia-field-visual.bin` is optional and independent of Context schema 3 / Walkmesh v1. Its `field-visual-1` metadata binds `flevel.lgp` and maplist SHA256 to Field identities. Indexed base-tile texels, only referenced palettes and fixed-size source descriptors are compressed per scene; the selected scene is bounded, hashed and decoded on demand. There is no PNG collection or copied LGP. The whole optional pack is capped at 64 MB, metadata at 8 MB, a decoded scene at 8 MB and composed image at 4 million pixels. One selected-scene cache is released on source/scene replacement and application disposal.

Generation is one separate incremental component; it reuses unrelated world/GIS outputs. Delete only this optional file to clear its private visual cache; the next workspace build regenerates it. Never put it in public Viewer assets or a Release. Failed background parsing leaves cameras and Plan View available, with explicit unsupported status; background omissions are not repaired with placeholder textures.
