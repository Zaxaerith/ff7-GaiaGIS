# Route elevation profile

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
