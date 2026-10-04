# Reference-sphere measurements

Measurements are user-created analysis, not FF7 POIs or source geometry edits.
They retain a mapId analysis scope; the current Viewer is WM0/V1 only.
The assumed radius is 6371008.8 m. Height does not enter these measurements.

Distance sums minor great-circle arcs using atan2(norm(cross), dot) of unit
vectors. Drawing uses spherical interpolation and existing antimeridian-safe
line splitting. Antipodal edges have no unique minor arc and are rejected.
Area sums oriented spherical triangle solid angles (atan2 determinant formula),
normalizes to the smaller complementary region and reports km² and sphere %.
Both ring orientations are accepted; self-intersecting and antipodal-edge rings
are rejected. Large/complementary-region interpretation is explicit: this tool
does not ask which side of a global polygon the user means. Maximum 512 points.
Repeated spherical vertices are rejected. A reference direction away from all
ring edges avoids ambiguous fan diagonals even when nonadjacent vertices are
antipodal. The drawn polygon is a closed geodesic boundary rather than an
uncertain projection-space fill. Undo/finish/clear controls retain transient
browser-local state only.

Stored lon/lat points and numerical results are projection-independent.
Changing a view only projects drawing buffers. Surface clicks use the existing
rendered surface hit followed by bounded display inversion for 2D views, or
normalized spherical direction on Globe. These are visualization picking
coordinates, not Stage 1 survey precision. Exact lon/lat entry is also available.
Source lineage and canonical coordinates are never edited.

Independent synthetic tests use analytic arcs/octants and
[D3 spherical math](https://d3js.org/d3-geo/math) as a test-only area oracle.
