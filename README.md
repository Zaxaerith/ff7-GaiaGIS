# GaiaGIS

A local-first GIS reconstruction of the original FINAL FANTASY VII world, with a Globe, thirteen projections and separate native WM2/WM3 maps. V1 Geometric Gaia is a mathematical reconstruction, not official FF7 geography. Its Earth-sized reference sphere is an explicit assumption.

## Quick start

For Windows players: download the Windows ZIP from [Releases](https://github.com/Zaxaerith/ff7-GaiaGIS/releases), extract it to a writable folder and run **GaiaGIS.exe**. Choose your original FF7 installation. The startup window shows progress, opens the Viewer and remembers the folder for next time. No Python or Node installation is needed. In the Viewer, **Explore → Start exploring** offers the main player shortcuts.

The **v3.8.0 local RC** adds private, single-Field GeoPackage research export from the existing workspace: original Polygon Z/LineString Z, validated anchors and directed network snapshots, with undefined Cartesian CRS and raw units. Camera/background browsing remains in the existing Web Canvas. The distribution target is **Windows x64 + Web**. macOS packaging remains unmaintained historical code. [FieldLocal QGIS export](docs/user/workspace.md#fieldlocal-geopackage-research-export).

For a source checkout:

```powershell
. tools/build/environment.ps1
npm --prefix web ci
python -m gaiagis local --source "YOUR_FF7_INSTALLATION"
```

Use Python 3.12+ and Node 24 in a source checkout. The launcher reads your installation, incrementally generates **output/local-workspace**, connects it automatically and opens the browser. It never modifies game files. [Getting started](docs/user/getting-started.md).

## Windows Release

Approved new Releases provide one Windows x64 ZIP and `SHA256SUMS.txt`. GitHub Actions checks the exact annotated tag, runs Web and isolated package validation, and publishes only the verified Windows artifact after separate approval. Local candidate ZIPs are validation products. The portable Viewer needs no Python/Node installation; optional GaiaJSON/GeoPackage exchange and FieldLocal export require GDAL-enabled Python and does not bundle QGIS. v3.8 is a local candidate, not a published Release.

[Releases](https://github.com/Zaxaerith/ff7-GaiaGIS/releases) · [Release process](docs/development/release-process.md)

## Local FF7 workspace

Choose GaiaGIS's generated folder containing `gaia-workspace.json`, **not** the FF7 installation or raw `wm` directory. Data displays connection source, manifest and available geometry, locations, gameplay layers, routing, textures, WM2/WM3, transitions, Explorer, Atlas and presentation resources. [Workspace guide](docs/user/workspace.md) · [Format](docs/reference/workspace-format.md).

## Web Pages

The [public Viewer](https://zaxaerith.github.io/ff7-GaiaGIS/) is source-only: authored Atlas/search and local user state work without distributed private spatial packs. Explicit folder/file import connects privately generated assets. Missing anchors remain unavailable.

## Core features

- Globe/projections, local scale, graticule, original local textures and linked Compare.
- Atlas provenance, spoiler controls, local search, Bookmarks, Recent, Nearby and Tours.
- Static routing/playback, route profile, terrain/encounter exposure, slope/aspect and service area.
- Explorer keyboard/touch previews using locally decoded original models; no game-runtime simulation.
- User points/lines/polygons, layers, reference-sphere measurement and bounded local GaiaJSON exchange, optional raw-coordinate QGIS/GeoPackage roundtrips and explicit Merge/Update conflicts.
- Read-only fifteen-slot PC/Steam 2013 Save Explorer. Verified WM0 world saves can locate Player Position; field/unknown/native records receive no fabricated marker.
- Field Spatial Workspace: World Map, directed SVG Field Graph and responsive Canvas Field Walkmesh in the main viewport. Search a scene such as `mds5_1`, then **Open Field Workspace**. Scene switching, raw-Z colour, triangle/adjacency attributes and Field Spatial Anchors share the existing Inspector. Validated FIELD.TBL entrances, source Gateway segments and target-only arrival points retain raw coordinates, paired scenarios and source offsets; geometry warnings never imply runtime passability. World camera/projection and Compare are retained on return. Static Gateway/MAPJUMP evidence and Field-local raw units remain distinct from geography. [Field guide](docs/user/navigation.md#field-spatial-workspace).
- Field Static Network Analysis: deterministic WCC/SCC, directed BFS reachability and least-Access-crossing paths, validated entrance/arrival starts and conservative 3D Gateway candidates. Static topology does not establish gameplay reachability; no global route, metre distance or repaired adjacency. [Field guide](docs/user/navigation.md#field-static-network-analysis).
- Unified FF7-inspired shell, explicit Scientific theme, desktop/320/390px layouts and five languages.

## Documentation

[Explorer](docs/user/explorer.md) · [Save Explorer](docs/user/save-explorer.md) · [User Mapping](docs/user/user-mapping.md) · [Navigation](docs/user/navigation.md)

[Architecture](docs/reference/architecture.md) · [Coordinates](docs/reference/coordinate-spaces.md) · [Reconstruction](docs/reference/reconstruction.md) · [Atlas](docs/reference/atlas.md) · [Routing](docs/reference/routing.md) · [Spatial analysis](docs/reference/spatial-analysis.md) · [Cartography](docs/reference/cartography.md) · [GaiaJSON](docs/reference/gaiajson.md) · [Save format](docs/reference/save-format.md)

## Data / copyright policy

Public delivery contains code, authored summaries/provenance and required open-source dependencies. It contains no original FF7 assets, user saves, private workspaces/screenshots or complete derived geometry/POI datasets. No account, telemetry, automatic upload or cloud sync. Save bytes stay in session memory; user mapping stays local and is excluded from share URLs. [Policy](docs/reference/data-policy.md).

Steam 2026 executable equivalence remains **NOT VERIFIED**. WM2/WM3 have no fabricated global transform. Climate remains sealed [Experimental / Inconclusive](docs/research/climate-conclusion.md).

## Build / development

`src/gaiagis/_version.py` is the application-version authority. Unified CLI: `gaiagis local`, `build-workspace`, `validate`, `build-sphere`, `user-gis`, `field-gis`. The checkout adapter preserves `python -m gaiagis.local` without installing globally.

`npm --prefix web test` · `npm --prefix web run build` · `npm --prefix web run build:release` · `npm --prefix web run audit:release`.

[Building](docs/development/building.md) · [Testing](docs/development/testing.md) · [Changelog](CHANGELOG.md). Private Python tests and all generated validation evidence stay ignored. Development completion does not publish automatically.
