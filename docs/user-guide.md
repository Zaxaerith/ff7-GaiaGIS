# GaiaGIS user guide

The public Viewer contains executable code only. To see FF7 geography, generate
a private workspace from your own installation and load it in your browser.
No file is uploaded. WM0 is the V1 mathematical globe reconstruction; WM2 and
WM3 are separate native maps with no established global geographic transform.

## Generate and run

From the repository root, with Python 3.12+ and Node 22.12+:

```powershell
. ./scripts/use_workspace_environment.ps1
$env:PYTHONPATH = Join-Path (Get-Location).Path 'src'
python -B -m gaiagis.build_workspace --source "YOUR_FF7_INSTALLATION" --output local-workspace
cd web
npm ci
npm run dev
```

Fresh WM0 GIS generation needs GDAL/PROJ, normally through an existing QGIS
installation. On Windows set `GAIAGIS_QGIS_ROOT` to its OSGeo4W/QGIS root when it
differs from the launcher's documented default. The CLI reuses the existing QGIS
environment helper; it does not install QGIS. An existing compatible Stage 1
directory can be supplied with `--stage1`. Ordinary Python can reuse that cache.
The generator reads the game, writes inside this repository and checks source
hashes again. Never use the game installation as an output directory.

Open the URL printed by Vite. Under **Data → Open workspace folder**, select
`local-workspace`. If the directory picker is unavailable, the folder input or
**Choose workspace files** works: select `gaia-workspace.json` and its generated
files. Chrome may show a folder-read confirmation; it is user initiated.
Only recognized root files are read, never nested saves or arbitrary disk files.
The legacy two-file chooser for `gaia-meta.json` + `gaia-mesh.bin` still works.
Optional files may also be loaded independently through their established inputs.

Data lists Loaded, Legacy, Optional, Missing, Loading, Incompatible, Corrupt and
Unsupported states. A bad optional file cannot replace the base geometry. Supply
matching generated files to recover; do not rename another map's texture pack.

## Panels and navigation

- **Explore:** search location names, aliases, internal field names and entrances;
  transition results identify source/target maps. Select a result or marker to
  fly to it and inspect provenance. No visually guessed coordinates are added.
  Explorer starts from a verified entrance or an actual surface pick.
- **Layers:** terrain/region, random encounters/rate, Chocobo Tracks, traversal,
  world events and script triggers. Tracks and Chocobo traversal are independent.
  Each gameplay layer retains source triangle lineage.
- **Analysis:** static routing, reference-sphere distance/area, projection
  distortion/Tissot and comparison. Shared From/To inputs select known locations.
  No routing data means routing actions are unavailable. Measurements require WM0.
- **Map:** switch WM0 Overworld, WM2 Underwater or WM3 Great Glacier. Transition
  records show evidence and unresolved transforms; Open target map does not
  pretend its geographic registration is known.
- **View:** thirteen projections, surface style, original textures/filtering and
  visual relief. These change appearance, not canonical coordinates.
- **Data:** unified loading, per-asset status and path-free diagnostics/copy.

The context Inspector presents location/entrance, triangle, event or transition
provenance. Set a verified location as route start/end, measure from its coordinate
or explore from its entrance. Surface selections also support centroid-based
measurement. This is a derived navigation/measurement point, not an FF7 trigger.

On mobile, the top-left menu opens one bottom drawer; a selection closes it and
opens the context Inspector. Escape closes the drawer and returns focus to its
button. Tab navigation uses Left/Right/Home/End. Projection comparison stacks
vertically at narrow widths. Explorer keeps its touch pad and independent Exit
HUD visible; exit restores the overview camera and prior controls.

## Explorer and analysis limits

WM0 supports party leaders, Buggy, Tiny Bronco, five Chocobo variants and Highwind
flight/static landing. WM2 Submarine and WM3 party movement are explicitly native
geometry previews. Original frames use 30fps preview timing, not verified 2026
engine timing. No save file, story state, ownership, battle execution or live
vehicle position is simulated. Routing is conservative static classic-PC analysis,
not guaranteed gameplay reachability or travel time. V1's reference radius and
vertical scale are assumptions. See [methodology](methodology.md).

Language, valid projection/grid/style choices and the last primary panel are
stored as browser-local preferences. Texture style is restored only once a valid
texture pack is loaded. Onboarding is shown once and can be skipped with Start
Viewer. Browser storage permission failure does not prevent local operation.

## Production and troubleshooting

```powershell
cd web
npm test
npm run build
npm run build:release
npm run audit:release
npm run preview:release
```

Use HTTPS or localhost, a WebGL2-capable browser and sufficient GPU memory.
The code-only production preview deliberately starts without geography. Missing
datasets are expected; load your local workspace. If a hash/map/version fails,
regenerate or load the matching set. Diagnostics can be copied without exposing
installation paths or decoded data. Generated files/screenshots stay ignored and
must not be included in a public release. Publication requires separate approval.
