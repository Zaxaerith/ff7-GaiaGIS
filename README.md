# GaiaGIS

A local-first GIS reconstruction of the original FINAL FANTASY VII world, with a Globe, thirteen projections and separate native WM2/WM3 maps. V1 Geometric Gaia is a mathematical reconstruction, not official FF7 geography. Its Earth-sized reference sphere is an explicit assumption.

## Quick start

**v5.6.0 — Regional Connectivity & Boundaries** adds a source-derived tool in **Features → GIS analysis**: compare strict Region components with/without confirmed X seams, highlight a component, display selected Region boundaries and inspect original faces and entrance/Atlas context. It uses your existing WM0 Workspace; source-only pages report the analysis unavailable. Region topology is separate from movement/routing connectivity. [Method and limits](docs/reference/spatial-analysis.md#regional-connectivity-and-boundaries-v560) · [Using the tool](docs/user/navigation.md#regional-connectivity-and-boundaries-v560).

The **Web Viewer is the main interface**. Open the [public Viewer](https://zaxaerith.github.io/ff7-GaiaGIS/). Without a map, an original vector title scene offers four simple choices:

1. **Start exploring** returns to an already loaded map, or explains how to unlock one while offering public guides immediately.
2. **Game guides** opens the existing Atlas search, categories and three game shortcuts. Public guides work without a Workspace.
3. **Load Workspace** focuses the existing folder selector. Select a GaiaGIS-generated folder containing `gaia-workspace.json`, not the original game directory.
4. **Settings & help** provides the five UI languages, display/data help and folded advanced loading controls.

To create a map from original game data, get the official Windows ZIP from [Releases](https://github.com/Zaxaerith/ff7-GaiaGIS/releases), extract it fully and run `GaiaGIS.exe`. Its coordinated native launch screen selects and validates EN/FR/DE/ES PC resources, incrementally prepares the Workspace and opens the browser automatically. This is a two-stage native/browser flow, with no browser-to-native chooser interface. Static Web does not unpack an installation or upload resources. PS1, Remake/Rebirth and unverified MOD inputs remain outside the verified contract.

The in-app **Features** navigation has five direct entries: **World map**, **Character Explorer**, **Game guides**, **GIS analysis** and **Data & settings**. **Features → Character Explorer** opens the original character/movement controls directly: Cloud and walking by default on WM0, with separate party, vehicle and Chocobo groups. It uses the optional matching `gaia-explorer.bin`; missing data is explained at the same entry. **Features → Return to title** returns without unloading the map. [Browser, Windows and developer instructions](docs/user/getting-started.md).

The application restores v5.5.0's classic deep-blue gradient and silver window treatment. Feature navigation and content are separate views of one drawer; GIS subtools remain directly available without nested category menus. Atlas/Gameplay content, evidence precision and advanced GIS owners are retained. The original title illustration and Windows two-stage startup are unchanged.

**v5.5.1 — Game Guide & Exploration UX** puts Places, Treasures & Rewards, Materia, Secrets and Boss clues in **Explore → FF7 Game Guide**. Browse the existing 58 authored entries (subject to spoiler settings), including Kalm's Megalixir, Knights of the Round and the Wutai Pagoda challenge, without a Workspace. Cards distinguish an entrance from a parent place or Field association; private data enables verified map actions. [Guide navigation](docs/user/navigation.md#game-guide-v551) · [Data formats, actual size and database boundaries](docs/reference/data-formats-and-scale.md).

An optional private **Original game evidence** asset adds Field grant/battle instructions, original formations and enemies with source-language names. The same Explore search and Inspector connect verified script identities to existing guides, including two exact EN Godo/Snow profiles. Static grants are not chest counts or saved collection status; no reward coordinates or runtime behavior are inferred. [Incremental generation and evidence limits](docs/reference/data-formats-and-scale.md#可选-gameplay-evidencev551).

**GaiaGIS v5.5.0 — Regional Terrain Statistics** adds Global, By Region and By Terrain views for original WM0 BASE records. Cross-table face counts and raw² area contributions retain zero-area and duplicate sources, with explicit denominators, raw height, slope/aspect summaries and paged Source Inspector links. Original IDs and spherical navigation centers stay unchanged; no Workspace regeneration is needed. [Statistics method and limits](docs/reference/spatial-analysis.md#regional-terrain-statistics-v55).

**GaiaGIS v5.4.0 — WM0 Topology Evidence Explorer** indexes all original BASE edge occurrences on demand, with paged anomaly filters and three-edge evidence in the existing Source Inspector. Exact X-periodic relations and actual source-matched Routing CSR stay separate; Z never wraps. Existing Workspaces need no regeneration. [Topology conventions and use](docs/reference/global-source-gis.md#wm0-topology-evidence-v54).

**GaiaGIS v5.3.0 — Verified Script Evidence & Field Recovery** accepts four reviewed complete EN/FR/DE/ES WM0 EV fingerprints for static initialization prediction, preserving Unknown for missing, changed or conflicting sources. Six exact FR/DE Field members recover scripts and Walkmesh through validated section offsets; three recover Visual, while FR `itown_w/i/m` retain strict unknown-tail rejection. Context v1–v4 remains readable. This is static source evidence, without original-game runtime verification. [Source compatibility and limits](docs/reference/multilingual-sources.md).

**GaiaGIS v5.2.0 — Multilingual Source GIS** introduced paired EN/FR/DE/ES game archives in the Local Launcher or CLI, independently of the five-language UI. Shared MAP geometry is reused; World and Field evidence keeps the actual archive names, hashes and script offsets. Old English Workspaces remain readable. Save Field placement retains exact source/Triangle checks.

**GaiaGIS v5.0.0 — Global Source GIS & Integrated Spatial Analysis** queries all 142,586 original WM0 base faces at an explicit raw X/Z or along a source-linked transect. Shared edges, duplicates, multiple heights and vertical intervals remain separate. The shared Inspector links original source identities to existing terrain, encounter, event, entrance, Atlas and Field evidence. Reuse the current V1 Workspace, with explicit horizontal periodic coordinates and no regeneration. [Global Source GIS guide](docs/reference/global-source-gis.md).

**GaiaGIS v4.9.0 — World Variant Comparative Spatial Analysis** compares two manual WM0 source states at the same raw X/Z or along one transect. All source candidates, vertical intervals and independent branches remain visible; a simple height delta requires exactly one ordinary source on each side. Resource absence is separate from an in-region lack of hits. Reuse the existing private Variant JSON without rebuilding Workspace or GIS. [Comparison guide](docs/reference/world-variants.md#dual-state-spatial-comparison-v49).

**GaiaGIS v4.8.0 — Native Multi-Surface Query & Transect Analysis** adds all-source WM2/WM3 X/Z queries and source-linked SVG transects, retaining multiple heights, vertical intervals/bands and degenerate evidence. Raw units imply no unique ground or gameplay route. Existing Workspace, GIS and Native v1 contracts remain unchanged. [Native query guide](docs/reference/native-gis.md#multi-surface-position-query-and-transect-v48).

**GaiaGIS v4.7.0 — World Map Variants & Spatial Change Analysis** adds explicit private WM0 source research with cumulative reference states 0–4, exact geometry/attribute/UV/normal differences and independent Raw Variant GeoPackage export. This is source-level comparison, not verified story state or actual changed surface area. V1 canonical geometry, Workspace Manifest, Native GIS and Field products remain compatible. Maintained targets are **Web + Windows x64**. [World Variants guide and CLI](docs/reference/world-variants.md) · [Native GIS](docs/reference/native-gis.md) · [Field evidence and lab](docs/user/navigation.md#field-script-evidence-and-registration-lab).

For a source checkout:

```powershell
. tools/build/environment.ps1
npm --prefix web ci
python -m gaiagis local --source "YOUR_FF7_INSTALLATION"
```

Use Python 3.12+ and Node 24 in a source checkout. Fresh source geometry generation additionally needs GDAL/QGIS or a compatible existing Stage-1 cache; the Windows portable launcher uses its bundled stdlib transport. The source launcher incrementally generates **output/local-workspace**, connects it automatically and opens the browser. It never modifies game files. An existing Workspace can instead be imported into the ordinary Web Viewer without running the launcher. [Getting started](docs/user/getting-started.md).

## Windows Release

Approved new Releases provide one Windows x64 ZIP and `SHA256SUMS.txt`. GitHub Actions checks the exact annotated tag, runs Web and isolated package validation, and publishes only the verified Windows artifact after publication approval. Local candidate ZIPs are validation products. Optional GaiaJSON/GeoPackage exchange and FieldLocal export require GDAL-enabled Python; QGIS is not bundled. A Release is complete only after its public attachments and checksums are verified.

[Releases](https://github.com/Zaxaerith/ff7-GaiaGIS/releases) · [Release process](docs/development/release-process.md)

## Local FF7 workspace

Choose GaiaGIS's generated folder containing `gaia-workspace.json`, **not** the FF7 installation or raw `wm` directory. Data displays connection source, manifest and available geometry, locations, gameplay layers, routing, textures, WM2/WM3, transitions, Explorer, Atlas and presentation resources. [Workspace guide](docs/user/workspace.md) · [Format](docs/reference/workspace-format.md).

## Web Pages

To upgrade only the background resource in an existing source-matched Workspace:

```powershell
. tools/build/environment.ps1
python -m gaiagis field-visual --source "YOUR_FF7_INSTALLATION" --workspace output/local-workspace --audit output/dev/current/field-background-audit.json
```

Re-import the folder into the locally built v4.4 Viewer, select **Background Overlay** and expand **Background State Explorer**. The default is the static base; manually selected conditions are research previews. **Layers and compositing** contains layer switches and the explicit raw-position experiment. This command preserves unrelated Workspace products and existing research exports. Local development does not update hosted Pages or create a Release.

To add interaction evidence to an existing source-matched Workspace without rebuilding WM/GIS/background data:

```powershell
python -m gaiagis field-interaction --source "YOUR_FF7_INSTALLATION" --workspace output/local-workspace
```

In the **v4.1 or newer Web Viewer**, re-import that folder, open a Field Walkmesh and expand **Interaction geometry**. Older Workspaces work without this optional pack. An older public Viewer may not recognize the new resource; Pages deployment is separate from a Windows Release. Use the bundled or locally built Viewer until Pages is updated. [Interaction controls and limits](docs/user/navigation.md#field-interaction-geometry).

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
- World ↔ Field evidence navigation: independently chosen WM0 Default/Alternative entrances, directed Gateway arrival browsing, separate MAPJUMP identities and bounded session Back/breadcrumbs. Returning to World resumes its saved view; Field searches do not acquire invented world parents. [Navigation guide](docs/user/navigation.md#world--field-multiscale-navigation).
- Unified FF7-inspired shell, explicit Scientific theme, desktop/320/390px layouts and five languages.

## Documentation

[Getting started](docs/user/getting-started.md) covers browser setup, Workspace creation, World/Field browsing and the optional QGIS path.

Evidence is kept distinct throughout the Viewer:

| Level | Meaning |
|---|---|
| Verified source evidence | Original records, source hashes, identities and independently checked local geometry; this does not establish gameplay permission. |
| Research reconstruction | The frozen V1 reference sphere/projections and static Access analysis, with their stated assumptions. |
| Partial support | Original-camera viewing and manual background state previews; unsupported tiles are counted, and blending, scrolling and runtime occlusion remain incomplete. |
| UNKNOWN | Runtime story/Gateway conditions, complete background alignment, Field global positions and unverified world landings. |

FieldLocal uses raw units, never metres or geographic coordinates. Parsing cameras for 702 Fields does not mean their backgrounds are all accurately aligned.

[Explorer](docs/user/explorer.md) · [Save Explorer](docs/user/save-explorer.md) · [User Mapping](docs/user/user-mapping.md) · [Navigation](docs/user/navigation.md)

[Architecture](docs/reference/architecture.md) · [Coordinates](docs/reference/coordinate-spaces.md) · [Reconstruction](docs/reference/reconstruction.md) · [Atlas](docs/reference/atlas.md) · [Routing](docs/reference/routing.md) · [Spatial analysis](docs/reference/spatial-analysis.md) · [Cartography](docs/reference/cartography.md) · [GaiaJSON](docs/reference/gaiajson.md) · [Save format](docs/reference/save-format.md)

## Data / copyright policy

Public delivery contains code, authored summaries/provenance and required open-source dependencies. It contains no original FF7 assets, user saves, private workspaces/screenshots or complete derived geometry/POI datasets. No account, telemetry, automatic upload or cloud sync. Save bytes stay in session memory; user mapping stays local and is excluded from share URLs. [Policy](docs/reference/data-policy.md).

Steam 2026 executable equivalence remains **NOT VERIFIED**. WM2/WM3 have no fabricated global transform. Climate remains sealed [Experimental / Inconclusive](docs/research/climate-conclusion.md).

## Build / development

`src/gaiagis/_version.py` is the application-version authority. Unified CLI: `gaiagis local`, `build-workspace`, `validate`, `build-sphere`, `user-gis`, `field-gis`, `field-interaction`, `field-visual`. The checkout adapter preserves `python -m gaiagis.local` without installing globally.

`npm --prefix web test` · `npm --prefix web run build` · `npm --prefix web run build:release` · `npm --prefix web run audit:release`.

[Building](docs/development/building.md) · [Testing](docs/development/testing.md) · [Changelog](CHANGELOG.md). Private Python tests and all generated validation evidence stay ignored. Development completion does not publish automatically.
