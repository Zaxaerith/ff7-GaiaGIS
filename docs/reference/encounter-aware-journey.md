# Encounter-aware Journey Analysis

Open **Encounter Analysis** in **GIS Analysis → Route Profile** after solving a WM0 route. Journey and World–Field world results also open the same panel. A successful World–Field world stage is eligible even if the Field stage remains unresolved. The panel follows the foreground route and offers scope for a whole Journey or one of its original legs.

## Distances and ordering

| Measure | Source |
| --- | --- |
| CSR graph cost | Ordered graph weights from the existing solver |
| Sampled corridor length | The two Route Profile half-edges through each verified raw shared edge, measured on the V1 reference sphere |
| Traversal pieces and unique faces | Occurrences along the travelled route and unique original WM0 BASE Source Face identities, respectively |
| Candidate distance and share | Length of the selected candidate's union of pieces, divided by the analyzed corridor length |

Each half-edge retains its original triangle, Section/Mesh/Triangle lineage, raw endpoints, leg and traversal ordinals, and cumulative Float64 distance. Joining adjacent legs preserves the actual shared endpoint. Returning through the same triangle contributes its traversed length again and leaves the unique face count unchanged. The reference distance assumes the same Earth-sized sphere as the Route Profile. Field Access hops, Gateway transfers and FieldLocal coordinates are outside this WM0 distance scope.

## Encounter evidence

- **All table references** exposes the actual Set and original weights, including inactive sets, scripted pieces and zero-weight records. Positive records are required for coverage by Battle ID, verified Formation or composite Enemy.
- **Historical-rule static candidates** requires an active Set, a zero script gate and a positive record. Chocobo records additionally require original tracks. Original Region/Terrain and lookup Region/Terrain expose the effects of clamp, alias and fallback.
- **Formation** follows Battle ID = Scene × 4 + Slot. **Enemy** uses the composite Scene ID and Enemy ID. Each identity contributes at most once per traversal piece even when multiple records, repeated enemy instances or multiple Formations refer to it.
- **Ordinary**, **Chocobo**, **intersection** and **union** use sets of traversed pieces. Different identities can overlap, so their percentages can sum above 100%. These percentages describe source coverage along the route. They do not estimate runtime encounter probability or battle count.

The Set strip preserves disjoint occurrences. Choose a Set, Formation or Enemy to shade its intervals on the distance axis and highlight those precise half-edges on the map. Use the slider or distance strip to examine one piece and open its original Source Face. With verified Gameplay links the selected identity also opens the existing Formation or Enemy details and Encounter Geography. The map highlight uses the same geographic conversion, seam splitting and projection clipping as other route layers. Clear the analysis to remove its own highlight while leaving the route and other GIS layers in place.

## Availability and limits

The session uses the current WM0, Routing, POI, Encounter and Gameplay resources with the current Workspace generation. Missing Encounter data leaves the original Route Profile available. With missing or conflicting Gameplay, Set references and positive Battle IDs remain usable with the original table evidence, while Enemy attribution and Formation links are unavailable. Source replacement and foreground route changes invalidate the old analysis.

The whole route must fit 8,192 pieces, 200,000 identity contributions, 16,384 intervals and an 8 MiB logical result budget. The panel can analyze individual valid legs when the whole route exceeds budget or contains an unverified edge. A limited or geometrically partial scope reports its unavailable full denominator rather than estimating it from completed legs. A same-point route retains its source face and a zero distance with no percentage. Rendering reuses the existing map and reprojects the overlay without repeating analysis.
