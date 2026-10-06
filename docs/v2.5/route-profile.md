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
says Solve a route first. Timings/examples are recorded in validation.md.
