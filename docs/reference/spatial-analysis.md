# Route elevation profile

For the separate v5.4 WM0 edge evidence tool, see
[Topology Evidence](global-source-gis.md#wm0-topology-evidence-v54). Original edge
occurrences, confirmed X relations and loaded CSR comparisons are distinct from
the route corridor/profile and traffic-mode connectivity below. This tool does
not change the solver or infer a route from geometric contact.

Input is the already solved source-triangle corridor. No second graph, raster,
nearest-height search or guessed coordinates are introduced. Each adjacent face
pair must share exactly two verified raw corners, matching E/W periodic endpoints.
The sampled surface path goes from a face centroid to its shared-edge midpoint
and then to the next centroid. Each leg stays inside its source TIN face; height
at these barycentric positions comes directly from the source vertices.

GaiaGIS recovers integer WM0 corners through the frozen Explorer inverse mapping
and rejects recovery ambiguity over 0.125 raw units. Existing Float32 transport
precision and V1 reconstruction assumptions remain unchanged. Synthetic caps and
native WM2/WM3 are excluded.

Leg endpoints provide the profile's extrema and accumulated ascent/descent for
the piecewise-linear TIN path. The same leg traversal computes terrain and encounter
exposure. Distance sums great-circle distances on R = 6,371,008.8 m. The graph's
unchanged centroid-to-centroid cost is reported separately: the constrained
center/edge path can be longer than the graph cost. The raised graphical route line
and its 1500-unit display clearance are not interpreted as terrain elevation.

Height is `raw game_height × configured vertical_scale`, currently 1 m/raw unit.
UI says Gaia display elevation. It is not Official FF7 elevation, a real vertical
datum or a runtime trajectory. Min/max/ascent/descent describe this sample path,
not every feature inside the triangle corridor.

The lightweight SVG chart has a pointer nearest-sample inspector and a labeled
native range control for keyboard/touch inspection. Numbers remain unchanged when
projection, relief or projection comparison changes. A missing route explicitly
says Solve a route first.

## Route terrain composition

Input and segment geometry are shared with Route Profile. Each leg belongs to one
source face; the verified shared-edge midpoint splits adjacent terrain faces.
Source registry IDs/names from existing metadata remain the authority, including
unknown/special source classes. No ecological land cover is inferred.

For terrain t: distance(t) = sum of segment lengths owned by faces with terrain t.
Percentage = distance(t)/total sampled corridor distance × 100. Triangle counts
are never the weighting variable. The synthetic equal 50 m Grass/50 m Forest case
produces 50/50%; unequal face lengths produce unequal percentages.

The existing From/To, movement profile and conditional inputs determine the route.
Changing them clears obsolete summaries. The result table and methodology share
the existing Analysis card/scroll tokens. Public/source-missing mode is unavailable;
WM2/WM3 are not given fabricated global analysis. Private examples and timing observations remain in ignored output.

## Static encounter exposure

The same solved corridor legs read existing face region/terrain/Chocobo flags.
The unchanged v1.2 `resolveEncounter` owner applies classic-PC region clamp,
terrain aliases and fallback slot policy. Distances aggregate by resolved source
encounter-set ID. A set can cover multiple region/terrain inputs; source scene
IDs for each encounter table remain inspectable. Set active/rate/record semantics
and source bytes are unchanged.

Chocobo-eligible exposure reports distance with the original face Chocobo flag.
It is a static source-flag measure; it does not promise an eligible runtime vehicle,
story/save state or encounter. Missing encounter data is explicit; route profile
and terrain composition continue independently.

This module has no RNG, step counter, encounter occurrence model, expected battle
count or probability calculation. Coverage of an inactive/fallback set still means
source lookup coverage, not encounters actually occurring. Distances/percentages
refer to the sampled TIN corridor on the assumed V1 sphere. Synthetic tests verify
lookup and distance conservation; private real-source results stay in ignored output.

## Source TIN slope and aspect

Each existing WM0 source face supplies raw `(X, Z, game_height)` corners through
the frozen Explorer inverse mapping. No raster or new coordinate authority exists.
For plane height h = aX + bZ + c, solve a/b from the two horizontal edge vectors.
Slope = atan(hypot(a,b) × vertical_scale / horizontal_scale), in degrees.

Both configured source-space scales are 1 per raw unit. These are **source-space
slope degrees**, not physical real-world Gaia terrain slope: the reference sphere
has latitude-dependent inverse-Mercator horizontal distances. Display-height metres
do not establish a constant physical horizontal metres/raw scale. Relief changes
rendering only and never changes analysis.

Increasing X maps east; decreasing Z maps north in the existing V1 mapping.
Downslope east = −a, north = b. Aspect = atan2(−a,b), wrapped to [0,360).
0° N, 90° E, 180° S, 270° W. Gradient magnitude below 1e-8 has undefined aspect.
Near-zero horizontal determinant has undefined slope/aspect, including vertical
and degenerate faces. UI renders undefined separately instead of inventing north.

Two Float32 arrays retain one attribute per 142,586 source triangles (1,140,688
bytes). They are lazily computed once per loaded viewer, released with that owner
and never recomputed per frame/projection. Caps are excluded. Slope uses a continuous
ramp from existing thematic color families; aspect uses eight readable directions.
Both integrate registered opacity/reset and Layers legends.

Rendering uses existing render-to-source lineage and shared color buffers, including
projection comparison. All thirteen projection formulas/morph semantics remain
unchanged. WM2/WM3 and active Explorer expose these overview analyses as unavailable.


## Network service area by path distance

Input: existing verified origin entrance triangle(s), movement profile, conditional
policy and threshold in reference-sphere path metres. UI accepts km (default 100;
50/100/250/500 km are useful inspection values). No travel time or isochrone is
claimed. Source entrance candidates are the same multi-candidate origin used by
the existing route owner; their initial graph cost is zero.

A bounded single-source/multi-origin-candidate Dijkstra request runs inside the
existing routing worker over its already initialized CSR graph and unchanged edge
weights. Existing connected-component eligibility labels enforce Allowed-only;
Include conditional uses the identical routing policy. No graph rebuild/copy,
raster buffer, routing-weight change or runtime simulation is introduced.

Supported profiles: Foot, Buggy, Tiny Bronco, Yellow, Green, Blue, Black and Gold
Chocobo. Highwind flight and native WM2 Submarine are deliberately excluded.
The result highlights source triangles whose graph node/center cost is within
the threshold, not a precise continuous polygon boundary within those triangles.
Disconnected components remain excluded. Conditional reachability is not a runtime
availability guarantee.

Results provide reachable node/triangle count, component count, threshold, profile,
conditional policy and elapsed worker ms. A Uint8 flag per source triangle feeds
the existing renderer; cost arrays and queue are request scratch, not retained user
state. Async revision guards reject obsolete results after input/map/data changes.
Registered layer opacity, reset and legend are reused. Threshold clipping,
disconnection, conditional rules and multiple profiles have synthetic coverage.

## Native source TIN analysis

WM2/WM3 use independent raw X/Z/h spaces. Exact determinant, projected area, nullable a/b gradients, duplicate membership, edge occurrence incidence and conservative components are separate from all WM0 algorithms. Terrain totals sum source-face contributions, not union areas. No modulo, snapping, real slope angle or game reachability is inferred. [Native method and export](native-gis.md).

## Regional Terrain Statistics (v5.5)

In WM0 BASE world view, open **Analysis → Regional Terrain Statistics**. The
current `WM0Source` supplies ordered integer X/Z/Y corners, source IDs and raw
horizontal area. Compute once on demand, then choose Global, By Region or By
Terrain. No new Workspace resource or regeneration is needed. Source-only mode
without original geometry reports unavailable; research tables are not runtime
fallback data.

Grouping uses **original** Region/Terrain attributes, not encounter lookup:
Region 16/17 remain distinct, Terrain 16/24/26 keep their IDs and Terrain 21 is
retained even when its display name is Unknown. Sea/Water are original source
labels, not inferred environmental classes. Each BASE face contributes once;
synthetic caps and periodic display copies never enter the aggregation.

For each source face, A = abs(det(raw X, raw Z))/2 in **raw²**. This is an additive
horizontal projection contribution, including duplicate records, not polygon
union, deduplicated ground coverage, spherical area or km². Zero-area faces
contribute to counts and raw Y min/max, with zero area weight.

- **By Region:** each Terrain count share uses the selected Region's face count;
  each area share uses that Region's summed A.
- **By Terrain:** each Region share uses the selected Terrain's corresponding
  count or area denominator. Sort either table by face count, area or raw ID.
- **Global:** totals include all BASE records. The marginal check shows global,
  summed Regions, summed Terrains and summed cells for both count and A.
- A zero denominator is **Not applicable**, never an invented percentage.

Height extrema cover all three original corners, including zero-horizontal-area
faces, in **raw Y**. They are not actor height, physical elevation or a vertical
datum. Slope/aspect reuse `tinGradient()` and `aspectCategory()` with the existing
raw horizontal/vertical scales of 1. Slope means and bins are weighted by
valid-slope area, including flat slope 0; undefined faces are listed separately.
Bins are [0,5), [5,15), [15,30), [30,45), [45,60), [60,75), [75,90) degrees.

Aspect runs clockwise from north=0° and uses N/NE/E/SE/S/SW/W/NW. Eight-direction
shares divide by **defined-aspect area**. Coverage separately divides that area
by all positive source-area contributions. Flat/near-zero gradient (g<1e-8),
vertical and degenerate faces have undefined aspect. Both flat area and total
undefined-aspect area are shown. No arithmetic mean of angles is computed.
These are raw-source indicators, not measured physical terrain slopes.

Select a composition row to page through its source face IDs (50 per page).
Click a face to locate/highlight it through the existing Viewer and Source
Inspector. This changes no thematic layer, routing weight, manual Variant state
or other analysis filter. No whole-region highlight geometry is generated.

The supported real source has 18 Regions, 29 Terrains, 161 populated cells,
142,586 BASE faces and 67,692,515,599 raw² summed contribution. There are 246
zero-horizontal-area faces and 168 duplicate-group members. Whole-source raw Y
is -738…4086; the area-weighted slope mean is about 5.036422°, and defined-aspect
area covers about 21.8968%. These are source-specific checks, not code constants.

Aggregation retains only categorical summaries and one source-face ID list per
cell. Selecting/sorting/paging does not rescan geometry. Current Source/Viewer
ownership clears the cache and selections on Workspace/map/Field/Variant/Explorer
transitions or disposal. Existing spherical Region navigation centers keep their
own weights and are not reinterpreted as raw² centers. X periodic display does
not duplicate records; Z is not periodic. Region components use the separate
v5.6 tool below; polygons, hydrology, coverage union and original-runtime
verification are not included.

## Regional connectivity and boundaries (v5.6.0)

Input is the same WM0 BASE source and exact three-dimensional edge index used
by Topology Evidence. Synthetic caps and projection copies are excluded. Each
source face remains a node, including duplicates and zero-horizontal-area faces.
Strict Raw (A) joins two different owners only when the edge has exactly two
occurrences, passes `uniqueRaw`, both faces are nondegenerate in 3D and their
original Region IDs agree. Vertical valid faces can connect; common vertices,
XY-only contact, proximity and Routing CSR cannot establish these edges.

Strict + Confirmed X Periodicity (B) adds only the existing confirmed west/east
pairs after checking valid owners and the same Region. These raw edges each
still have incidence one; they are not required to pass ordinary two-owner
`uniqueRaw`. Z never wraps. Component identity is source SHA, Region, A/B and
the minimum source-face ID, which may be zero. Duplicate geometry is not merged:
ambiguous edges cannot connect it, while its nodes and raw² contributions remain.

Confirmed cross-Region edges are counted once. Their length is
`hypot(delta X, delta Z)` in raw units, not 3D slant distance, metres or km.
Open edges, geometric ambiguity and confirmed X pairs have separate lists.
There is no polygon union, automatic closure, repair or physical land-use claim.
The source-derived counters can differ for other supported inputs; no research
counts are used as a browser fallback.

Selected components use an independent translucent source-mapped overlay;
base colour, traversal, service-area and current source selection retain their
own buffers. Selected Region/pair boundaries use projected line segments,
including the existing antimeridian cut and projection morph handling. Raw
west/east identities remain separate; no west-to-east chord is drawn. Turning
off or clearing these overlays restores the underlying map state.

POI representatives and complete trigger sets map through the exact
SHA/Section/Mesh/Triangle lineage. Multiple entrances can span Regions or
components. Atlas parent bindings are explicitly parent-place context;
Field-only identities without a WM0 source cannot acquire membership or a
reward marker. This is static geometric evidence, not entry availability,
collision, story state or a replacement for routing components.

Source/Topology are shared by their current Viewer owner. Clearing one analysis
does not invalidate the other tool's borrowed index. Partitions/member indices
and boundary occurrences are cached for sorting/paging and released on data or
spatial-mode lifecycle changes. The interactive path cooperatively schedules
small batches of the same topology/partition algorithm; cancellation discards
unfinished results. Existing synchronous consumers retain the same index/API.
Displayed preparation time includes scheduling waits, not just CPU work.
No Workspace asset, Manifest change or database
is required. Browser performance and the limited local checks are recorded in
the ignored current development report; Node research timing is not a browser
performance guarantee.
