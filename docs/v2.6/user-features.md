# Personal GIS / User Mapping

GaiaGIS v2.6 adds user-created WM0 Point, Polyline and simple Polygon layers.
These are private browser data, visually distinct from verified source/Atlas
markers. The existing Inspector labels them **User-created**. No account,
telemetry, synchronization or automatic upload is introduced.

## Coordinates and measurements

Every feature stores one geometry: `mapId: wm0`, `coordinateSpace: GaiaGame`,
and vertices `{game_east, game_north}`. East is periodic original X in
`[0, 294912)`; north is `229376 - original Z` in `[0, 229376]`. The origin is
the southwest of the existing raw WM0 rectangle. Display conversion uses the
unchanged V1 inverse-Mercator Gaia geographic mapping. Neither these coordinates
nor the reconstructed geographic display are WGS84 or EPSG:4326.

All thirteen projections, Globe and Compare borrow the same geometry. Switching
projection changes display buffers, never saved vertices. WM2/WM3 and Explorer
explicitly disable drawing; no native-to-global transform is invented.

Lengths/perimeters sum minor great-circle arcs with stable `atan2(cross, dot)`
on the existing reference sphere **R = 6,371,008.8 m**. Polygon area uses signed
spherical triangle solid angles and an absolute winding-independent result.
It avoids subtracting two near-equal large values for very small polygons.
The Inspector states **Reference-sphere measurement**, not official FF7 physical
distance. User geometry has no source-derived elevation.

Lines may contain coincident points (zero-length segments). Antipodal edges are
rejected. Polygons use open rings with at least three distinct vertices, no
repeated closing vertex, no crossing/touching nonadjacent edges, positive area
and an unambiguous open-hemisphere domain. Holes/multipolygons are unsupported.
Antimeridian vertices stay canonical in storage; measurements use unit vectors.
Display lines/fills split at ±180 and projection discontinuities are masked.
Curved edges/fills are bounded display tessellations, not new analytical geometry.

## Drawing and editing

Open Explore → Drawing. Choose a user layer, then Point, Line or Polygon.
Point places on one click/tap. Line/Polygon add vertices sequentially; Finish,
Enter or double-click completes a valid geometry. A polygon can also finish by
tapping its first vertex. Esc/Cancel discards the unfinished draft.

Select by map point/edge/interior or My Layers list. The existing Inspector
edits name, notes, comma-separated tags, layer membership, color, point size and
fill opacity. Save commits atomically. Edit vertices enables drag handles;
choose a vertex in the list before Add vertex (then tap the map) or Delete vertex.
Move feature translates the complete geometry, wraps east, and rejects out-of-
domain north. Invalid polygon edits are discarded. Duplicate gives a new local
identity and timestamps. Feature deletion confirms first. Fly to targets the
first actual vertex, not a fabricated polygon centroid.

Compact screens close overlay docks when a drawing/edit tool starts so the map
is accessible. Pointer events support mouse and touch. Original source markers
pause pointer capture while drawing; Select preserves source interaction where
no user feature is hit. Overview controls resume on completion/cancel/disposal.

## Layers, navigation and privacy

Layers → My Layers starts with My Places. Create, rename, move earlier/later,
toggle visibility, set opacity and delete layers. Nonempty layer deletion must
confirm the member count. Layer order persists; points/handles remain above
strokes/fills for legibility. Hidden/zero-opacity layers draw no geometry.

Unified Search includes feature names/tags, also in source-only mode. Point
features can join local Tour stops and the separate user Nearby group. Nearby
uses their actual authored vertex and user-created provenance; hidden points,
lines, polygons and centroids do not enter the point distance index. Unresolved
or deleted local identities resolve gracefully through existing navigation.

Bookmarks/Recent/Tours store `user-feature` identities only inside local state.
Public ShareState accepts no user identity, layer, note or geometry. User layer
IDs never join the public registered-layer allowlist. Export is a separate
explicit local GaiaJSON download.

## Persistence and rendering

The existing `gaiagis.user-state` record becomes `gaiagis-user-state` version **2**.
v0/v1 migration retains navigation/preferences and adds default user layers.
`UserLayer` contains id/name/visible/opacity/order. `UserFeature` contains
id/layerId/geometryType/geometry/name/note/tags/style/createdAt/updatedAt.

Limits: 32 layers, 500 features, 20,000 aggregate vertices, 512 per feature;
name 120 characters, note 1,000, eight unique tags of 32 characters each;
point size 3–18, fill opacity 0–0.6, layer opacity 0–1. Complete serialized state
is bounded to 4 MiB UTF-8. Oversized/invalid edits fail before replacing state.
Corrupt input recovers a startup-safe default. Quota/unavailable storage keeps
validated memory state and shows an export-before-closing warning. Selective
My Layers clearing uses the existing confirmed user-state reset workflow.

One scoped renderer owns three shared objects per viewport: Points, LineSegments
and a triangle Mesh. Compilation is dirty on data/style/selection/draft changes;
projection buffers update only for a changed projection/context. Camera movement
uses a Globe back-face shader, not per-frame geometry reconstruction. Compare
shares the compiled geographic frame and owns its display buffers. Scope disposal
removes listeners, buffers and objects. No object per vertex/segment is created.

See [GaiaJSON](gaiajson.md) and [validation](validation.md) for exchange boundaries
and measured local performance. Future GIS export may use a local Python/QGIS
exporter with explicit Gaia custom CRS metadata; v2.6 exports no fake EPSG GeoJSON.
