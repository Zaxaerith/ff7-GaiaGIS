# Traversal profiles and data

The public `src/gaiagis/traversal_profiles.json` is a small reference behavior
profile, shared directly by Python and TypeScript. It is **not** a derived map.
No `gaia-traversal.json`, generator, optional dataset loader, per-triangle copy
or normal extension is needed. Existing local V1 files remain required for map
geometry; POI/encounter files remain independently optional.

Schema `gaiagis-traversal-profiles`, version 1, compatibility
`classic-pc-reference`, current-executable equivalence
`not-verified-steam2026`. Each profile has stable id/name, model id, tint or null,
normal terrain mask, bridge-context sensitivity, exit-candidate mask and
departure-initiation mask or null. Null means not applicable, not invented data.
Hexadecimal masks are unsigned 32-bit facts; bit index is terrain 0–31. No
terrain/region names participate in evaluation.

`gaiagis.traversal.evaluate` / `evaluateTraversal` return state, reason,
evidence, profile, static terrain compatibility, movement-unknown,
departure initiation, completed-entry/exit-unknown and runtime-not-simulated.
An explicit scope distinguishes terrain occupancy from Highwind landing
initiation; Highwind airborne terrain occupancy is not assessed by that mode.
The primary map shows ordinary
terrain masks. **It does not use current bridge/vehicle/save state.** Human and
Chocobo bridge-context exceptions are explicitly explained in the Inspector.
The compact matrix compares ten normal profiles at the same source triangle.
Highwind is the exceptional profile: ordinary grass initiation, conditional
Northern Cave script path, conditional grass/script-7 destination issue, all
other terrain blocked for ordinary landing. These are not air-travel results.

`reference_gate` / `referenceGate` provide a separate local predicate diagnostic
with explicit model/tint, current terrain/model, leave state, airborne flag and
flight state. It preserves the script !=7 exit gate and bridge override. Its
default context is ordinary non-exit, non-bridge terrain comparison; it cannot
infer the user's current gameplay state. Unsupported model IDs return unknown
rather than exploiting the reference default-success branch. Invalid terrain,
script, packed input or supported tint raises an explicit error.

`chocobo_exit_height_compatible` / `chocoboExitHeightCompatible` accepts integer
**raw game heights**, checks |candidate - current| <200, and does not convert to
metres or assess slope. It evaluates one supplied candidate sample, not the
engine's entire five-sample/multiple-group exit search. Actual samples and
position history are not available in a static triangle. The Viewer displays
the constraint and leaves completion unknown; no synthetic exit points are made.

## Viewer and lineage

Display → Color layer → Traversal; Movement mode selects one of ten profiles.
Colors distinguish Allowed/Conditional/Blocked/Unknown. Allowed means static
classic-PC terrain compatibility, **not** present-day gameplay availability or
global reachability. Polar caps are unknown because they have no FF7 attributes.
Unused source terrain codes still have explicit mask results; their names do
not cause arbitrary unknown states.

Existing `terrain`, `script`, `origin` and source lineage are sufficient. Original
region/texture/Chocobo high bits do not alter this mask predicate. `renderToSource`
keeps projection fragments bound to canonical triangle IDs. The surface's
existing color buffer is updated; no new geometry, index buffer or vehicle mesh
is created. Traversal does not change latitudes, longitudes, height scale,
projections, selection or POI coordinate transformation.

Chocobo Tracks remains an independent source-flag overlay, with its own yellow
legend; it can override traversal colors while enabled. It is neither a terrain
capability nor a guarantee of capture. Encounter and Traversal sections coexist
without sharing runtime eligibility logic. Locations/search/fly-to and their
Inspector remain intact. No vehicle field-access claim is derived from a POI.

## Developer validation

Use the [current testing workflow](../development/testing.md).

Sources, full model inventory and the strict evidence/runtime limitations:
[traversal research](../research/world-map.md). GPL-3.0-only covers original GaiaGIS
code; reference decompilation and third-party dependencies retain their own
status. No unlicensed implementation is copied or bundled.

## Local routing transport

The unified `gaiagis build-workspace` command reads WM0 through the existing read-only parser and writes the optional local routing transport in the generated workspace. All outputs remain workspace-local and ignored; no game files are modified.

The V1 Web mesh retains Float32 coordinates and source attributes; exact raw
integer edge identity cannot be recovered from it. A separate topology file is
therefore necessary. It contains lineage, attributes, reference area, CSR
adjacency and Float64 edge distances, **no duplicate triangle geometry**.

### Binary version 1

Little-endian, 128-byte header, magic `GAIARTG\0`. uint16 at offsets 8/10:
version 1/header length 128. Nine uint32 values starting at offset 12:
node count, directed arc count, node offset, CSR offset, neighbor offset,
weight offset, total byte length, E/W seam edge count, flags (1 = cut V1 WM0).
Bytes 64–95 are the WM0 SHA-256. Other reserved bytes must be zero.

Each 16-byte node is `<HHHBBd`: section, mesh, triangle, terrain, script,
reference-sphere area in m². Then `(nodes+1)` Uint32 CSR offsets, Uint32 neighbor
indices and Float64 distance weights in meters. Weight storage need not be
8-byte aligned; the frontend reads it through DataView. Neighbors are sorted;
all arcs have a symmetric reverse with exactly the same weight.

Node order equals the frozen Web source-triangle order; synthetic faces are
excluded. Frontend validation binds WM0 fingerprint, node count, every lineage
record, terrain and script to the loaded mesh, checks all lengths and ranges,
rejects duplicates and invalid adjacency, and limits input to 100 MB. Rejected
optional data does not replace the current geometry, POI or other subsystems.
The file has no separate cryptographic authenticity guarantee: matching source
fingerprints describe provenance, not a signature on a user-supplied graph.

### Evaluation and UI

Nine ordinary profiles reuse v1.3 terrain rules. Highwind Landing is excluded.
Bridge/Back Entrance states are conservative conditional gates; explicit
inclusion is off by default. Unknown/blocked nodes never participate. A component
has a deterministic ID, triangle count, reference area and associated Location
count. A Location may belong to several components through different entrances.

All `trigger_triangle_ids` of all verified entrances are candidate endpoints.
No primary-marker or nearest-point inference is used. Deterministic multi-source,
multi-target Dijkstra reports the chosen entrance IDs. The distance minimizes
great-circle edge weights between Float64 V1-transformed raw centroids. It is a
graph-corridor distance, not continuous geodesic shortest path, travel time or
proof of runtime walking. Rendered corridor centers use existing visualization
coordinates and can differ slightly from the centroids used for weights.

Components and queries run in a Worker; component results are cached by profile
and conditional policy. Clear cancels adoption of pending results without
blocking rendering. Loading a replacement validates it before adopting it and
ignores stale requests. Locations must be loaded to use From/To.

Visual precedence: base layer → unreachable dimming → Chocobo tracks → selected
event/source-trigger highlights → route corridor. Start/end markers use mint/
orange rings; unreachable location markers fade. Routes use one lightweight
LineSegments object, E/W segment splitting and projection masks, never a second
world mesh. Projection changes/morphs do not re-solve the graph. Conditional
state, bridge history, collisions, boarding, story/save state and vehicle
ownership remain outside the model.

## Static routing research and policy

Baseline: v1.4.0; V1 reconstruction and existing projection formulas remain
unchanged. The Web mesh stores Float32 geographic positions and lineage, not
source-exact integer edges. It therefore cannot establish routing adjacency.
The optional local routing exporter reads WM0 through the existing parser.

Nodes are base source triangles in section/mesh/triangle order. An edge key is
the sorted pair of exact `(game_east % world_width, game_north, game_height)`
endpoints. Only incidence-two edges between distinct, non-duplicate faces
connect. Height is part of identity, so XY overlaps never connect surfaces.
E/W is periodic; north is not reduced modulo height. N/S stays cut and no
synthetic caps enter the graph. Boundary, collapsed, non-manifold and duplicate
face incidences are counted and conservatively excluded, never repaired.

Route eligibility reuses the public v1.3 ordinary terrain evaluator, excluding
Highwind Landing. Both endpoints must pass. Bridge terrain 13/14 and script-
dependent Back Entrance terrain 30 are conservative conditional gates when an
ordinary mask otherwise passes. Conditional inclusion is explicit and off by
default; unknown and blocked never pass. This graph omits runtime collision,
edge motion, story/save state, boarding and vehicle availability. It proves
connectivity in a static terrain model, not current gameplay reachability.

Edge weights are great-circle distances between source raw-triangle centroids
transformed by the existing Float64 V1 Mapping. Dijkstra is used deliberately:
it needs no heuristic based on quantized Web coordinates. Stable node IDs and
tie breaks make results reproducible. Radius 6371008.8 m is an assumption;
distances are reference-sphere distances, not travel time or canon.

Locations supply all verified entrance trigger triangle references. No marker
centroid or nearest-neighbor inference establishes an endpoint. A multi-source,
multi-target query minimizes over eligible entrances and reports the identities
used. Components count triangles, reference-sphere area and associated locations.
Rendering uses existing Web coordinates solely for a corridor centerline, not
for graph construction. Antimeridian segments are split; projection changes
reproject the route without re-solving it.

The public release contains only independent code, documented transport,
synthetic tests and statistics. Complete routing topology stays local-generated
and ignored. No new gameplay-data research or runtime simulation is introduced.
