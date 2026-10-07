# GaiaGIS user guide

The public Viewer contains executable code only. To see FF7 geography, generate
a private workspace from your own installation and load it in your browser.
No file is uploaded. WM0 is the V1 mathematical globe reconstruction; WM2 and
WM3 are separate native maps with no established global geographic transform.

## Recommended Local Start

For the v2.7 Windows portable candidate, extract the ZIP to a writable folder
and run `GaiaGIS/GaiaGIS.exe`. Select your own FF7 installation in the native
folder picker. The EXE contains its runtime and compiled Viewer; it needs no
Python/Node installation. Generated assets stay in its `output/local-workspace`.
Do not extract into the game installation. See [distribution](v2.7/distribution.md)
for build, license and isolated-process smoke details. The candidate is local
only until approved for publication.

Source-checkout development continues to use the following command.

Install Python 3.12+ and Node 22.12+. Once per checkout, run `npm ci` in `web/`.
From the project root:

```powershell
python -m gaiagis.local --source "YOUR_FF7_INSTALLATION"
```

No `PYTHONPATH` setup or manual file picker is needed in a source checkout. The
launcher checks source files/hashes, reuses valid generated assets, builds invalid
components, starts a loopback HTTP server and opens the browser. Default output is
`output/local-workspace`. Data reports **Workspace connected / Automatic local
workspace**, the validated manifest and the actual generated workspace folder.
WM0/WM2/WM3 geometry and their textures, transitions and Explorer are all adopted
when present. Map → Underwater or Great Glacier opens an already textured native map.

```powershell
./scripts/start_local.ps1 "YOUR_FF7_INSTALLATION"
# Next time (the wrapper remembered the source):
./scripts/start_local.ps1
```

The Python entry point remembers only when `--remember-source` is supplied. Its
ignored `.gaiagis-local.json` stays in this checkout; no Steam path is stored in browser
localStorage. If no source is available, an interactive terminal asks for its root.
`--no-open` keeps the browser closed. `--workspace` accepts a private subdirectory of
project `output/`, outside sealed evidence; `--rebuild` forces export, and
`--clean-invalid` removes only named invalid assets before export. Ctrl+C closes the
server. The default port is 5173, with conflict fallback. `--host 0.0.0.0` is an
explicit opt-in to serving beyond loopback; the default is always 127.0.0.1.

Fresh WM0 generation still needs QGIS/GDAL. Set `GAIAGIS_QGIS_ROOT` if necessary;
existing compatible Stage 1 products do not need rebuilding. `--debug` retains a
traceback for troubleshooting. A missing optional component is reported in the
terminal and Data panel; valid components continue loading.

Only Python reads the read-only installation. HTTP serves generated, manifest-listed
assets and executable Viewer files, never MAP/BOT/LGP/TEX/model source files. Nothing
is uploaded. Public Pages retains the manual workflow below and never scans disk.
The local output is regenerable: deleting it causes the next launch to rebuild it.

## Advanced / Manual Workflow

From the repository root, with Python 3.12+ and Node 22.12+:

```powershell
. ./scripts/use_workspace_environment.ps1
$env:PYTHONPATH = Join-Path (Get-Location).Path 'src'
python -B -m gaiagis.build_workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
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
`output/local-workspace`. If the directory picker is unavailable, the folder input or
**Choose workspace files** works: select `gaia-workspace.json` and its generated
files. Chrome may show a folder-read confirmation; it is user initiated.
Only recognized root files are read, never nested saves or arbitrary disk files.
Choose the **generated GaiaGIS workspace**, not the FF7 installation or its raw `wm`
directory. The Data help entry explains how to generate it and which files belong
there. A root `local-workspace` may be an older manual export; import it only if its
manifest is valid. The launcher default is always `output/local-workspace`.
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

WM0 supports nine party characters, Buggy, Tiny Bronco, five Chocobo variants and Highwind
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

## Presentation and party characters

In **View → Presentation**, choose FF7 Original-inspired or GaiaGIS Scientific.
The blue windows are original CSS, not copied game graphics. Focus rings and
disabled states remain explicit. Explorer Lighting offers Original-inspired
(moderate ambient + directional), GIS Flat and Debug Bright. These change only
models, not 2D map colors or reconstruction. A soft contact shadow is a viewer
approximation; it follows the surface and fades/widens with Highwind altitude.

The local launcher automatically generates/loads optional UI Sounds from your
installation. Enable the checkbox and choose volume; no audio plays until a
user gesture. Sounds may be completely disabled and never replace visible
feedback. Confirmation, cancel and selection navigation have verified cue IDs;
unresolved dialog-open audio stays silent. Missing audio/Public Pages remains
silent. Theme, light, mute and volume preferences contain no installation path.

Explorer has separate **Character / model** and **Movement profile** selectors.
Party (Cloud, Barret, Tifa, Aerith, Red XIII, Yuffie, Cait Sith, Vincent, Cid),
Vehicles and Chocobos are compact categorized groups. Six field-source additions
show an **Extended Explorer model** note: original assets with their own animation
bindings, not original world-map leaders. All share the established Foot preview;
no save/party ownership or leader rules are simulated. Switching retains a valid
source position; incompatible modes are rejected. Old packs show missing characters
disabled rather than substituting fake models. Native WM2 Submarine/WM3 party
previews remain available; Return to GIS disposes model/shadow and restores controls.

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


## Gaia Atlas (v2.2)

Atlas adds offline authored place knowledge, secrets and collectible/reward discovery to Explore search. Search names, aliases, categories, regions and item names; one-edit spelling fallback follows literal matches. The shared Inspector shows localized overview, type/region, access, gameplay, discoveries, related places, precision/evidence and reviewed sources. Sources are external links opened only when requested. The default spoiler setting hides major story rewards, including their search aliases; select Show all deliberately to reveal them.

Layers has Places, Secrets and Collectibles switches. Collectibles marks verified parent-place entrances only, never a chest or interior reward position. An entrance-level card enables existing route, measurement and Explorer actions. Parent-place/field-only cards offer Fly to parent place; unresolved records have no map point. Gold Saucer, Northern Cave, Ancient Forest and Sunken Gelnika retain searchable knowledge without guessed global placement. Native WM2/WM3 positions are never treated as geographic coordinates.

The local launcher generates the optional ignored `gaia-atlas.json` through the existing workspace builder, with curated-content, POI, source, transition and generator fingerprints. Warm reuse remains offline. Old workspaces without Atlas retain bundled knowledge with currently validated POI bindings. Public source-only pages can search/read knowledge without a spatial pack. No save-state, treasure-collected state, battle or field renderer is included.

See [research](v2.2/atlas-research.md), [schema](v2.2/atlas-schema.md), [spatial evidence](v2.2/spatial-binding.md) and [local validation](v2.2/validation.md). Source-only distribution remains mandatory; all generated packs and screenshots stay ignored.


## Navigation & Discovery (v2.3)

Search and inspect a place, then use Bookmark to save its identity, name and short
note. Explore → Bookmarks opens, edits or deletes saved items. Save current view
also preserves a bounded local camera and registered layer settings, including
native view mode. Recently viewed returns to the most recent 30 identities or
bookmarks, moving repeated entries to the front. Missing or spoiler-hidden IDs
remain unavailable rather than resolving to an invented point.

Nearby in the Inspector searches from a verified anchor. Explore → Nearby can use
the view center or a one-shot What's Here map selection. Choose nearest results or
50/100/250/500 km. Distances assume GaiaGIS's V1 reference sphere and require WM0
anchors. Parent/field-only rewards and unresolved entities have no reward distance.
Native maps and Explorer make the tool unavailable.

Add to tour from an Inspector card or bookmark, or build a tour from identity
bookmarks. Edit draft titles, stay duration and order, then save. Play/Pause,
Previous/Next and Stop control the tour. Resolved stops reuse Fly-to; unresolved
place cards remain informational. Reduced motion avoids large camera movement.
Stop/completion restores the captured overview. Map changes and Explorer pause it.

After Find Route, open Analysis → Route playback. Play, Pause, Restart, Stop,
0.5/1/2/4× speed and optional Follow display progress through the already solved
corridor. Follow camera movement is disabled by reduced motion. Playback does not
change the route solver, route length or source graph.

Layers → Layer opacity offers eleven suitable render layers; Map legend groups
existing terrain/gameplay keys and Atlas/analysis keys. Reset layers restores their
registered visibility/opacity defaults, including Secrets and Collectibles visibility,
without erasing the solved route. View → Local horizontal scale toggles a local
reference-sphere screen scale. It varies by projection, latitude and camera, and
hides where inversion/ray intersection is unresolved or in native/Explorer mode.

Copy link in View or the Inspector shares public identities and allowed UI fields.
It omits the current private camera, positions, hashes, path and route nodes. A public
link opens an authored Atlas card without a fake map point; local mode resolves its
current validated anchor. Sources links are fetched only after an explicit click.

Data → Clear local user data selects All, Bookmarks, Recent, Tours or Navigation
preferences and requires a second confirmation. It does not remove workspace files.
Unavailable/quota-exceeded storage retains edits in this session and displays a
warning. No account or cloud backup is provided. Optional tour import/export and an
overview minimap are deferred. See the [v2.3 state schema](v2.3/navigation-state.md).

## Explorer Locomotion & Spatial Analysis (v2.5)

Explorer separates appearance from movement: every party character uses the same
Foot navigation speed. Barret, Aerith, Red XIII, Yuffie, Cait Sith and Vincent use
their own reviewed original fast clips; Cloud, Tifa and Cid keep world-map clips.
Shift increases the existing movement speed and preview cadence. Backward Foot
motion reverses preview frames. This is Explorer preview timing, not verified Steam
timing; uneven terrain can still show discrete-frame foot sliding. Red XIII and
Cait Sith retain their own quadruped/hopping skeletons. See the
[character evidence table](v2.5/explorer-locomotion.md).

Load a generated workspace, open Analysis, select an origin, destination and
movement profile, then Find Route. The result adds three cards:

- Route Profile: cumulative corridor distance, configured Gaia display elevation,
  minimum/maximum height and ascent/descent. Inspect the SVG with the pointer or
  focus its range control and use arrow keys. Raw height assumes 1 m/raw for display.
- Terrain Composition: source terrain distances and percentages weighted by
  corridor segment length. The sampled corridor length is shown separately from
  the unchanged graph cost and may be longer.
- Encounter Exposure: static region/terrain set coverage, source scene tables and
  Chocobo-eligible flag distance. These values do not predict battles or probability.

Source Surface controls select Slope or Aspect. Slope is a direct source-TIN plane
angle with configured horizontal/vertical ratio 1/1; it is not physical globe slope.
Aspect uses north −Z/east +X, eight compass groups, and undefined flat/degenerate
faces. Layers supplies registered opacity, legends and Reset defaults for both.
Projection changes and Compare reuse the same source attributes.

Service Area uses the selected route origin, movement profile and distance threshold
(default 100 km). Calculate to highlight source triangles whose existing graph node
centers are within the network distance budget. Foot, Buggy, Tiny Bronco and five
Chocobos are supported. Include conditional matches the routing policy and is not a
runtime guarantee. An ineligible origin can yield zero nodes. The highlight is not
a continuous buffer, a precise boundary or a travel-time isochrone.

All six analyses require local WM0 data; routing/encounter results also require
their corresponding workspace resources. Public source-only mode displays clear
unavailable cards. Native WM2/WM3 and Explorer disable these overview tools.
No new workspace payload, account or upload is introduced.


## Personal GIS / User Mapping (v2.6)

With a loaded local WM0 overview, open Explore → Drawing and select a user layer.
Point places once; Line/Polygon add vertices with clicks or taps. Finish/Enter or
double-click completes; tap the first polygon vertex to close. Esc cancels a draft.
Compact screens close overlay docks when a drawing/edit tool starts; reopen Explore
for Finish or use the completion gesture. WM2/WM3 and Explorer drawing is unavailable.

Select a user feature on the map or in Layers → My Layers. The existing Inspector
labels it User-created and edits name, notes, comma-separated tags, layer and basic
style. Save applies changes. Edit vertices exposes drag handles. Select a listed
vertex before adding (then tap the map) or removing one. Move feature drags the
whole shape. Invalid edits leave the old geometry intact. Duplicate and confirmed
Delete are local actions; Fly to uses the first real vertex.

My Layers supports create/rename/reorder/visibility/opacity and confirmed nonempty
layer deletion. Names and tags enter unified Search. Actual Point placemarks can
join local Tours and Nearby; lines/polygons do not masquerade as point distances.
User geometry is never included in public Share links. All thirteen projections,
Globe and Compare reuse one stored GaiaGame geometry, never WGS84/EPSG:4326.

Export GaiaJSON downloads your authored layers/features as .gaiagis.json. Import
validates and appends with new IDs; failed imports do not modify existing data.
No automatic upload occurs. Data → Clear user data → My Layers selectively clears
mapping after confirmation. The single existing browser record has bounded size
and quota fallback; when the memory-only warning appears, export before closing.
Reference-sphere lengths/areas use R = 6,371,008.8 m and are not official FF7
physical measurements. See [schema/limits](v2.6/user-features.md) and
[exchange format](v2.6/gaiajson.md). GeoPackage/custom-CRS GIS export remains future work.

## My Save (v2.7)

Open Data → My Save → Import PC save and choose your own save00.ff7–save09.ff7.
The file contains fifteen slots; select a populated checksum-verified slot.
Inspector shows party levels/HP/MP, Gil, time, location IDs and raw progress.
Clear or reload removes the session. Nothing is uploaded, stored in user-state,
written back or added to Share URLs.

Field saves retain old world coordinates: they are displayed raw and cannot
Fly. For a verified WM0 world-module record with local geometry loaded,
Player Position can Fly, Explore from Here or Route from Player. Explorer is
only a preview and follows existing terrain/profile rules. Atlas Save Context
shows raw values without guessing chapters, unlocks or spoiler availability.
WM2/WM3 and unknown bindings receive no invented global point. See the
[format](v2.7/save-format.md) and [coordinate evidence](v2.7/save-spatial-binding.md)
for precise support and verification limits.
