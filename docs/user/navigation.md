# Navigation

## Evidence-aware Journeys (v5.7.0)

Open **World → Exploration journey**. Select a place/guide and **Add stop**;
the first stop is the departure. Add up to six stops including it. Use the up,
down and remove controls to set the visiting order. Repeat places are allowed.
Choose one movement scenario and **Plan route**. Conditional terrain is off by
default; enabling it is a planning assumption, not verified bridge or story state.

Place and guide Inspectors also offer **Add to journey**. Parent-place rewards
keep their location warning; a Field-parent reward requires confirmation before
its related place can participate. Field-only goals remain reference material,
are labelled as excluded from routing, and cannot serve as the departure.
Without private Workspace/POI/Routing data, public guide text and the ordered
draft remain usable but no path or length is fabricated.

Successful results show continuous graph distance and each leg. **Show complete
route** restores its display after professional Routing; **View leg** highlights
that leg and opens the existing Inspector with real source nodes/entrances,
scenario, graph distance and distinct display-corridor length. Existing place
markers show stop numbers; repeat visits can share one marker with several
numbers. The map has no new chest/reward coordinates. Inspector Back, task
navigation and projection changes preserve valid calculations. Source or
Workspace replacement keeps only draft identities and requires planning again.

Foot Midgar → Kalm → Junon is not connected in this static graph; Green/Black/Gold
give continuous routes under their own assumptions. Do not interpret failure as
proof that the original game is impossible, or success as guaranteed runtime
traversability. There is no automatic Field crossing or vehicle transfer.

**Export place Tour** saves eligible place identities to the existing local
Tours list, in order, including repeat visits. It is a separate camera itinerary,
not saved Journey evidence, character autoplay or route solving. Journey itself
is not persisted to UserState, URL, Save or a Workspace asset.

## Task-based navigation (v5.6.0)

The five destinations are **World**, **Character Explorer**, **Game Guide**,
**GIS Analysis**, and **Data & Settings**. They change the visible controls,
not the current map, Workspace, projection or active walking session. The old
`PanelId` groups still host their original controls internally; Layers,
Analysis, Map and View are no longer visible navigation levels.

**GIS Analysis** opens a searchable tool directory with four static headings:
Regional & Terrain, Network & Paths, Source & Topology, and Map Display. A
heading is neither a submenu nor a disclosure. Choose **Regional Connectivity
& Boundaries**, **Routing**, **Source Query**, **Projection**, or another task
directly. The operation header offers **Tool directory** and **Show map**.
Reopen the current task using its map button or the GIS destination. Parameters
and still-valid computed results remain with their original owners; navigation
does not create historical snapshots of overwritten calculations.

The Inspector is the existing shared object view. Selecting a source face,
place, guide or gameplay record opens it, including reselecting the same face.
**Back** closes only the Inspector and returns to the originating tool or guide
search, with its focus context. It does not clear the selection or calculation.
**Clear selection** is a separate explicit action. Escape first cancels temporary
capture, then returns from Inspector, operation to directory, or content to map.

At 1200px and wider, tools and Inspector can occupy opposite sides of the map.
Below 1200px only one content pane is visible. Below 700px the destinations form
a single bottom row; the operation is the sole active content layer and the
Inspector uses roughly 47% of the available map height. Hidden content is inert
and cannot receive Tab focus. Close or collapse panes to regain map space.

Character Explorer presents the existing character and foot controls directly.
Changing destinations does not exit a walk. Navigation, search, Inspector and
other controls release movement keys; focus the map or touch pad to continue.
Source picks and measurement/drawing captures pause when their tool is hidden,
while already produced results remain. Field and WM2/WM3 keep their real spatial
owners; returning through navigation never silently converts them to WM0.

Public source-only mode keeps authored guides available and explains missing
private geometry. Load a generated Workspace through **Data & Settings**.
**Return to title** and help are also there; they preserve the current session.

## Field Interaction Geometry

With the optional Interaction Pack loaded in the v4.1 Web Viewer, open **Field Walkmesh → Interaction geometry**. Trigger, Script LINE, constant SLINE modifications and geometric anomalies have separate controls. Trigger uses dash-dot lines and T labels, LINE uses dotted lines, and SLINE modifications use long dashes; square endpoints distinguish them from Gateway lines and entrance/arrival points.

Choose a record by type in the Canvas controls or from the shared Inspector list. A Canvas click on overlapping lines offers a list of original records, including a Gateway when applicable, rather than silently preferring one. The Inspector begins with a plain-language explanation, then shows raw endpoints, all exact candidate triangles, classification and source evidence. Candidate-triangle buttons return to ordinary triangle inspection. An ID identifies a raw ground triangle, not a named geographic place. On narrow screens close the Inspector to use Canvas controls; its own record selector lets you browse records without closing it.

**Fit visible interaction lines** explicitly includes enabled original endpoints. Disjoint geometry stays at its original coordinates. **Reset view / Home** restores ordinary mesh bounds, so far-away records do not redefine the default scene view. Pan, wheel/pinch zoom, keyboard selection and camera projection share the existing Canvas. Behind-camera/unprojectable lines remain available as raw Inspector records and receive an omission count.

SLINE modifications are off by default and are never described as the initial scene state. Dynamic SLINE shows banks/operands, with no invented XYZ; LINON is control evidence and never automatically switches Viewer layers. All Actor/script aliases remain available in expandable evidence. A conservative decode stop means coverage is incomplete, not that the remainder contains no interactions.

Run reachability from a validated entrance/arrival or explicit Triangle ID using the existing Network Analysis. Its interaction summary distinguishes exact candidates in/out of the reachable triangle set from insufficient geometry. XY-only/Disjoint records never become verified topology links. Background associations compare `tile.state & (1 << trigger.state)` in validated conditional tile records; no background condition is activated. Story conditions, collision range and actual gameplay triggering remain **UNKNOWN**. No global coordinates, metre distances or cross-Field route are inferred.

Missing optional interaction data leaves earlier Field features usable. [Incremental generation and compatibility](workspace.md#optional-field-interaction-resource). FieldLocal GeoPackage v1 remains unchanged; this version does not add interaction GIS layers or write game data back.

Use the existing three-column Viewer: Explore/search/tools on the left, World
or Field in the centre, and one shared Inspector on the right. World browsing
uses Globe/projections or the independent native WM2/WM3 views. Field browsing
uses scene identities, Graph and raw local Walkmesh; changing the view does not
convert these coordinate spaces into each other.

For a connected private Workspace, select a WM0 place and explicitly choose a
[verified Field entrance](#world--field-multiscale-navigation), or search a scene
and open [Field Workspace](#field-spatial-workspace). Its anchors, static network
and camera/background tools are described below. World reference-sphere routes
and measurement are separate from Field-local topology and raw units.

v3.9/v4.0/v4.1 have completed browser human acceptance. This does not establish
original-game runtime behavior. Public source-only mode has authored identity
browsing and local user tools, with explicit unavailability for private geometry.

## Game Guide (v5.5.1)

Open **Explore → FF7 Game Guide**. The visible Places, Treasures & Rewards, Materia, Secrets and Boss clues buttons browse the same Atlas used by search. Each page has at most ten guides. Type an item, localized name or alias in the existing search box; **More filters & spoilers** retains the original spoiler controls. The default hides major spoilers; **Show all** exposes all 58 authored entries. A category click clears other advanced filters while retaining the spoiler choice.

Quick Start offers **Find a Materia** (Knights of the Round), **Find a hidden place**, and **How to obtain a treasure** (Kalm). Read descriptions and obtaining/challenge instructions without importing data. An entrance, parent place and Field scene have different precision labels. **Locate parent place** never means an exact chest location. Matching private POI data enables appropriate map buttons; Field-only Ancient Forest and Sunken Gelnika have no world marker. Related scenes use the existing Field Workspace when its resources are present.

**Boss clues & battle evidence** contains the already sourced Godo and Snow challenge knowledge. Its separate **View static battle evidence** action opens the existing World Events layer filtered to battles. These raw `scripted_battle` records do not identify named bosses or prove current triggering. On narrow screens opening a guide swaps Explore for the shared Inspector; close it with × or Escape to return to the map, then reopen Explore. Locating an entrance closes the narrow Inspector so the map can be seen. Desktop Explore can remain open beside the Inspector.

Data formats, actual retained Workspace file sizes and the absence of a Web SQL backend are described in [data formats and scale](../reference/data-formats-and-scale.md).

With the optional Gameplay asset imported, expand **Original game evidence** below Game Guide to browse item/Materia instructions, formations or enemy records. It reuses the same search field, with 25-row pages and the shared Inspector. Original names retain their game-data language. These raw records have no spoiler grading; collapsing the section removes them from search. Related guides still obey Atlas spoiler settings. Field cards show grant/battle counts and original Actor/Entry evidence, not chest or collection totals. In an active Field view, formation/enemy detail expands inside the same Field Inspector without replacing the Canvas.

The existing Godo/Snow guide cards can display the reviewed original battle chain. **View source formation** links to its original enemy records; related guides link back. **Locate parent place** remains only a parent entrance action. A four-instruction Materia sequence is not four pickups. Missing Gameplay data leaves the public text intact; changed Context/archive/profile fingerprints cannot reuse prior evidence. Original encounter records can link to formations when the precise table source and record match, without changing encounter gates or Routing.

## Personal browser state

Personal browser state is independent of `GaiaWorkspace` and project schemas.
No account, sync endpoint, telemetry or upload is involved.
The single owner is `UserStateStorage`, using `gaiagis.user-state` in localStorage.
Schema is `gaiagis-user-state`, version 1. Existing language, presentation and
legacy view settings retain their established owners; there are no separate
bookmark, history or tour storage keys.

The allowlisted document contains bookmarks, recent items, tours, and navigation
preferences (eight layer opacity values, ten registered visibility values and scale visibility).
Validation rejects unknown fields, malformed identities, duplicate record IDs,
invalid or degenerate cameras, mismatched-map selections, timing/opacity, excessive arrays and oversized serialized input.
Version 0 `favorites` identities migrate into version 1 bookmarks. Unknown future
versions and corrupt input recover to empty session state. Unavailable storage or
quota errors preserve edits in memory and display that persistence is unavailable.
There are no workspace blobs, screenshots, route arrays or copied Atlas facts.

Bookmarks support Location, Atlas, Entrance and Transition identities. Identity
bookmarks store kind, ID and map ID, name, short note and creation time. They resolve
against current navigation owners when opened. Renaming edits local text; deleting
also removes bookmark history references. Missing identities or spoiler-hidden
entities produce an explicit unavailable message. Local View bookmarks additionally
save bounded camera position/target/up/zoom, projection center, map/view mode, layer
preferences and an optional identity selection. Native view cameras remain native;
they do not acquire geographic coordinates. Public mode can save a view without a
camera. Camera values stay local and are excluded from links and tours.

Recently Viewed holds at most 30 items. Reopening an identity or bookmark moves its
existing entry to the front. It records the four supported identity kinds and
bookmark opens, never incidental triangle picks. Entries resolve names from current
owners rather than preserving copies of Atlas summaries.

Data → Clear local user data offers All, Bookmarks, Recent, Tours or Navigation
preferences. A second in-app dialog confirms the selected operation, with Cancel
focused first. Resetting navigation preferences restores v2.3 opacity/visibility
and scale defaults. It does not delete workspace files or reset older theme/audio/
language settings. Clear does not make an external request.

Limits: 200 bookmarks, 30 recent entries, 30 tours, 100 stops per tour; input JSON
is limited to 400,000 characters. A larger valid edited state stays in memory with
an explicit persistence warning rather than being saved as unreadable input. Browser storage is origin-specific, so localhost
and public Pages have separate personal states. There is no cross-origin sync.

Personal bookmark names, notes and saved tour names are preserved across UI locale
changes; they are not implicitly translated.

## Nearby and What's Here

Nearby resolves existing navigation owners; it does not geocode authored prose.
Only validated WM0 Location/Atlas place/Transition anchors with exact-source,
verified-anchor or entrance-level authority enter the index. Duplicate Atlas and
Location representatives at the same point are shown once per group. Entrances
remain bookmarkable but are not repeated as Nearby places.

Parent-place, field-only and unresolved rewards are excluded. Their parent place
may independently appear as an eligible place; no reward is assigned that parent's
distance or a fake exact point. Spoiler-hidden entities are removed by the existing
Atlas registry before indexing. No new locations, bindings or precision upgrades
are authored in this version.

The small index precomputes unit vectors and performs a linear scan. Great-circle
distance is `R * atan2(norm(cross(a,b)), clamp(dot(a,b),-1,1))`, with existing V1
reference radius 6,371,008.8 m. This is horizontal reference-sphere distance, not
surface terrain length, route length or a measurement of canonical FF7 geography.
Tests cover the antimeridian, poles, coincident anchors and radius exclusion.
Measured real-workspace query timings and eligible/excluded counts are recorded in
[validation](../development/testing.md).

Explore → Nearby offers nearest results or 50/100/250/500 km radius, bounded to
20 displayed results grouped into Places, Secrets and Transitions. An Inspector
Nearby action uses that entity's verified anchor. Near view center uses the existing
resolved geographic center. What's Here arms a one-shot canvas point selection,
using the existing projection inverse or a reference-sphere ray intersection.
That transient point is never added to storage or links. Outside the inverse domain
there is no fabricated result. WM2/WM3 native maps and Explorer make Nearby
unavailable; no WM0 transformation is invented for native maps.

## Guided Tours and Route Playback

Tours are version-1 user state records: ID, name, creation time and ordered stops.
A stop contains an ID, identity target, duration (1–120 seconds) and short title.
There are no coordinates, route nodes, snapshots, game assets or copied knowledge.
WM0 Location, Entrance, validated Transition and Atlas place identities are supported.
View bookmarks and native targets are excluded from the builder. Atlas places
without a current anchor can be informational card stops, with no camera Fly-to.
Reward records are not navigable tour stops.

Inspector → Add to tour builds a draft. Bookmarks → Add to tour or Tour from
bookmarks reuses identity bookmarks. Draft stops allow title/duration editing,
reordering and removal before saving. Saved tours persist in the central local
state; Edit copies stops to a new draft, allowing an independently saved tour.
There is no cross-map cinematic controller. Tour export/import and a built-in
sample tour are deferred: neither is required for this local RC.

Controls are Play, Pause, Previous, Next and Stop. The controller resolves each stop
against current owners, opens its card and reuses existing GaiaViewer Fly-to.
Missing/hidden stops are skipped. Reduced motion uses immediate existing focus,
not large camera animation. Pause stops the current flight and hold timer. Completion
or Stop restores the captured overview map/projection/camera/layers/selection.
Starting one playback pauses the other; applying a saved view pauses both.
Map changes and Explorer entry pause playback; disposal cancels callbacks and
restoration. No second camera system or Explorer autoplay is introduced.

Route Playback consumes only the current solved runtime corridor. The routing
worker, Dijkstra, graph, weights, movement profiles and result distances are unchanged.
The progress overlay has a prebuilt geometry sharing the current route's position
and visibility buffer attributes. Each tick changes an even draw range; it does not
rebuild geometry or solve a route. Projection morphing uses the existing projected
route buffer. Private points remain runtime-only.

Route controls are Play, Pause, Restart, Stop, speed 0.5/1/2/4× and optional Follow.
Follow samples existing corridor points through the existing focus method at most
about eight times per second; reduced motion disables Follow camera changes. Manual
camera navigation remains available. Map changes or Explorer pause playback;
replacing/clearing the route resets playback. Playback does not claim character
movement, terrain traversal animation or real-time FF7 travel speed.

## Safe ShareState and deep links

`gaiagis-share-state`, version 1, is an explicit allowlist. Copy link constructs
language, map ID, projection ID, native view mode, registered layer IDs, spoiler
mode and an optional public Location/Atlas identity. It never serializes AppState.
The encoder clears the incoming query, fragment and URL credentials. HTTP(S)
origins only are supported; file/data/javascript origins are rejected.

URL fields are `lang`, `map`, `projection`, `view` (native only), `layers`, `spoilers`,
and at most one of `place` or `atlas`. Known five-language/map/projection/layer/spoiler
values and the existing public authored-content identity lists are checked. Duplicate
parameters, unknown fields, invalid values, private IDs, conflicting targets and URLs
longer than 1,000 characters are rejected. A stale public target is discarded while
valid map/UI state can still load. Invalid links leave the standard application usable.

Example: `?place=midgar`. With the current local validated POI this opens the existing
Location/Atlas context. In public source-only mode it opens the Midgar authored Atlas
card with no spatial marker or camera Fly-to. Local automatic loading waits for the
workspace to finish before applying a target, so late owner adoption cannot erase it.
Spoiler-hidden targets remain hidden; links do not override the requested spoiler mode.

Forbidden values include latitude/longitude, XYZ, native positions, camera state,
triangle/section/mesh/node IDs, source hashes, route arrays, workspace payloads,
source paths, credentials, screenshots and local bookmark/view IDs. Local View
bookmarks may contain bounded camera state, but Copy link explicitly omits it.
The UI states this omission and exposes the safe link for manual copying if clipboard
access is unavailable. No share service, automatic upload or remote persistence exists.

Source links inside Atlas cards retain explicit click-only navigation. Sharing and
offline discovery do not fetch a Wiki page, article HTML, prose or image.

## Field Spatial Workspace

Search `mds5_1` in Explore, select the Field result and choose **Open Field
Workspace** in the existing Inspector. Atlas → Technical → Field Context and
Explore → Field Context provide the same entry. Graph and Walkmesh occupy the
main viewport; the Inspector keeps source evidence, parent locations, verified
Entrance actions and raw triangle properties. Its header toggle expands or
collapses properties on compact screens.

Scene selection, Graph/Walkmesh, breadcrumbs and return controls stay at the
top. **Spatial visualization** groups Plan/Camera/Background, Raw Z and zoom;
**Spatial anchor layers** groups Entrances, Gateway Segments and Arrival Points;
**Network Analysis** keeps Components, Reachability, Path and Clear together.
These are the existing tools, with their original coordinate/analysis semantics.
Panel fold state is retained across redraw and locale changes in this session.

The Inspector puts the selected triangle/anchor and its analysis before scene
relationships. Camera matrices, tile records and the longer source chain can
be expanded under **Original records and source evidence**; record IDs, offsets,
hashes and anomalies are retained. Geometry and UNKNOWN limitations remain
visible in their appropriate summaries. Field selection hides the World-only
route-start/end and spherical measurement actions and explains that FieldLocal
uses raw units. Return to World to use those world tools.

Selecting a new scene, anchor or different triangle brings the Inspector's
current selection into view. Analysis, redraw and resize preserve reading
position. Source/Target navigation focuses the scene selector; selecting an
adjacent Triangle ID returns keyboard focus to the Canvas.

The workspace has three view states: World Map, Field Graph and Field Walkmesh.
Graph and Walkmesh share one selected scene and the existing private Field pack.
Use the scene selector or a Graph node to switch directly, for example
`mds5_1 → Graph → mds5_2 → Walkmesh`. Selecting another scene resets Triangle ID;
switching Graph/Walkmesh within a scene retains it and reuses the decoded mesh.
Return to World Map keeps the original map ID, projection, camera and zoom.
An active Compare remains configured and resumes with the same Viewers. World
controls are suspended until return. Finish/cancel active drawing, measurement,
Explorer or route/tour playback before entering; GaiaGIS reports a conflict and
keeps those states intact.

Walkmesh fits the actual container and display pixel ratio. Drag with mouse or
one finger to pan; use the wheel, pinch or ± controls to zoom. Zoom keeps the
cursor/pinch anchor in the raw plane. Reset fits the scene again. Click/tap a
triangle or enter its zero-based ID to locate it. Arrow Left/Right selects IDs,
Home resets and ± zooms when the canvas has keyboard focus. The Inspector shows
three original XYZ vertices and each fourth raw component, three directed access
targets, blocked `0xFFFF` edges and non-reciprocal adjacency evidence. Click an
accessible Triangle ID to select/locate it in the same canvas. Gold is selection,
blue is outgoing adjacency, pink edges are blocked and green edges are static
access. Invalid IDs leave the previous valid selection intact. Raw Z colour is
optional; it does not establish metres, physical height or global elevation.

Graph initially shows the selected scene and direct neighbors, with parent-place
or all-scene filters available. Arrows preserve direction; solid Gateway and
dashed MAPJUMP 0x60 edges retain their separate source offsets. Unresolved edges
remain Inspector evidence, not invented traversable routes. Graph layout is not
a coordinate system. FieldLocal remains raw scene-local XY/XYZ, neither Gaia
Geographic, WGS84 nor EPSG:4326. No guessed Gateway markers, north arrow or
geographic scale is drawn. The Field modes do not run game story scripts.

On 390px/320px screens, entry collapses the panels so the canvas uses available
space; tapping a triangle opens its properties. Collapse Inspector to continue
panning. The return button stays in the workspace toolbar. Escape from a focused
canvas/Graph returns one session step when available, otherwise to World.
Escape in text/select controls, existing dialogs,
search, drawing or Explorer keeps the original owner behavior.

Only connected private, source-matched packs provide real geometry. Public Pages
keeps the workspace entry and an explicit unavailable state without probing local
assets automatically. Scene decoding is lazy and stale requests are discarded on
scene/mode/source changes. Closing the workspace removes its observers, input
capture/listeners and scheduled redraw; no Field animation loop remains.

For repeatable acceptance, run the existing `npm --prefix web run test:browser`
against a built local Viewer with `GAIA_BROWSER_URL` and `GAIA_CHROME_PATH`, inside
the checkout-scoped temporary environment described in the development guide.
It checks real `mds5_1`, `bugin1c` (496 triangles), `nivl_b1` and `mtcrl_0`, camera
bookmark equality, mobile touch, five locales, invalid/corrupt/missing resources,
source-only fallback and lifecycle cleanup. This is browser evidence on the test
host. Windows portable smoke is a separate check. Windows x64 is the only
maintained native distribution; historical macOS build code is unmaintained.

### World ↔ Field Multiscale Navigation

Select a WM0 Location, Entrance or its Atlas place and choose **View verified
Field entrances**. The list preserves **Default** and **Alternative** as separate
original records, even when they lead to different scenes. Choose a record
explicitly; GaiaGIS never selects the first candidate automatically. All nonempty
FIELD.TBL records are local entry evidence, not necessarily verified world points.

Exact entry navigation requires the original WM0 entrance/ENTER_FIELD 0x318 and
FIELD.TBL identities to agree, a matching maplist Field, an available private
Walkmesh, valid Triangle ID and original XY inside or on that triangle. POI,
Context and Walkmesh source fingerprints must agree. Failed or incomplete checks
provide identity browsing only, with a reason; they do not snap the point, fly to
a guessed world location or silently select another record. Older Context v1/v2
and public source-only data retain basic Field browsing without exact entry actions.

A verified Midgar entry can open `mds5_5` in Walkmesh, select its original
FIELD.TBL marker and Triangle 16, and retain the source record in the shared
Inspector. **Analyze from this validated anchor** follows directed Access only;
the audited source reaches 85/87 triangles and excludes isolated 82 and 83.
At `farm`, Default Triangle 10 and Alternative Triangle 79 are independent
starts; neither is replaced by Triangle 0.

The Field toolbar shows a compact evidence breadcrumb and **Back one step**.
World-origin entries retain their original place context; direct Field search
begins with scene identity, without an invented world parent. Gateway, MAPJUMP
and FIELD.TBL remain different relation types. History holds at most 32 snapshots
in the current session and is cleared when data changes or the workspace closes.
It is not added to Bookmarks, Recently Viewed, Tours, ShareState or the browser
URL. Back restores the prior scene, triangle/anchor and relation context. Return
to World resumes the saved map, projection, camera, zoom, Compare and layers,
without restarting the World Viewer.

For Gateway evidence, **View original source segment** selects the source Field's
raw line; **View target scene** follows the directed target identity. A valid
target XY/Triangle plus a revalidated 3D source intersection selects the target-only Arrival Point. XY-only/disjoint source records open identity browsing without automatic local placement. For example, the audited
`mds5_1` Gateway 0 retains both source candidates 115 and 116 and targets
`mds5_3` at raw XY `(172, 373)`, Triangle 40. Back returns to the source evidence.
This is viewing the recorded transition destination, not executing a game move.

Only exact three-dimensional source intersections can associate a Gateway with
reachable triangles. XY-only or disjoint records remain visible with their
limitations. Missing target geometry can still provide an identity-only view.
MAPJUMP 0x60 provides its separate script identity/offset and does not acquire a
Gateway line, arrival coordinate or Triangle ID. The existing SVG Graph preserves
direction and relation evidence; its layout is not geographic space.

WM2/WM3 relations and `wm*` pseudo-scenes never borrow WM0 geographic anchors.
Without verified native entry geometry, world landing remains **UNKNOWN**.
FieldLocal XYZ remains scene-local raw data: no WGS84/Gaia Geographic conversion,
metres, inferred interior world point or cross-Field shortest route. Static Access
reachability, the existence of a transition record and runtime Gateway permission
are separate facts; runtime permission remains **UNKNOWN**.

The same actions work with keyboard focus or touch in compact layouts. Back and
Escape respect text inputs, selectors, dialogs, search and existing Explorer
ownership. To manually accept the flow, enter `mds5_5` from a verified WM0 record,
run reachability, browse `mds5_1` Gateway 0's source and target evidence, return
one step, then return to World and compare the saved camera/projection. No game
data or unrelated GIS regeneration is needed for this frontend feature.

### Field Spatial Anchors

In Walkmesh, expand **Spatial anchor layers** to toggle Entrances, Gateway
Segments and Arrival Points. Gold circles are Default FIELD.TBL entrances;
hollow gold circles are Alternative records. Teal diamonds are arrivals from
other scenes. Purple lines intersect the exact 3D mesh, dashed amber lines
intersect only XY coverage, and dashed red lines do not intersect the mesh.
Abnormal source lines retain their original endpoints and participate in Fit.

Click a marker or use **Select anchor** for keyboard access and overlapping
records. The shared Inspector switches between anchor and triangle properties.
Selecting a Triangle ID restores triangle selection. Scene switches clear the
previous sub-selection. Source/target Field buttons follow the existing scene
selection without returning to World. A world-map pseudo-target remains an
identity label; it does not gain a Field-local arrival point.

The Inspector retains raw XY/XYZ, Triangle ID, direction bytes, record index,
section-relative offset and source hashes. FIELD.TBL and Gateway destinations
have no recorded Z: **Derived Raw Z** comes from the specified triangle plane.
Coordinates are raw Field-local units, without metres or global transformation.
Geometry does not establish runtime passability; script/story conditions remain
UNKNOWN. Gateway evidence stays distinct from MAPJUMP.

An older private workspace can still display its Graph/Walkmesh, with an explicit
anchors-unavailable notice. Run the ordinary local launcher against your own
supported original PC data to regenerate the Field component incrementally;
do not use a full rebuild solely to upgrade anchors. Public Pages supplies no
private anchors and never probes the local game installation.


### Field Static Network Analysis

Expand **Network Analysis** in the existing Walkmesh view. **Components** uses
WCC or SCC colouring; the Inspector lists deterministic component IDs, sizes,
current triangle membership and members. Isolated triangles have no Access
connection to another triangle, even when a raw self-link is present.

**Reachability** follows only the three original directed Access slots from the
chosen Triangle ID. The Inspector reports BFS depth, reachable/unreachable
counts and ratio. Select a validated entrance or arrival marker, then choose
**Analyze from this validated anchor**. Default and Alternative records remain
separate starts; arrivals belong only to their destination Field.

**Path** finds the minimum number of Access crossings within this scene. Equal
paths use source slot order 0/1/2. The Inspector preserves the Triangle ID
sequence, section-relative Access offsets and asymmetric/mismatched evidence.
▶ marks the start, ■ the end, blue reachable triangles, dim triangles unreachable,
and green the topology path. A zero-crossing path contains the start triangle;
no-path results distinguish different WCCs from directed disconnection.

Only exact 3D Gateway intersections supply candidate triangles. All candidates
are retained, including ambiguity; clicking a result selects its raw source
segment and outlines candidates. XY-only records are excluded and disjoint
association remains UNKNOWN. Reaching a candidate means topology connects to
Gateway geometry, never verified runtime passage or a route to another Field.

**Clear Analysis** restores ordinary mesh browsing. Scene/mode changes, return
to World and replacement data clear inapplicable selections; mesh-scoped caches
cannot carry results between sources. Existing v1/v2 contexts can analyze their
compatible Walkmesh without anchors. Context v3/Walkmesh v1 and generators are
unchanged: v3.5 workspaces need no regeneration for this frontend feature.

All output is **Static Walkmesh Topology — Not Verified Gameplay Reachability**.
There is no character walking trace, metre distance, reverse-edge repair,
story-condition simulation, global Field route or camera/background registration.


## Field camera and background

In **Walkmesh → Spatial visualization**, select Plan View, Original Camera View or Background Overlay. Original Camera records keep their own IDs; selection is manual, with no inferred runtime condition. Raw Z and zoom controls are in the same group. Opacity, mesh edges and Triangle IDs affect browsing only. Background and projected geometry share the same pan/zoom; independent position/rotation/scale corrections are unavailable. Returning to Plan restores its pan/zoom. Triangle/anchor selection and directed network results stay in the existing Inspector. Expand its original-record details for the full matrix, offsets and tile evidence.

The Inspector retains raw R (nine S16 Q12 components), t (three S32 camera-space translations), repeated Rzz, four extra bytes, U16 Zoom and Section-2 byte offset. `q = (raw R / 4096) XYZ + t`, `u = Zoom qx/qz`, `v = Zoom qy/qz`; screen Y is downward. The camera centre is `-inverse(R)t`, not t. FOV uses the original 320×240 logical viewport; the 224-pixel display crop does not replace 240. Source-tile screen bounds are distinct from declared layer dimensions. Camera Fit uses the 320×240 viewport plus source-tile bounds, not extreme projected vertices near the view plane; the dashed frame preserves the original logical viewport. Geometry outside it is not relocated and can be inspected with shared pan/zoom. No units become metres or global coordinates.

With Visual Pack v2 (`field-visual-3` or `field-visual-4`), Layer 0 and unblended Layer 1 support 4-bit indexed, 8-bit indexed and verified PC16 direct-color pages. Layer 0 ignores its unused condition/blend operands and uses 16×16 tiles. Unconditional Layer 1 can cover placeholder colours and extend the static footprint. The referenced page supplies pixel depth; the tile's unused raw depth is preserved as evidence. Green remains an ordinary opaque colour. Indexed transparency follows the original Palette flags and index-zero rules; PC16 word zero is transparent and `0x0821` is opaque black. PC16 is decoded separately from Palette RGB555. Every page span, UV rectangle and Palette reference is validated.

Expand **Background State Explorer** in the same spatial visualization group. **Show static base** starts enabled; selected conditional tiles start disabled. Choose one **Background Group** and **State Bit**, then enable **Show selected conditional tiles** to view the manually chosen combination. **Reset to static base** clears it. The panel reports visible, unsupported and total original tiles, associated Triggers and expandable raw tile evidence. A partial selection remains visibly labelled partial; an empty supported selection is reported explicitly. The image retains source depth/sub-ID order and shared Camera/Walkmesh pan/zoom. Changing a state reuses current-scene pixel data.

A Trigger's state is a bit number; a tile's state is a mask. Their static relationship is equal Group plus `tile.state & (1 << trigger.state)`. In Interaction geometry, selecting a Trigger exposes its Group/bit and matched tile evidence without changing the preview. Use **Preview associated background state** to deliberately select that combination. `mds5_1` has the fixed source associations Group 4/bit 0/8 tiles, Group 2/bit 0/9 tiles and Group 3/bit 0/7 tiles; `elm` has eight Trigger state bits in Group 1. These relationships do not prove any Trigger fired.

The unconditional base and the user's selected conditions are separate from the game's actual enabled state, which remains **UNKNOWN**. The preview is labelled **Research background state preview; not a verified original runtime state**. Finding a BGON/BGOFF or other background/Palette instruction does not establish its execution. No storyline, branch, script variable or event is simulated. Older Visual v1 packs preserve their original static preview and explain that state evidence needs v2; missing visual data preserves ordinary Walkmesh/Camera browsing.

Inconsistent Group/mask operands remain unsupported. Tiles outside the bounded ±4096 target preview retain original coordinates and validated source references, but have no pixels and do not expand the preview bounds; this does not prove how the game uses those records. Applicable omissions remain counted as partial. Generator 4 adds indexed Type 1/2 integer blending; Type 0/3 and PC16 blends remain unsupported. Layer 2/3 retain their original 32×32 size and descriptors; generator 4 can display their research pixels only under the explicit Experimental raw-position controls. Original runtime camera-dependent scrolling/wrapping has not been reconstructed. Animation, Palette changes and runtime depth occlusion also remain unverified. Unsupported counts remain visible rather than adding guessed alpha or replacement art. `static_complete` means applicable unconditional-base tiles are reconstructed; it does not claim complete runtime backgrounds. Conditional selections have independent completeness counts. Near-zero/negative-depth triangles and unprojectable markers remain omitted without relocation. Camera matrices, Zoom, local XYZ, Walkmesh and background scale are never adjusted to make an overlay appear aligned.

Format rules were checked against Makou Reactor `PalettePC::color/isZero`, `BackgroundTilesIOPC::tilePC2Tile` and `BackgroundTexturesPC::originInData` ([source revision](https://github.com/myst6re/makoureactor/tree/2452025714c033d698d1754a776bdcd5713427bd/src/core/field)), and LGP Explorer `parseTile`, `parsePaletteSection`, `getTextureRGBA` and `getTilesByRenderOrder` ([source](https://github.com/maciej-trebacz/ff7-lgp-explorer/blob/6c6338a3feba0e2b65f4f6cab5dd648cf6aed336/src/fieldfile.ts)). The latter's stored sub-ID tie order is used for the static subset; this is an editor-format comparison, not execution of either editor or proof of original-game runtime order. No engine code is copied.

Evidence levels remain separate: raw parsing; mathematical projection; static tile reconstruction; visual correspondence; original runtime comparison. The retained v1 regression checks for the audited files show `mds5_1` Camera 0 placing 455/489 vertices in the original Layer-0 bounds and 457/489 in the corrected static footprint (raw Layer-1 tiles extend its bottom from Y=240 to Y=256); Camera 1/2 remain 0/489. `bugin1c` remains 287/1488 and `nivl_b1` 300/336, although the latter's v1 static footprint extends its top from Y=-208 to Y=-224. V2 uses the original tile footprint, including retained unsupported evidence within the bounded preview, so its own rectangle counts are checked separately. These rectangle counts are reproducible regression checks, not registration-error measurements. No camera parameter changes accompany the expanded raw tile footprint. Runtime alignment remains UNKNOWN. Human acceptance should compare original-game captures at known camera IDs and crop/scroll state; do not tune layers until they appear to match.

### Background layers and compositing

Under Field Camera → Background Overlay → Background State Explorer, expand **Layers and compositing**. Layer 0/1 are the default. Indexed Type 1/2 use corroborated PC integer add/subtract equations; unsupported modes are counted and omitted. Toggle individual layers, use opaque-only rendering, or mark blend tile borders for research. None of these controls changes camera/XYZ or Walkmesh.

Layer 2/3 need the explicit Experimental raw-position switch as well as their layer checkbox. Their original 32×32 tiles retain raw X/Y and stored Z/Sub ordering, while runtime scroll/wrap/dynamic depth remain unknown. Reset restores the static base and default layers. A manual Group/State selection or explicit Trigger preview may include these pixels under the same experimental assumption. This is not a script, story or original initialization simulator. Older packs without these pixels retain their original preview and show an upgrade explanation.


## Field script evidence and registration lab

Open a Field Walkmesh and expand **Spatial visualization**. **Background / Palette
script evidence** provides opcode, actor/slot, Group, Layer and offset filters.
Select a record to inspect its raw operands, source hashes, static entry owners
and unknown runtime effects. Coverage details include stopped and uncovered
ranges. Empty scenes are valid. Missing optional evidence leaves the other Field
tools usable. Selecting BGON/BGOFF changes no pixels; only **Preview associated
background state** explicitly applies a research Group/state selection.

**Camera projection diagnostics** inspects a vertex of the currently selected
triangle or a selected verified point anchor. It shows source XYZ, original
R/T/Zoom, q, screen pixels and current Camera-mode Canvas pixels. Screen X/Y
queries list every projected footprint candidate; enable **Inspect Canvas taps**
to query in Camera/Overlay mode. Background Tile evidence requires a decoded
Overlay. Selecting a Tile gives 2D evidence without inventing XYZ. Occlusion,
actual game state and unique screen-to-space identity remain unknown.

**Spatial Registration Lab** accepts a private bounded non-interlaced 8-bit RGB
or RGBA PNG. Images remain in this session. Register the game/FFNx/renderer,
resolution, frame/entry condition, Camera and image processing metadata; unknown
fields stay unknown. Enter explicit screen and reference pixel rectangles, then
apply the mapping. No crop, scale or alignment is guessed. Click a reference
pixel (or enter its X/Y), select a source vertex/anchor, optionally record manual
uncertainty, and add a point. A **visual-only** mark records a 2D feature without
counting as a geometric correspondence.

Residuals show predicted/observed pixels, vectors, RMS, median, maximum, valid
count and exclusion reasons. No eligible points means no RMS, rather than zero.
Small samples do not establish scene-wide accuracy. Side-by-side viewing is
available; overlay/difference require an explicit mapping and acknowledged crop,
scale, filter, sRGB/HDR metadata. Characters, animation, lighting and unknown
state can explain differences. A screenshot difference is not a registration
proof. Synthetic framework success is not original-game runtime verification.

**Export research record** deliberately downloads a separate private JSON without
the image or original filename. Keep it private: manual local XYZ and frame
metadata can be research data. **Release reference frame**, Camera/Field changes,
Workspace replacement and World return release the image and points. No image is
uploaded or included in a shared link. Without a real frame the Lab clearly says
that original-runtime reference evidence is absent.

## Regional connectivity and boundaries (v5.6.0)

With your existing WM0 Workspace loaded, open **GIS Analysis →
Regional Connectivity & Boundaries** and calculate. Nothing is generated or
uploaded. Without the supported private WM0 source the tool is unavailable.

Choose **A: Strict Raw** or **B: Strict + Confirmed X Periodicity**. Overview
shows original face/Region counts, strict components, isolated duplicate nodes,
confirmed boundaries and seam influence. These are geometric components, not
walking/routing reachability. A duplicate-related singleton is not an island.

Select an original Region, sort its components, and choose one to show its
source-face range. Use the highlight checkbox to remove only this overlay.
Source-face lists are paged, at most 50 per page; selecting a face opens the
existing Source Inspector and focuses that source on the current projection.
The minimum component ID may be zero.

The adjacency view lists confirmed Region pairs and raw X/Z lengths. Choose a
Region/pair and enable boundary lines to see its confirmed segments. Separate
edge lists expose open edges, ambiguous candidates and X seam pairs with their
original edge IDs, XYZ and owners. These lines do not form an automatically
closed region polygon. West/east seam identities remain separate; Z does not
connect.

Content associations show an entrance's representative and complete trigger
component set. Gongaga and HP↔MP Cave have multiple trigger components; Mythril
Mine's two entrances span two Regions. A parent-place Atlas association describes
the parent entrance, not the reward location. Field-only entries without a
world source remain unassigned. Existing guide/Field actions retain their own
precision and spoiler rules.

Clear resets this tool's choices and overlays, preserving map colouring, route,
service-area and source-selection owners. Switching Workspace/map or entering
Field, Explorer or World Variants clears this analysis state through the existing
lifecycle. The five main entries and classic blue interface are unchanged.
