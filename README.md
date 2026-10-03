# GaiaGIS

A mathematical GIS reconstruction of Final Fantasy VII's polygonal world map, with an interactive globe and multiple map projections.

**V1 Geometric Gaia is the canonical GaiaGIS reconstruction. V1 is a mathematical reconstruction, not official/canonical Final Fantasy VII geography.** The Earth-sized reference radius is an assumption, not a measurement of Gaia.

FINAL FANTASY VII WM0 → polygon mesh → periodic topology analysis → inverse-Mercator parameterization → Earth-sized Gaia sphere → GIS → interactive Web viewer → map projections.

This is a **code-only project**. The repository contains no FF7 game data, complete derived Gaia geometry, POI coordinates or derived encounter dataset. Users generate V1 data from their own installation and load it locally. v1.3 is a local release candidate pending publication approval; v1.2 remains preserved in local history. [v1.1 release notes](docs/releases/v1.1.0.md) · [Stable v1.0 notes](docs/releases/v1.0.0.md) · [Data policy](docs/data-and-copyright.md).

## Viewer

- Globe, Equirectangular, Mercator, Mollweide and draggable Orthographic hemisphere.
- Orbit/pan, wheel and touch pinch zoom, projection morphing, reset and north-up compass.
- Labeled 30-degree graticule, equator/0-degree longitude highlights, hemisphere coordinates and optional globe shading.
- FF7 gameplay terrain or region colors, complete observed-category legend, approximate region-center navigation, triangle grid and synthetic-cap distinction.
- Click/tap inspector retains source map/section/mesh/triangle lineage. Synthetic caps have no fabricated FF7 attributes.
- Responsive mobile sheets, keyboard map navigation, reduced-motion handling, loading retry and graphics-context recovery.
- About/help explains local setup, reconstruction assumptions, research status and licenses.
- Browser-local loading of gaia-meta.json + gaia-mesh.bin. Files are verified with SHA-256 and never uploaded.
- Optional named locations and field entrances, locally generated from your own installation: markers, major-location labels, category filters, name/alias/internal-field search, fly-to and entrance provenance inspection in all five projections.
- Traversal & Vehicles: static classic-PC terrain compatibility for On Foot, Buggy, water Tiny Bronco, five Chocobo variants and Submarine surface; separate Highwind landing initiation, four-state legend and comparison Inspector. Runtime/story state and reachability are not simulated.
- Optional World Encounters: Encounter Zones, raw Encounter Rate, independent Chocobo Tracks, and triangle encounter/Mystery Ninja/Chocobo metadata. Weights are not absolute probabilities; runtime state is not simulated.

TypeScript, Vite and Three.js; no backend or UI framework. d3 is a test oracle only. The browser needs WebGL2 and HTTPS or localhost for checksum verification. GPU/device performance varies.

## Run locally

Node.js 24 is used for validation (package minimum 22.12). From the project root:

```powershell
Set-Location web
npm ci
npm test
npm run dev
```

Open http://127.0.0.1:5173/. Existing locally generated V1 data in web/public/data/ loads automatically. A fresh source checkout shows a local-file chooser and setup help; it contains no game-derived geometry.

To generate the default V1 dataset, use your own FF7 installation, Python 3.12+ and an installed Windows QGIS/OSGeo4W runtime with GDAL/PROJ/PyQGIS. See [local GIS setup](docs/local-gis-build.md) for supported layout and configuration. From the project root, substitute your actual installation paths:

```powershell
. .\scripts\use_workspace_environment.ps1
python -m venv --without-pip .venv
.\.venv\Scripts\python.exe -B scripts\build_gaia.py --qgis-root 'YOUR_QGIS_ROOT' --source 'YOUR_FF7_INSTALLATION' --output output
.\.venv\Scripts\python.exe -B scripts\build_web_assets.py
```

The parser reads your game installation without modifying it. The default V1 build creates local GIS products; the Web exporter creates **web/public/data/gaia-meta.json** and **web/public/data/gaia-mesh.bin**. Run the Viewer as above, then use **About / help → Choose both V1 files** to select these two files together. They stay in your browser and are never uploaded. Local development also loads generated files automatically when present.

The Viewer accepts the fingerprinted default V1 transport, not arbitrary reconstructed or climate-modified datasets. The core FF7 parser independently discovers compatible layouts without an AppID or fingerprint-only rejection rule. Do not change reconstruction parameters when generating V1 data.

### Optional locations (v1.1)

```powershell
python -B scripts/build_poi_assets.py --source 'YOUR_FF7_INSTALLATION'
```

This creates **web/public/data/gaia-poi.json** using WM0 trigger triangles, world scripts, FIELD.TBL and your English flevel.lgp/maplist. In the Viewer, use **Display → Load Locations** after loading the original two V1 files. The POI dataset is locally generated from the user's own FF7 installation and is not distributed publicly. Without it, the map works normally. Search supports names, aliases and internal field names; selected locations expose every resolved entrance and its provenance. Gold Saucer and Northern Cave remain unresolved in the static trigger extractor. [Data schema and provenance](docs/v1.1/poi-data.md) · [Entrance research](docs/v1.1/field-entrance-research.md).

### Optional encounters (v1.2)

```powershell
python -B scripts/build_encounter_assets.py --source 'YOUR_FF7_INSTALLATION'
```

Generate **web/public/data/gaia-encounters.json**, then use **Display → Load Encounters**. This optional dataset binds enc_w.bin tables to existing triangle region/terrain lineage. Chocobo Tracks uses the independent MAP flag and works without the file. Gameplay terrain is not land cover, and encounter regions are not ecological regions. The lookup follows documented classic PC behavior; 2026 runtime code equivalence is not yet verified. No encounter dataset is distributed publicly. [Encounter research](docs/v1.2/encounter-research.md) · [Schema and generation](docs/v1.2/encounter-data.md) · [Local validation](docs/v1.2/validation.md).

### Traversal & Vehicles (v1.3)

Select **Display → Color layer → Traversal**, then a Movement mode. The small public rule profile reuses your local V1 terrain/script/lineage; **no additional dataset file is required**. Allowed means an ordinary static terrain mask passes, not guaranteed movement or story/runtime reachability. Highwind Landing shows initiation eligibility rather than airborne travel. Bridge history, boarding/candidate points and a Chocobo exit height gate remain explicitly separate. Current Steam 2026 runtime equivalence is not verified. Chocobo Tracks and Encounters remain independent. [Research and 32-terrain matrix](docs/v1.3/traversal-research.md) · [Profile/data](docs/v1.3/traversal-data.md) · [Local validation](docs/v1.3/validation.md).

## Production and release

```powershell
Set-Location web
npm run build          # local production; includes locally present data
npm run preview        # local production preview
npm run build:release  # public code-only artifact; excludes ALL public data
npm run audit:release
npm run preview:release
```

dist/ is for private local use. **Publish only dist-release/**: it contains application code and license notices, with no game-derived geometry, metadata or screenshots. Users open their private V1 files in the browser. Both directories are ignored by Git. GAIA_BASE_PATH configures a repository subpath; the default is ./.

The manual [Pages workflow](.github/workflows/deploy-pages.yml) builds and audits the code-only artifact. The hosted Viewer starts with a local-file chooser; it contains no geometry. [Web CI](.github/workflows/web-checks.yml) tests and builds a clean source checkout without FF7, QGIS or climate runs. See [release guide](docs/web-release.md) and [release validation](docs/web-v1-release-validation.md).

## Geometry and assumptions

WM0 has 142586 base triangles; V1 adds 9792 synthetic ocean cap triangles. Source connectivity and lineage are retained. Observed W=294912, H=229376 raw units lead to source latitudes +/-80.071528814895 degrees through inverse Mercator. The N/S cycle is cut; E/W stays longitude-periodic. Radius 6371008.8 m, vertical scale 1 m/raw unit and geographic orientation are reconstruction assumptions, not FF7 canon.

Stage 1 Float64 GIS products remain the coordinate authority. Web transport is Float32, 5.40 MB, with previously measured maximum spherical quantization error 0.424 m. Region navigation uses area-weighted spherical chord centroids and can be diffuse for broad sea regions; these are not POIs or field entrances. Gameplay terrain is not GIS land cover.

See [Stage 0 validation](docs/validation-report.md), [spherical reconstruction](docs/spherical-reconstruction.md), [Web format](docs/web-data-format.md) and [earlier Viewer validation](docs/web-viewer-validation.md). Historic screenshots and generated datasets remain local, ignored artifacts.

## Source and licensing boundaries

Climate V2/V2.1/V2.2 research is concluded **Experimental / Inconclusive**. It did not establish a physically robust replacement latitude mapping; no climate warp was adopted. Historical code and reports are preserved in [Research](docs/climate/README.md), outside the formal reconstruction and Viewer data.

FF7 datasets are read-only inputs. All local source, output, caches, browser profiles and temporary files stay in the project workspace. No proprietary MAP/BOT/LGP/TEX/executable assets, GIS products, transport binaries or screenshots enter Git.

**GPL-3.0-only applies to GaiaGIS original code**, see [LICENSE](LICENSE). Third-party code retains its own licenses and notices, including Three.js MIT; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This license grants no rights to FF7 or Square Enix assets.

Game-derived geometry publication status is **unresolved and separate** from code licensing. The code-only Pages workflow does not authorize future data publication. See [data and copyright](docs/data-and-copyright.md).

GaiaGIS is an independent fan-made technical and GIS research project. It is not affiliated with, sponsored by, or endorsed by Square Enix. FINAL FANTASY VII and related names, characters, world designs and assets are property of their respective rights holders. GaiaGIS does not claim ownership of FF7 world design.

© SQUARE ENIX  
CHARACTER DESIGN: TETSUYA NOMURA  
LOGO ILLUSTRATION: © YOSHITAKA AMANO

GPL-3.0-only applies to GaiaGIS original source code, not to FINAL FANTASY VII or third-party materials.
