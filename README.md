# GaiaGIS

An interactive GIS reconstruction of FINAL FANTASY VII's polygonal Gaia world map.
Explore geography, original local artwork, gameplay attributes and source provenance
in a globe, thirteen map views and native world maps.

**V1 Geometric Gaia is the canonical GaiaGIS reconstruction. It is a mathematical
reconstruction, not official/canonical Final Fantasy VII geography.** Its Earth-sized
reference sphere is an assumption, not a measurement of Gaia.

FINAL FANTASY VII WM0 → polygon mesh → periodic topology analysis → inverse-Mercator
parameterization → Earth-sized Gaia sphere → GIS → interactive Web viewer → map projections.

This public repository and its hosted Viewer are **code-only**. They contain no game
assets or complete derived geometry, textures, models, animations, POI, encounters,
events, routing, transitions or native/Explorer datasets. Generate a private local
workspace from your own installation, then open its folder in the Viewer. Local files
stay in the browser; there is no backend, upload, analytics or account system.

## Explore and inspect

- **Explore:** named locations and field entrances, search by name/alias/internal
  field, shortest-path fly-to, provenance Inspector and verified-entrance context actions.
- **Layers:** gameplay terrain/region, random encounter zones/raw rate, Chocobo Tracks,
  static terrain compatibility for 10 movement profiles, Highwind landing, spatial world
  events and source script-trigger highlighting.
- **Analysis:** conservative static reachability/routes over source topology, spherical
  distance/area, local projection scales/Tissot, linked projection comparison,
  independent movement-route comparison and four-class reachability comparison.
- **Map:** WM0 reconstructed Gaia, WM2 Underwater and WM3 Great Glacier as separate
  native3D/top-down maps. Transition provenance retains unresolved transforms.
- **View:** Globe, Equirectangular, Mercator, Mollweide, Orthographic, **Equal Earth**,
  Winkel Tripel, Robinson, Natural Earth I, Sinusoidal, Gall–Peters, Lambert Azimuthal
  Equal-Area and Azimuthal Equidistant. Adaptive labeled graticule, smooth morphing,
  original locally generated textures, filtering and visual relief.
- **Data:** one folder/multi-file workspace loader, per-asset status, source/hash checks
  and path-free diagnostics. Existing individual file choosers remain available.

**Explorer** offers third-person keyboard/touch previews using locally decoded original
models, skeletons and animation frames: Cloud/Tifa/Cid, Buggy, Tiny Bronco, five Chocobo
variants, Highwind, native WM2 Submarine and WM3 party previews. Explorer v2 borrows
loaded map surfaces rather than duplicating them; legacy v1 packs remain supported.
A persistent Exit HUD returns to the previous overview. Runtime gameplay is not simulated.

One primary sidebar/mobile drawer and a common context Inspector unify these workflows.
Desktop and320/390px mobile layouts, keyboard focus, reduced motion, and English,
简体中文, 繁體中文, 日本語 and 한국어 are supported. Safe view/panel preferences persist locally.

## Generate your local workspace

Python 3.12+ and Node 22.12+ are required. Run from the repository root:

```powershell
. ./scripts/use_workspace_environment.ps1
$env:PYTHONPATH = Join-Path (Get-Location).Path 'src'
python -B -m gaiagis.build_workspace --source "YOUR_FF7_INSTALLATION" --output local-workspace
cd web
npm ci
npm run dev
```

Fresh GIS generation needs GDAL/PROJ, normally an existing QGIS runtime. On Windows,
set `GAIAGIS_QGIS_ROOT` to your supported OSGeo4W/QGIS root if needed. The generator
can also reuse a compatible Stage 1 cache with `--stage1`; it never installs or modifies
QGIS or FF7. [Setup and usage](docs/user-guide.md) explains environment and compatibility.

In **Data → Open workspace folder**, select `local-workspace`. Alternatively choose
`gaia-workspace.json` and its files together. The manifest binds13payloads through
relative names, dependencies, sizes and hashes; optional files degrade independently.
The minimum legacy workflow still loads `gaia-meta.json` + `gaia-mesh.bin`. Individual
Locations/Encounters/Events/Textures/Routing/native/Explorer inputs remain supported.

The CLI runs existing stable exporters incrementally. Outputs, caches and temporary
files stay inside the repository and are ignored by Git. FF7 is strictly read-only.
Neither original files nor generated local datasets should be shared as release assets.

## Build and validate

```powershell
cd web
npm test
npm run build
npm run build:release
npm run audit:release
npm run preview:release
```

`build:release` produces an audited code-only application. It intentionally starts
without geography and supports local workspace loading. The manual Pages workflow
keeps this same boundary. WebGL2 and HTTPS/localhost are required; performance depends
on browser/GPU. [v2.0 validation](docs/v2.0/validation.md) records the local RC evidence.
No remote publication follows development automatically.

Public tests use synthetic fixtures; actual-source checks run locally when inputs
exist and explicitly skip in a clean checkout. Climate simulations are excluded from
application/release validation. Existing parser, geometry, gameplay and Viewer tests
remain regression coverage.

## Reconstruction and limits

WM0's 142,586 base triangles form a raw periodic surface. V1 cuts the N/S ocean seam,
retains E/W longitude periodicity and adds 9,792 synthetic cap triangles. Radius
6,371,008.8m, vertical scale 1m/raw unit, orientation and polar closure are reconstruction
assumptions. Stage 1 Float64 GIS is authoritative; Web transport is Float32.

Static classic-PC compatibility/routing is not current story/save/vehicle availability
or guaranteed reachability. Encounter weights are not absolute probabilities; source
terrain is not ecological land cover. Moving objects are static script anchors, not
current positions. Original animation uses explicit 30fps preview timing. Current
Steam 2026 executable runtime equivalence remains **NOT VERIFIED**.

WM2/WM3 retain native coordinates: no global mapping, bathymetry/polar fitting or physical
measurement is fabricated. LAEA/AEQD conservatively clip their antipodal singular region.
No projection preserves every area/shape/distance/direction property.

Climate V2/V2.1/V2.2 research is concluded **Experimental / Inconclusive**. It did not
establish a physically robust replacement latitude mapping; no climate warp is adopted
or selectable. Historical research remains preserved separately.

## Documentation

[User guide](docs/user-guide.md) · [Methodology](docs/methodology.md) ·
[Architecture](docs/architecture.md) · [Workspace](docs/v2.0/workspace-format.md) ·
[Compatibility](docs/v2.0/data-compatibility.md) · [Integration](docs/v2.0/integration.md) ·
[Performance](docs/v2.0/performance.md) · [Validation](docs/v2.0/validation.md).

Earlier research remains available: [source validation](docs/validation-report.md),
[V1 sphere](docs/spherical-reconstruction.md), [POI](docs/v1.1/poi-data.md),
[encounters](docs/v1.2/encounter-data.md), [traversal](docs/v1.3/traversal-data.md),
[events](docs/v1.4/world-events-data.md), [routing](docs/v1.5/routing-data.md),
[cartography](docs/v1.6/projection-analysis.md), [textures](docs/v1.7/texture-data.md),
[native maps](docs/v1.8/coordinate-spaces.md) and [Explorer](docs/v1.9/explorer-data.md).

## Licensing and rights

**GPL-3.0-only applies to GaiaGIS original source code**, see [LICENSE](LICENSE).
Third-party code retains its own licenses, including Three.js MIT; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The license grants no rights to FF7
or Square Enix assets. Game-derived dataset publication status remains unresolved
and separate from code licensing. See [data and copyright](docs/data-and-copyright.md).

GaiaGIS is an independent fan-made technical and GIS research project. It is not
affiliated with, sponsored by, or endorsed by Square Enix. FINAL FANTASY VII and
related names, characters, world designs and assets are property of their respective
rights holders. GaiaGIS does not claim ownership of FF7 world design.

© SQUARE ENIX  
CHARACTER DESIGN: TETSUYA NOMURA  
LOGO ILLUSTRATION: © YOSHITAKA AMANO

GPL-3.0-only applies to GaiaGIS original code, not FINAL FANTASY VII or third-party materials.
