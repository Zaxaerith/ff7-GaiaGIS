# Getting started

GaiaGIS is a local-first GIS viewer of the original Final Fantasy VII world. Public delivery contains code, authored knowledge and open-source runtimes; game-derived assets come from your own installation.

The Web Viewer is the main interface. Pages/static Web, the Windows launcher and a source checkout are three different ways to start. Hosted Pages and Windows Releases are published separately and can show different versions. This local v5.5.1 candidate still awaits the user's unified human acceptance.

## Choose your start

Without a valid map, the title screen shows a black/navy scene with original broad-blade vector artwork, a soft spotlight and four vertical choices. It does not need private geometry or a WebGL map. No game screenshot, model, font, logo or music is bundled.

| Choice | What it does | Required input |
|---|---|---|
| **Start exploring** | Resumes a connected map; otherwise offers guides, a prepared Workspace or Windows creation instructions | Full map needs your private Workspace |
| **Game guides** | Opens the existing Explore panel, search and Quick Start | None: read the 58 authored Atlas entries, subject to spoiler settings |
| **Load Workspace** | Opens Data and focuses the existing Workspace Folder button | A GaiaGIS-generated folder containing `gaia-workspace.json` |
| **Settings & help** | Changes UI language, opens existing display/data help, or advanced file controls | None |

Guides include treasures, Materia, secrets and boss clues. Their three Quick Start actions remain **Find a Materia**, **Find a hidden place** and **How to obtain a treasure**. Choosing guides expands this section even if previously collapsed. Use **Title screen** to return; this preserves the loaded Workspace, map/projection and current selection, including WM2/WM3 or Field views. **Return to map** or Escape resumes the connected view. With no map, Escape returns through the inline help to the title. Arrow keys/Home/End move menu focus; Tab and Enter retain native button behavior. Decorative fades respect `prefers-reduced-motion`.

A Workspace is converted GaiaGIS output, **not the raw game directory**. Static Web reads prepared Workspaces; it does not unpack an entire game installation or upload resources. PS1 discs, Remake/Rebirth and unverified arbitrary MOD data are outside the verified input contract. Without private data the public text works, while unavailable geographic anchors have no map action.

The title yields to a currently rendered, validated map, whether loaded manually or supplied automatically by the Windows launcher. It does not infer a connection from a prior visit. `gaiagis.seenIntro` only remembers Quick Start folding. Failed choices retain existing validation and a way to select another folder; rejecting a bad replacement preserves a still-valid old map. Returning to the title is session-only and never unloads data. Data replacement clears the old title subview.

## In-app menu

Four player-facing groups call the original six tool panels; feature owners, data and Inspector remain shared:

| Group | Existing tools |
|---|---|
| Explore the world | Explore locations, Nearby, bookmarks, tours, drawing; Map; Analysis routes |
| Guides & bestiary | Explore Atlas/search/Gameplay; Layers for separate static battle evidence |
| Map & GIS analysis | Analysis, Map, View/projections and Layers |
| Data & settings | Data/Workspace/Save/source diagnostics and View/UI settings |

The current group/tool path stays visible. The map starts with both drawers closed. **Menu** opens four compact text choices; choosing one folds the category list and shows its content. Expand **Tools in this section** to reach the original panel tabs. Close menu reveals the map; **Back** closes the Inspector without deleting the selection. At desktop and narrow widths, one floating drawer is shown at a time; drawers do not reduce the world/native viewport width. Escape closes an expanded navigation layer before closing its drawer. Source precision and spoiler settings remain unchanged.

## Neo-Classic interface

Title, Shell, Atlas, Gameplay details, Source Inspector and Field tools share the same system fonts, blue gradient windows, thin silver-blue borders, cyan diamond choices, input styles and evidence disclosures. The original title illustration now has a visibly leaning blade, distinct face/bevel/side planes and a shadow at the inserted tip. Its smaller heading and text-only choices leave the scene largely black.

Guide descriptions, acquisition methods and rewards are readable first. Enemy details show name, Level/HP/MP and formation membership before the original records. Technical hashes, Actor/script offsets, original source corners and topology endpoints remain available under closed **Raw source and technical details** disclosures. Area, slope, region/terrain IDs and GIS numeric values keep their original meaning; the theme does not alter analysis. Field toolbar/tool shelf, statistical tables and Workspace status use the same shared visual primitives. The optional scientific colour preference uses the same layout and interaction rules.

Deep Field registration/palette labs and older drawing/tour forms inherit the shared windows and controls, while retaining their existing specialist layouts. Browser-native pickers and operating-system window chrome remain native. Actual rendering, touch/virtual-keyboard behavior and Windows DPI still require human acceptance; no automated browser visual claim is made.

## Browser first

Open the source-only [Pages Viewer](https://zaxaerith.github.io/ff7-GaiaGIS/), or build the same code-only Viewer from a checkout:

```powershell
. tools/build/environment.ps1
npm --prefix web ci
npm --prefix web run build:release
npm --prefix web run preview:release
```

Open `http://127.0.0.1:5175/`. Read guides directly, or use **Load Workspace → Data → Workspace Folder** to select its generated folder containing `gaia-workspace.json`. The button uses the existing native folder picker or directory-input fallback; it never asks you to guess binary files. **Advanced: individual Workspace files** and the original V1 metadata/mesh pair are retained for developer exports (V1 controls under title Settings & help). The browser does not need the EXE, Python or QGIS to read a Workspace. Folder import is explicit and session-local: after a page refresh, select it again. Missing optional resources receive an unavailable notice; source-only Atlas/search remain usable.

To create a Workspace from source, use the [source checkout instructions](#source-checkout) below; to create it without developer tools, use the approved Windows portable package. Supply the supported original **FF7 PC data**, including the matching `data/wm` and `data/field` resources for Field features. Supported installation/data/wm/workingdir layouts are discovered by the existing parser. Copied complete supported data folders need no running FF7.exe. PS1 discs, arbitrary ports and Remake/Rebirth are outside this format contract.

## Windows portable

When an approved version's GitHub Release contains a Windows ZIP, extract the entire ZIP and run `GaiaGIS.exe`. The startup window lets you choose your own original FF7 installation, shows resource progress and opens the browser when ready. A successfully validated folder is remembered; the next launch reuses unchanged resources automatically. The launcher reads game inputs, generates `output/local-workspace` inside the extracted folder, starts a loopback server and opens the Viewer. Python, Node and QGIS are not required by the portable runtime. Extract into a folder you can write to (for example a folder you choose on a data drive), rather than running inside the ZIP or a protected directory. The EXE location determines the data root; there is no developer drive path or silently created AppData workspace. The initial build requires at least 256 MB of free disk space.

The native Tk launcher now shares the title's black/navy palette and original Canvas blade/light motif, with **Choose original FF7 folder** and **Start exploring / Retry**. UI language and EN/FR/DE/ES game-data language remain separate. Technical details are folded and expand on failure. Generation stays in the native launcher; the browser does not open a native original-game chooser or invoke Python over HTTP. No new local command/path endpoint was added. This two-stage presentation preserves the existing restricted read-only loopback transport.

If validation fails, select the installation root again and use Start / Retry; Remake/Rebirth folders and folders without the required original-game data are not supported. Details identify the missing input. Cancellation waits for the current resource to finish; restarting checks which completed resources can be reused. Closing the launcher stops its local server. Occupied/reserved ports are skipped automatically.

A valid launcher-provided Workspace enters the map directly without another manual picker or welcome overlay. Automatic loading uses the existing loopback capability and source/hash checks; static Pages does not probe that service. Explore retains the game Quick Start and folded GIS/session tools (places, Save, drawing, routes and data help). Data identifies the actual automatic/manual connection. Atlas map actions still require a verified anchor or clearly labelled parent place; source details remain folded.

Local candidate ZIPs are developer validation products, not official Release artifacts. Source ZIP/TAR downloads alone are not Windows executables.

To browse a place's local scene geometry, open its Atlas card → Field Context,
select a scene and choose **Open Field Workspace**, then **Walkmesh**. Select triangles by clicking/tapping
or by triangle ID; drag to pan and use the zoom/reset buttons. This is a local XY
plan with optional raw-Z colouring, not a global map or playable Field engine.
Older workspaces keep their scene connections but need incremental generation for the
optional Walkmesh pack. The Graph/Walkmesh main viewport shares scene selection with the Inspector and returns to the original World camera. [Field workspace controls](navigation.md#field-spatial-workspace). Public mode never contains original-game scene geometry.

## Distribution target

Maintained targets are Windows x64 portable ZIPs and the Web Viewer. macOS distribution maintenance and cloud builds have stopped; retained historical implementation has no current support or build guarantee. Original legally held **FF7 PC data** is required for private Field resources; PS1 discs, arbitrary ports and Remake/Rebirth are not supported. FF7.exe is never run.

Camera/background preview is under **Field Walkmesh → Spatial visualization**. A compatible private Workspace supplies manual camera records and the supported static tile subset. Public mode and older workspaces retain Plan View with an unavailable notice. An existing compatible Workspace needs no rebuild just because the application version changes. [Controls and limitations](navigation.md#field-camera-and-background).

## Source checkout

Use Python 3.12+ and Node 24. In the checkout:

```powershell
. tools/build/environment.ps1
npm --prefix web ci
python -m gaiagis local --source "YOUR_FF7_INSTALLATION"
```

Fresh source geometry generation needs Python with GDAL/OGR, or a compatible existing Stage-1 cache. On Windows, set `GAIAGIS_QGIS_ROOT` to an installed QGIS/OSGeo4W root if ordinary Python lacks `osgeo`; the CLI uses the existing runtime adapter. The Windows portable runtime generates its Viewer transport without GDAL. Optional GIS exchange/export requires GDAL-enabled Python in either workflow; it is not bundled with the Viewer.

For an existing generated folder, run `python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace` using that same output location. Compatible components are reused. Do not delete the old Workspace or perform a full rebuild solely to update the Viewer. Re-select the resulting folder in **Data → Workspace Folder**. [Workspace details](workspace.md).

For an installed CLI, install into a workspace-local virtual environment with `python -m pip install -e .`, then use `gaiagis local --source "YOUR_FF7_INSTALLATION"`. The small root adapter also preserves `python -m gaiagis.local` in an uninstalled checkout.

All developer environments, temporary files and outputs stay in the checkout. The retained POSIX helper is historical compatibility code; macOS is not a maintained build or acceptance target.

## First private browsing session

1. In World, select WM0 and try Globe or any of the thirteen projections. Compare shares the existing world views. World measurements use the frozen reference sphere, not measured canonical FF7 geography.
2. Select Midgar and an explicitly offered verified Default/Alternative Field entrance. Exact local entry requires matching source hashes, identity, Triangle ID and XY validation. Field search can open a scene without inventing a world parent.
3. In Field Workspace, choose Graph or Walkmesh. Pick a triangle or an anchor; raw coordinates and original record evidence appear in the shared Inspector. FieldLocal has no geographic reference or metre scale.
4. Expand Network Analysis and run reachability from a validated entrance/arrival, or an explicit triangle. WCC/SCC and minimum-hop paths follow original directed Access; they do not simulate game/story conditions.
5. Select a Gateway to inspect its original source line and target evidence. Exact 3D candidates retain ambiguity. A verified target arrival can be viewed in its own Field; MAPJUMP remains identity-only. Use Back or Return to World to restore the prior context.
6. Choose Original Camera View or Background Overlay with private visual resources. Cameras use the original matrix/Zoom; the static background is partial. No independent layer transform is used to force alignment. Runtime camera selection, occlusion and complete background alignment remain UNKNOWN.
7. For research in QGIS, use the optional [single-Field GeoPackage export](workspace.md#fieldlocal-geopackage-research-export). Keep each Field separate with Undefined Cartesian SRS -1 and raw units. A research copy cannot be written back to the game.
8. With the optional [Interaction Pack](workspace.md#optional-field-interaction-resource), expand **Interaction geometry** in Walkmesh. Select a Trigger or Script LINE on the Canvas or Inspector list; the plain-language explanation precedes raw evidence. Constant SLINE is a separate modification preview; dynamic SLINE/LINON remain script evidence. Exact candidates may relate to a static BFS region or background tile records, never to a proven gameplay trigger. No interaction GIS layers are added to GeoPackage v1.

[Navigation](navigation.md) describes controls and provenance; [coordinate spaces](../reference/coordinate-spaces.md) separates raw evidence from the reference-sphere reconstruction. A decoded original record, a correct mathematical projection, a reconstructed static image and runtime visual alignment are different claims.

## Viewer without game data

The source-only [Pages Viewer](https://zaxaerith.github.io/ff7-GaiaGIS/) opens public authored Atlas cards, search and local user state. It does not contain the complete derived map or original textures/models. Missing spatial anchors remain unavailable.

See [Workspace](workspace.md), [Explorer](explorer.md), [Save Explorer](save-explorer.md), [User Mapping](user-mapping.md) and [development](../development/building.md).
