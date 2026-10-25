# Global Source GIS

WM0 Global Source GIS queries the complete original **BASE** source surface,
independently of Globe/projection, Relief and texture display. It uses the current
private V1 Workspace: no new resource, original-MAP import or GIS rebuild is needed.
The manual World Variants tools keep their separate source-state scope.

## Position query and transect

In WM0, open **Analysis → Global Source GIS**. Enter raw X/Z, including fractions
such as `510089/3,547085/3`, or use the point/endpoint picking actions. Map picking
inverts the current mathematical map surface; it does not select a unique visible
ground or decide which original height the player occupies. Displayed precision
does not turn a mouse position into an exact original vertex.

Point results retain all original Section/Mesh/Triangle identities and exact raw Y
expressions. Equal heights do not merge shared-edge or duplicate sources. Vertical
faces return intervals; degenerate geometry is separate diagnostic evidence. For
example, `(38269,88205)` has nine sources and two ordinary heights, with vertical
intervals including `[307,462]`. No highest/lowest/unique ground is inferred.

Enter A and B or pick the endpoints to calculate one straight raw-coordinate
transect. Its SVG retains source branches, point contacts, vertical events and
collinear bands. Select a branch or use the paged list for overlapping paths.
Gaps concern ordinary source-height segments, not gameplay holes or missing
visibility. Axes use raw horizontal units and raw Y, without physical metres.

## Horizontal periodicity

The stored WM0 width is **294912**, with Z in `[0,229376]`. Queries accept explicit
unwrapped X in `[-294912,589824]`. The coordinate itself selects the periodic
image; a result preserves its original source identity and the displayed X offset.

- `X=0` and `X=294912` each retain source records from both stored boundary sides.
- `A.X=294800 → B.X=295100` explicitly crosses eastward through the seam.
- `A.X=188 → B.X=-112` explicitly crosses westward.
- `A.X=294800 → B.X=188` traverses the long westward line as entered. It is never
  silently replaced by a shortest path.

Z does not wrap in this tool. The 9,792 V1 synthetic polar faces are excluded:
source space, polar reconstruction and display projections are distinct.

## Integrated source evidence

Selecting a result, a profile branch or an ordinary original WM0 face opens the
same source Inspector. Original raw corners and retained terrain/region/script/
texture attributes remain distinct from display geometry. The current transport
does not provide every original normal, UV, padding or compressed-file offset.

Associations use the source MAP fingerprint and Section/Mesh/Triangle key:

- Static encounters use existing region/terrain rules and retain table fallback
  evidence. They do not predict a battle or its runtime probability.
- Events and entrances match every recorded trigger triangle, rather than only a
  representative marker. Model-only display anchors acquire no trigger relation.
- Locations follow existing IDs. Atlas links preserve their existing precision,
  including parent-place and field-only; rewards acquire no new coordinates.
- Field context follows validated entrance/identity relationships. Opening a
  scene does not prove a landing, current access or a global Field position.

Missing optional resources, incompatible sources and no direct relation are
reported separately. No nearest-neighbour, name similarity, story-state prediction
or runtime event execution is used. The [Atlas evidence](atlas.md),
[encounter/source methods](../research/world-map.md) and
[Field navigation](../user/navigation.md#world--field-multiscale-navigation) retain
their established limits.

## Ownership and compatibility

Only the current supported V1 WM0 owner retains recovered corners and lightweight
source metrics. The exact `SurfaceSource` point/transect functions are shared with
Native/Variant analysis. It does not build Explorer adjacency to run a query.
Clear, map/Field/Workspace changes, Explorer and Variant research release query
results and pending picks. Source-only startup has no original spatial resource.

Frozen V1 geometry and thirteen projections, routing, Native WM2/WM3, Field,
Explorer, Manifest and existing private formats remain unchanged.

## WM0 Topology Evidence (v5.4)

Open **Analysis → WM0 Topology Evidence** or select an original BASE face.
The current `createWM0Source()` owner supplies ordered integer `(X,Z,raw Y)`
corners and Section/Mesh/Triangle identities. The index is built once on demand;
filter changes reuse it. Select a paged result to highlight/locate its face and
open the existing Source Inspector. Each edge retains its original endpoint
order and all face/edge-slot references, also in bounded paged lists.

### Three separate relationships

1. **Raw geometry:** an undirected key sorts two exact 3D endpoint positions.
   Every original edge record contributes before any deduplication. Incidence
   1 is boundary; 2 is two occurrences, not necessarily two different faces;
   >2 is a non-manifold candidate. Collapsed endpoints, repeated slots within
   one face and duplicate face groups are retained. A conservative unique raw
   association requires two distinct faces with no collapsed/repeated/duplicate
   ambiguity. Positions at equal X/Z and different Y never merge.
2. **X periodic evidence:** only edges wholly at X=0 or X=294912 are candidates.
   Compare unordered endpoint Z/Y pairs exactly. Opposite keys remain visible
   even if ambiguous; confirmation requires one unambiguous original occurrence
   on each side and different source faces. Raw incidence and raw endpoints do
   not change. Z=0 and Z=229376 never become periodic. This differs deliberately
   from the historical Python diagnostic that modulo-welds both axes.
3. **Routing:** the existing Analysis owner supplies its actually loaded CSR.
   MAP hash, count and source/node lineage must agree. The Inspector separately
   lists raw co-references, confirmed X counterparts, actual CSR neighbors and
   geometry-only/CSR-only differences. Unconfirmed X candidates do not enter
   the confirmed geometric comparison. Raw ambiguous co-references remain
   candidates, not asserted traversable edges. Missing/mismatched CSR gives an
   explicit unavailable reason, never a guessed graph.

The **Duplicate** filter means faces in actual duplicate geometry groups;
related edges can also reference other faces. **Periodic seam** includes all
X-side candidate faces. **Ambiguous** is the union of raw ambiguity
(collapsed, repeated, >2 incidence or duplicate-related keys) and unresolved
X candidates. Ordinary non-seam boundary edges are not automatically ambiguous.
Global raw ambiguity and unresolved X counts are displayed separately.

### Counts and limits

For the currently supported original source, the read-only Web calculation gives:

| Measure | Count |
|---|---:|
| BASE faces / ordered corner records | 142,586 / 427,758 |
| Exact 3D position keys / raw edge keys | 71,765 / 214,270 |
| Incidence 1 / 2 / 4 edge keys | 1,030 / 213,116 / 124 |
| Collapsed keys / same-face repeated keys | 0 / 0 |
| Duplicate groups / member faces / excess | 84 / 168 / 84 |
| Duplicate-related / raw ambiguous edge keys | 161 / 163 |
| X candidate keys / confirmed pairs / unresolved keys | 448 / 224 / 0 |

Corner records mean three ordered occurrences per source face; they are not the
original MAP's vertex-pool count or storage vertex IDs. Exact position and edge
keys, duplicate membership and conservative relations are derived calculations.
The 448 paired side keys still each contribute their original incidence of 1.
No Euler invariant or component/traversability claim is made in this tool.

No epsilon welding, repair, nearest-neighbor search or runtime collision model
is used. CSR differences do not imply route-generation bugs, sea/land connectivity
or player access. Filtering changes neither routing overlays nor manual Variant,
Save, Field or projection state. Inactive map/Field/Variant/Explorer transitions
release this feature's results and pending work; a new active query can rebuild
the index. **Release topology results** also drops its cache without clearing
other analysis tools. All lists page at 50 entries; no coordinate database or
new Workspace/GeoPackage resource is created.
