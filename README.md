# GaiaGIS

Current main source: **v2.5.0 — Explorer Locomotion & Spatial Analysis**.
Published baseline: **v2.4.0 — App Shell, UI Unification & Workspace UX**.

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
workspace from your own installation. The local launcher loads it automatically over
localhost; the public Viewer retains folder/file loading. Nothing is uploaded; there
is no cloud service, analytics or account system.

## Explorer Locomotion & Spatial Analysis (v2.5)

The six Extended party models now select their own reviewed fast locomotion clips.
All nine party appearances retain identical Foot displacement. Cadence is explicitly
Explorer preview timing; original Steam runtime timing and perfect foot lock remain
unverified. No cross-character retargeting is used.

Analysis adds source-TIN route elevation, distance-weighted terrain composition,
static encounter-set exposure, source-space slope/aspect and network service areas
over the existing routing graph. Heights use configured 1 m/raw display elevation;
network distances use the existing assumed reference sphere. These are static
analysis results, not encounter RNG, travel time or official FF7 physical geography.
No new spatial pack is needed. Native maps and public source-only mode explain
unavailable analyses without fabricating results.

See [user guide](docs/user-guide.md), [locomotion](docs/v2.5/explorer-locomotion.md),
[methods](docs/methodology.md) and [local RC validation](docs/v2.5/validation.md).
The accepted v2.5 source is on main. Tagged releases and Pages deployment remain
separate publication steps.

Python tests and private QA/research harnesses are retained only in the existing
local development checkout. GitHub CI runs the Web suite and build/release audits;
fresh clones do not include the private test suite. See
[local testing policy](docs/development/local-testing.md).

## App Shell & Workspace UX (v2.4)

The default FF7-inspired interface now shares one component palette across the
header, docks, Inspector, cards, dialogs and controls. Docks stay inside the viewport,
scroll internally and collapse independently; compact screens use overlay drawers.
Scientific is an explicit theme choice using the same component system.

Data shows the connection source, validated manifest and individual resource states.
Use the launcher to generate and automatically connect **output/local-workspace**.
For manual import, choose the generated folder containing **gaia-workspace.json**,
not the FF7 installation or raw **wm** directory. Textures are available in View,
native maps in Map, and characters in Explore → Explorer.
See [workspace UX](docs/v2.4/workspace-ux.md) and [validation](docs/v2.4/validation.md).

## Navigation & Discovery (v2.3)

Explore now includes browser-local Bookmarks, Recently Viewed, Nearby and Guided
Tours. View bookmarks preserve a local camera; safe Copy Link shares public IDs
and allowlisted interface settings without private coordinates. Routing adds
playback over the existing solved corridor. Layers adds eight opacity controls
and a consolidated legend; View adds a screen-local reference-sphere scale.

Public source-only mode retains authored Atlas cards, identity bookmarks, recent
history and informational tours. Spatial discovery requires an existing validated
local anchor. User data is origin-local and is never uploaded.

See [user state](docs/v2.3/navigation-state.md), [Nearby](docs/v2.3/nearby.md),
[tours/playback](docs/v2.3/tours.md), [safe sharing](docs/v2.3/share-state.md),
[scale/layers](docs/v2.3/scale.md) and [local validation](docs/v2.3/validation.md).

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
models, skeletons and animation frames: all nine party characters, Buggy, Tiny Bronco, five Chocobo
variants, Highwind, native WM2 Submarine and WM3 party previews. Explorer v2 borrows
loaded map surfaces rather than duplicating them; legacy v1 packs remain supported.
A persistent Exit HUD returns to the previous overview. Runtime gameplay is not simulated.

**FF7-inspired Presentation:** original CSS blue-gradient windows with a Scientific
theme option, accessible focus states, model color correction, moderate lighting
and soft contact shadows. Optional original UI sounds are generated privately
from your installation and require a user gesture; public delivery stays silent.
The six added party characters use verified original field assets and their own
animation bindings, explicitly labeled **Extended Explorer models**, not recovered
world-map leaders. See [v2.1 data/provenance](docs/v2.1/presentation-data.md).

One primary sidebar/mobile drawer and a common context Inspector unify these workflows.
Desktop and320/390px mobile layouts, keyboard focus, reduced motion, and English,
简体中文, 繁體中文, 日本語 and 한국어 are supported. Safe view/panel preferences persist locally.

## Recommended Local Start

With Python 3.12+ and Node 22.12+, install Viewer dependencies once:

```powershell
cd web
npm ci
cd ..
python -m gaiagis.local --source "YOUR_FF7_INSTALLATION"
```

Run the Python command from this repository root. It discovers and fingerprints
MAP/BOT/LGP/flevel data, incrementally generates `output/local-workspace`, builds or
reuses the code-only Viewer, starts `127.0.0.1`, and opens your browser. All available
geometry, textures, Locations, Encounters, Events, Routing, WM2/WM3, Transitions and
Explorer load automatically. Underwater and Great Glacier are immediately textured.
Optional generation failures are reported without preventing the base Viewer.

On Windows, `./scripts/start_local.ps1 "YOUR_FF7_INSTALLATION"` also remembers the
source in ignored `.gaiagis-local.json`; subsequent runs need only
`./scripts/start_local.ps1`. The Python command remembers only with `--remember-source`.
Use `--no-open`, `--port`, `--workspace`, `--rebuild` or `--clean-invalid` as needed;
Ctrl+C stops the local server. An occupied port advances to the next available port.

**Privacy:** only the local Python process reads game files. The browser receives
manifest-listed generated workspace assets from localhost. The installation is never
served, absolute source paths stay out of the UI, and nothing is uploaded. Pages has
no local auto-discovery: folder/file and individual loaders remain its fallback.

[Local launcher details and validation](docs/v2.0/local-workspace.md).

## Advanced / Manual Workflow

Python 3.12+ and Node 22.12+ are required. Run from the repository root:

```powershell
. ./scripts/use_workspace_environment.ps1
$env:PYTHONPATH = Join-Path (Get-Location).Path 'src'
python -B -m gaiagis.build_workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
cd web
npm ci
npm run dev
```

Fresh GIS generation needs GDAL/PROJ, normally an existing QGIS runtime. On Windows,
set `GAIAGIS_QGIS_ROOT` to your supported OSGeo4W/QGIS root if needed. The generator
can also reuse a compatible Stage 1 cache with `--stage1`; it never installs or modifies
QGIS or FF7. [Setup and usage](docs/user-guide.md) explains environment and compatibility.

In **Data → Open workspace folder**, select `output/local-workspace`. Alternatively choose
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


## Gaia Atlas (v2.2)

Atlas adds offline authored place knowledge, secrets and collectible/reward discovery to Explore search. Search names, aliases, categories, regions and item names; one-edit spelling fallback follows literal matches. The shared Inspector shows localized overview, type/region, access, gameplay, discoveries, related places, precision/evidence and reviewed sources. Sources are external links opened only when requested. The default spoiler setting hides major story rewards, including their search aliases; select Show all deliberately to reveal them.

Layers has Places, Secrets and Collectibles switches. Collectibles marks verified parent-place entrances only, never a chest or interior reward position. An entrance-level card enables existing route, measurement and Explorer actions. Parent-place/field-only cards offer Fly to parent place; unresolved records have no map point. Gold Saucer, Northern Cave, Ancient Forest and Sunken Gelnika retain searchable knowledge without guessed global placement. Native WM2/WM3 positions are never treated as geographic coordinates.

The local launcher generates the optional ignored `gaia-atlas.json` through the existing workspace builder, with curated-content, POI, source, transition and generator fingerprints. Warm reuse remains offline. Old workspaces without Atlas retain bundled knowledge with currently validated POI bindings. Public source-only pages can search/read knowledge without a spatial pack. No save-state, treasure-collected state, battle or field renderer is included.

See [research](docs/v2.2/atlas-research.md), [schema](docs/v2.2/atlas-schema.md), [spatial evidence](docs/v2.2/spatial-binding.md) and [local validation](docs/v2.2/validation.md). Source-only distribution remains mandatory; all generated packs and screenshots stay ignored.
