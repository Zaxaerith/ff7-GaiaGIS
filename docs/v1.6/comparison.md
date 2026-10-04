# Comparison scope

Projection comparison links a geographic center and normalized zoom, with a
temporary second projected display buffer/renderer. It shares the source mesh,
attributes and datasets; it does not rebuild source geometry or graph topology.
The second viewport is removed and its resources disposed when closed. On mobile
the views stack vertically. Left/top is the navigation authority; the second
view follows location fly-to, routes and user measurements.
Its position/mask buffers and cameras are reused, while source attributes/color
and the display-to-source lineage remain shared. Each view independently chooses
adaptive grid spacing. Normalized zoom uses each projection's viewport fit;
Globe keeps the camera outside the surface. Panning a planar center outside the
projection retains the last resolved geographic center for B and explicitly
labels that limitation. Follow-center distortion is unavailable there.

Traversal comparison reuses v1.3 ordinary terrain occupancy rules. Reachability
comparison uses v1.5 conservative source-edge components, seeded by all verified
entrance triangles at the selected From location. These are different operations.
Four classes: A only, B only, Both, Neither. Synthetic caps are outside gameplay
analysis. Runtime/story/save state, bridges and vehicle boarding are not solved.
Terrain comparison includes only ordinary Allowed occupancy. Conditional and
Unknown are excluded. Reachability/routes honor the shared conditional-terrain
option; it defaults off. The four colors classify membership, not four levels of
runtime availability. Existing tracks/events/corridor highlights remain separate.

Route comparison independently evaluates all nine existing routing profiles
with the same From/To and conditional policy. Results preserve entrance IDs,
node count, reference distance and component. At most three selected corridors
are drawn. No automatic vehicle transfer, new routing topology or travel-time
model is introduced. Missing optional graph/Locations keeps the other tools
available. Highwind Landing remains a separate diagnostic, not a route mode.

No new local-generated dataset is introduced. Analysis interfaces carry mapId
scope from source lineage; this release actually uses WM0 only. A small surface
material factory separates render material creation from analysis colors, without
adding textures or models. This keeps a future material mode possible while
retaining the present one-surface architecture.
