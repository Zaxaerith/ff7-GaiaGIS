# Getting started

GaiaGIS is a local-first GIS viewer of the original Final Fantasy VII world. Public delivery contains code, authored knowledge and open-source runtimes; game-derived assets come from your own installation.

## Windows portable

When an approved version's GitHub Release contains a Windows ZIP, extract the entire ZIP and run `GaiaGIS.exe`. Select your own FF7 installation. The launcher reads game inputs, generates `output/local-workspace` inside the extracted folder, starts a loopback server and opens the Viewer. Python, Node and QGIS are not required by the portable runtime. Never run it from a protected or read-only directory.

Local candidate ZIPs are developer validation products, not official Release artifacts. Source ZIP/TAR downloads alone are not Windows executables.

## Source checkout

Use Python 3.12+ and Node 24. In the checkout:

```powershell
. tools/build/environment.ps1
npm --prefix web ci
python -m gaiagis local --source "YOUR_FF7_INSTALLATION"
```

For an installed CLI, install into a workspace-local virtual environment with `python -m pip install -e .`, then use `gaiagis local --source "YOUR_FF7_INSTALLATION"`. The small root adapter also preserves `python -m gaiagis.local` in an uninstalled checkout.

## Viewer without game data

The source-only [Pages Viewer](https://zaxaerith.github.io/ff7-GaiaGIS/) opens public authored Atlas cards, search and local user state. It does not contain the complete derived map or original textures/models. Missing spatial anchors remain unavailable.

See [Workspace](workspace.md), [Explorer](explorer.md), [Save Explorer](save-explorer.md), [User Mapping](user-mapping.md) and [development](../development/building.md).
