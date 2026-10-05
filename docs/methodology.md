# Reconstruction and evidence boundaries

V1 Geometric Gaia is the canonical **GaiaGIS** reconstruction. It is a mathematical
interpretation, not official/canonical FINAL FANTASY VII geography. v2.0 integrates
the application; it does not revise reconstruction, topology or game semantics.

## Evidence classes

**Observed:** source bytes/hashes, MAP triangles/attributes, source lineage and
periodic boundary matches. WM0 has 142,586 base triangles over 294,912 × 229,376
raw horizontal units. Both raw boundary cycles close geometrically.

**Derived:** topology analysis, circular geography statistics, V1 parameterization,
source-to-Web transport, verified-entrance navigation and static graph results.
Derivation retains map/section/mesh/triangle and source hashes.

**Reconstructed/Assumed:** inverse-Mercator latitude with source limits about
±80.071528814895°, an N/S cut, 9,792 synthetic ocean-cap triangles, reference sphere
radius 6,371,008.8m and 1m/raw-height scale. E/W longitude remains periodic. Radius,
orientation, poles, prime meridian and physical heights are not FF7 canon.

**Reference-derived:** classic-PC encounter/traversal/model behavior independently
implemented from documented/decompiled semantics. Reference-only material is not
copied as a runtime implementation. Third-party license boundaries are retained.

**Unknown:** current Steam 2026 executable runtime equivalence; story/save/model
availability; exact moving-object current positions; unresolved event anchors;
WM2/WM3 global transforms, vertical datums and physical integration. They remain
visible limitations rather than invented values.

## Spatial domains

WM0 source topology is toroidal. V1 cuts the raw N/S cycle in the validated ocean
band and closes the reconstructed sphere with synthetic caps. It does not make
the raw game map a pre-existing latitude/longitude dataset. Physical measurement
and route distance use the assumed sphere. Gameplay terrain is not ecological
land cover, encounter weights are not absolute probabilities, and compatible
terrain is not global runtime reachability.

WM2 Underwater and WM3 Great Glacier remain native raw-coordinate domains with
independent geometry and textures. They are not bathymetry/polar layers of WM0.
Transition evidence can open a target map without establishing a global mapping.
No geographic coordinates are fabricated for these maps.

Stage 1 Float64 GIS is the coordinate authority; Web transport is Float32. The
previously measured maximum sphere-coordinate quantization error is about 0.424m.
Explorer v2 recovers WM0 raw integer corners through the frozen inverse mapping
and verifies them against v1; it changes storage ownership, not movement rules.
Its integer recovery is not a new high-precision GIS conversion.

Climate V2/V2.1/V2.2 concluded **Experimental / Inconclusive** and did not establish
a robust replacement latitude mapping. No climate warp is selectable in the
formal Viewer. Historical work is retained, not executed or extended in v2.0.

Detailed foundations remain in [Stage 0](validation-report.md),
[V1 sphere](spherical-reconstruction.md), [routing](v1.5/routing-data.md),
[native coordinate spaces](v1.8/coordinate-spaces.md) and
[Explorer movement](v1.9/movement.md). See [data and copyright](data-and-copyright.md)
for the separate publication status of game-derived material.


## Gaia Atlas (v2.2)

Atlas adds offline authored place knowledge, secrets and collectible/reward discovery to Explore search. Search names, aliases, categories, regions and item names; one-edit spelling fallback follows literal matches. The shared Inspector shows localized overview, type/region, access, gameplay, discoveries, related places, precision/evidence and reviewed sources. Sources are external links opened only when requested. The default spoiler setting hides major story rewards, including their search aliases; select Show all deliberately to reveal them.

Layers has Places, Secrets and Collectibles switches. Collectibles marks verified parent-place entrances only, never a chest or interior reward position. An entrance-level card enables existing route, measurement and Explorer actions. Parent-place/field-only cards offer Fly to parent place; unresolved records have no map point. Gold Saucer, Northern Cave, Ancient Forest and Sunken Gelnika retain searchable knowledge without guessed global placement. Native WM2/WM3 positions are never treated as geographic coordinates.

The local launcher generates the optional ignored `gaia-atlas.json` through the existing workspace builder, with curated-content, POI, source, transition and generator fingerprints. Warm reuse remains offline. Old workspaces without Atlas retain bundled knowledge with currently validated POI bindings. Public source-only pages can search/read knowledge without a spatial pack. No save-state, treasure-collected state, battle or field renderer is included.

See [research](v2.2/atlas-research.md), [schema](v2.2/atlas-schema.md), [spatial evidence](v2.2/spatial-binding.md) and [local validation](v2.2/validation.md). Source-only distribution remains mandatory; all generated packs and screenshots stay ignored.
