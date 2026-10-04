# Local routing transport

`python -B scripts/build_routing_assets.py --source 'YOUR_FF7_INSTALLATION'`
reads WM0 through the existing read-only parser and writes
`web/public/data/gaia-routing.bin`. It requires Python 3.12+, not QGIS. Every
output is checked against the workspace boundary. No game files are copied or
modified. The file is optional, generated locally and ignored by Git.

The V1 Web mesh retains Float32 coordinates and source attributes; exact raw
integer edge identity cannot be recovered from it. A separate topology file is
therefore necessary. It contains lineage, attributes, reference area, CSR
adjacency and Float64 edge distances, **no duplicate triangle geometry**.

## Binary version 1

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

## Evaluation and UI

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
