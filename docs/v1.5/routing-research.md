# Static routing research and policy

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
