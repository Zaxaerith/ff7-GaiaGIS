# Changelog

## v4.2.0 — FieldLocal GIS Integration

- Explicit `field-gis export --format-version 2` adds Trigger and original LINE LineString Z layers to the shared FieldLocal exporter. Default/explicit v1 retain the original eleven-table contract; both formats enforce their exact tables, fields and Undefined Cartesian SRS -1.
- A bounded read-only Interaction Pack v1 reader checks Manifest/file identity, flevel/maplist and Section-5 sources, selected-scene hashes, raw records, instruction/Actor/entry structure and all recomputed mesh candidates. It decompresses only the selected scene, without game-file access or Workspace regeneration.
- Normalized scripts, memberships, LINE control links, geometry candidates, background state-mask evidence and conservative stops retain all source identities. LINON/dynamic SLINE have no geometry; constant SLINE remains nonspatial modification evidence. Runtime activation is NULL/UNKNOWN; only exact 3D contacts can carry a requested directed BFS association.
- Shared SQLite/OGR readback precedes atomic no-overwrite delivery and rechecks all used inputs. Manifest decoding and its starting fingerprint now use the same bounded bytes, rejecting an early replacement; selected Interaction bytes are captured during the authenticated stream read. Existing Context, Walkmesh, visual/interaction packs, Workspace, WM0 exchange and original research GeoPackages are unchanged. Exports/projects stay private; GDAL/QGIS remains optional and outside Web/portable runtime.
- User documentation includes v1/v2 choice, Chinese QGIS filtering/join steps and evidence limits. QGIS desktop display and attribute checks are accepted; automated PyQGIS project save/reopen is a separate validation.

## v4.1.0 — Field Interaction Geometry

- Optional `gaia-field-interaction.bin` v1, source-bound to flevel/maplist and raw Section 5, compressed and decoded per selected scene. `field-interaction --source ... --workspace ...` updates only this component and its Manifest entry; older Workspaces keep all existing views. Full incremental generation also includes it.
- Reuse the original Section-1 entry/width/CFG parser for LINE/LINON/SLINE and retain conservative stops, shared Actor/entry aliases and bank dependencies. Section-8 Trigger decoding supports 536/740-byte layouts and the exact unused-record sentinel. No script VM or runtime-state inference.
- Existing Field Canvas/Inspector: distinct line styles, category/overlap selection, explicit fit including visible interaction lines, all exact/XY candidates, raw source records and plain-language explanations in five languages. Constant SLINE is separate modification evidence; dynamic SLINE and LINON never become fabricated geometry or display-state rules.
- Field tools scroll within the existing shelf on compact screens, keeping Canvas space available. Returning to World rebuilds the shared scene Inspector and releases retired interaction/BFS button closures; lifecycle regression covers selected interaction evidence as well as component analysis.
- Exact 3D candidates associate with existing directed BFS only; Trigger bit indices associate with validated original background tile masks without activating conditions. XY-only/Disjoint and unsupported background parsing stay explicit. Context schema 3, Walkmesh v1, visual resources and FieldLocal GeoPackage v1 remain unchanged; interaction GIS extension is deferred.
- Web/Windows x64 only. Private game/interaction data remain outside source, public builds and portable ZIPs. Browser human acceptance is complete; static evidence does not establish gameplay triggering or dynamic story/background state.

Formal version changes; historical acceptance evidence remains in Git history and Releases.

## v4.0.0 — published, human accepted

- Stability/UX developed on the isolated local `stabilize/v4.0` branch, then fast-forwarded to main after v3.9/v4.0 human acceptance. The published annotated tag and history are retained.
- Field selections hide World-only route/measurement actions and explain the FieldLocal raw-unit boundary. Existing visualization, anchor and network controls are grouped; triangle/anchor results precede scene relations and expandable technical evidence in the shared Inspector. Fold state survives redraw/locale changes without another renderer or selection model.
- Manual Workspace imports keep one session request identity across shell remount: late validation/status cannot replace a newer choice, and automatic-local fetches cannot replace an already validated manual Workspace. A rejected manual choice retains its alert across automatic connection without blocking that valid connection. Page exit invalidates requests; cancelled source reads do not start owner adoption. Successful retry clears the alert, and selecting a valid Triangle ID clears the prior invalid-input warning.
- Reimport preserves the single Explorer panel before shell docks are detached. Session UI styles load from the entry point so completed dynamic CSS preload listeners cannot retain the first Viewer. Browser regression checks old Shell/Canvas weak references over repeated imports, bounded warm Field/background/network reuse and full document release; diagnostic file-input handles are explicitly released.
- Explicit scene/anchor/changed-triangle selections bring the Inspector's current item into view; redraw, analysis and resize preserve reading position. Source/Target navigation focuses the scene selector, and adjacent-triangle navigation returns keyboard focus to the Canvas.
- Web-first setup, incremental private Workspace instructions and clearer verified/reconstruction/partial/UNKNOWN evidence boundaries. FieldLocal raw units and static topology remain separate from world geography and gameplay.
- Existing Windows-only exact-tag/cloud-build pipeline retained: one Windows x64 ZIP, one checksum manifest, source provenance and refusal to overwrite an existing Release. v4.0.0 was subsequently published following approval; candidate checks alone do not authorize later publication.
- Field Context schema 3, Walkmesh v1, camera/background, FieldLocal GeoPackage, GaiaJSON and Manifest contracts remain unchanged. No complete game-data regeneration, macOS maintenance or new spatial algorithm.

## v3.9.0 — human accepted, included in v4.0

- Evidence-bound World → Field navigation reuses WM0 Entrance identities, ENTER_FIELD 0x318 / FIELD.TBL records and source-matched Context/Walkmesh resources. Default/Alternative choices stay separate; exact local navigation requires validated target identity, triangle and original XY.
- Directed Gateway evidence can select its original source segment or a validated target-only Arrival Point. MAPJUMP 0x60 remains identity-only evidence; pseudo-world targets and incomplete geometry acquire no invented location or route.
- Session-only, bounded Field breadcrumbs and Back restore prior scene selections while preserving the original World camera, projection, Compare and layers. No new persisted history, loader, renderer, Field schema or game-data regeneration.
- Existing static Access analysis, camera/background and FieldLocal GeoPackage remain separate evidence tools. Runtime Gateway activation and unknown world landings remain UNKNOWN; no cross-Field path or global Field coordinate conversion.

## v3.8.0 — local RC, human accepted

- Read-only single-Field `field-gis export` from source-bound Context schema 3 / Walkmesh v1, using GDAL >= 3.9. No workspace regeneration, background embedding or dependency added to Web/portable Viewer.
- Standard undefined Cartesian GeoPackage (SRS -1): exact original Polygon Z, three directed Access edge slots, independent raw vertices/raw4, validated paired FIELD.TBL entrances, source Gateway segments, target-only arrivals and all exact 3D candidate relations. XY-only/disjoint evidence remains unchanged.
- Deterministic iterative WCC/SCC and optional explicit-start BFS/minimum-hop snapshots cross-checked against Web network results. Raw units are neither metres nor geography; runtime passability remains UNKNOWN.
- Bounded metadata, source/hash checks, authorized ignored outputs, no overwrite, atomic delivery and SQLite/OGR reread validation. Windows-only release policy is retained. Existing WM0 user-GIS exchange and Web camera/background tools remain separate.

## v3.7.0 — local RC, human accepted

- Original Section-2 camera records and raw Q12 projection in the existing Field Canvas, with manual camera selection, exact inverse camera centre, 240-pixel FOV basis and explicit near/behind-camera omissions.
- Bounded Section-4/9 parsing and compact private indexed-tile resource, independent visual pack schema 1. RC correction (`field-visual-2`): retain all Layer-0 tiles and the unconditional, unblended Layer-1 static subset in source depth/sub-ID order, covering original green placeholder texels instead of treating green as transparency. Only the visual component is regenerated; old visual resources remain readable. Only the selected scene is decoded; unsupported layers, conditions, blending and malformed references remain explicit. No original assets enter public builds or packages.
- Plan / Camera / Background Overlay share one renderer and selection, with shared pan/zoom, opacity, mesh edges, triangle IDs, five languages and preserved anchors/network analysis. Runtime camera choice, occlusion and game-screen alignment remain UNKNOWN.
- CI and exact-tag Release now target Windows x64 only. Historical Mac build code is unmaintained; no Mac repair or remote publishing in this local candidate.

## v3.6.0 — local RC, human accepted

- Field Static Network Analysis in the existing Canvas/Inspector: iterative deterministic WCC/SCC, raw directed Access BFS, reachability layers and least-crossing paths with original record offsets and anomaly evidence.
- Validated FIELD.TBL scenarios and target-only arrivals become independent starts. Exact 3D Gateway candidates retain ambiguity; XY-only/disjoint records receive no topology association, and no cross-Field route is inferred.
- Lazy mesh-scoped caching, explicit clear/mode/source cleanup, five-language controls and responsive keyboard/touch use. Existing Context v3, Walkmesh v1 and Python generators remain unchanged.
- Static topology is not verified gameplay reachability. No runtime/script simulation, physical distance, global Field coordinates or camera/background implementation. macOS ARM64/Gatekeeper remain pending.

## v3.5.0 — local RC, human accepted

- Field Spatial Anchors in the existing Walkmesh Canvas and Inspector: FIELD.TBL Default/Alternative entrances, raw source Gateway segments and target-only arrival points.
- Exact point/triangle and rational segment/surface checks; boundary, XY-only, disjoint, missing and world-target states remain explicit. Derived Raw Z is plane-derived, never recorded height or metres.
- Context schema v3 / `field-context-6`; previous v1/v2 contexts and the unchanged Section-5 binary remain readable. Incremental regeneration affects the Field component, leaving unrelated assets reusable.
- Five-language layers, keyboard anchor selection, Canvas hit testing and directed Field navigation; code-only public fallback remains private-data-free.
- Local Windows/Web validation; macOS ARM64/Gatekeeper remain pending. Field Network Analysis is deferred to v3.6; no runtime/script simulation or camera/background implementation.

## v3.4.0 — local RC, awaiting human acceptance

- Main-viewport Field Graph (SVG) and Field Walkmesh (Canvas 2D), sharing the existing Field selection, lazy decoder and Inspector.
- Responsive CSS/DPR fit, cursor-anchored zoom, pan/pinch, triangle-ID navigation, outgoing-neighbor/blocked-edge highlighting and raw-Z colour.
- Search/Atlas/Inspector workspace entry, direct scene switching and reversible World/Compare suspension without rebuilding the world Viewer.
- Raw XYZ/fourth component and static Gateway/MAPJUMP evidence preserved; no inferred global Field positions or regenerated game data.
- Five-language controls, source-only unavailable states and expanded real-scene browser/lifecycle coverage. Native macOS and human device acceptance remain pending; no publication in this task.

## v3.3.0 — local candidate, not yet published

- Native macOS ARM64 `.app` recipe with bundled Python/Tcl/Tk and the existing code-only browser Viewer.
- Read-only app resources separated from a stable writable Mac workspace; copied original PC data supported without a Windows game runtime.
- Native dependency/signature audit, permission/link-preserving ZIPs, isolated frozen HTTP smoke and coordinated Windows/Mac Actions artifacts.
- Windows build, Web and local non-climate regressions verified locally; native Mac build, Finder/Gatekeeper, target-device and Actions execution remain pending.

## v3.2.0

- Local user GaiaJSON ↔ GeoPackage exchange through the existing GDAL GIS owner.
- Original GaiaGame Float64 geometry, stable IDs, layer metadata and user attributes retained without reprojection.
- Five-language import preview with new-copy Merge and explicitly selected Update conflicts; no implicit deletion.

## v3.1.0

- Bounded original-PC Section-5 Walkmesh decoding in a strictly separate FieldLocal domain.
- One private binary scene pack with lazy per-scene decoding and source-bound incremental reuse.
- Inspector Canvas selection, directed-neighbor/blocked-edge evidence, pan/zoom and raw-component colouring.
- Existing Atlas/Field graph integration, old-context fallback and five-language compact touch controls.

## v3.0.0

- Native portable startup progress, remembered installation and recoverable retry/cancellation.
- Inline player shortcuts, clearer connected/public states and optional technical resource details.
- Direct Atlas Fly-to, content-first Location Inspector and corrected five-language spatial-status labels.
- Stable Save Inspector during unrelated settings changes and Player Fly-to; drawing tools focus the map.
- One repeatable player-flow browser suite alongside the existing Web/private Python regressions.

## v2.9.1

- Original-FF7 Atlas access/gameplay/reward facts with five-language text and per-fact sources.
- Content-first Inspector sections, collapsed technical evidence and spoiler-safe knowledge search.
- Reviewed source links, translated place labels and current authored content in older local workspaces; spatial precision unchanged.

## v2.9.0 — candidate, not yet published

- Bounded, source-indexed MAPJUMP archaeology alongside existing Field gateway topology.
- Reviewed Field-only context for Ancient Forest, Gelnika, Gold Saucer, Northern Cave and two reward groups; no fabricated global anchors.
- Inspector Spatial Evidence chains, source fingerprints, spatial-status filters and scoped scene graphs.
- Four source-reviewed Gelnika Save identities, with native maps and private workspace boundaries preserved.

## v2.8.0 — candidate, not yet published

- Private Field identities and verified section-8 gateway topology, linked to existing world entrances.
- Field Context in Atlas, Explore search and Inspector, with a lightweight interactive scene graph.
- Reviewed Current Field lookup for valid PC saves; conflicting and unknown IDs remain unverified.
- Optional incremental workspace payload, public fallback and strict separation of Field and global coordinates.

## v2.7.0 — candidate, not yet published

- Read-only PC/Steam 2013 Save Explorer with fifteen-slot checksum-aware parsing.
- Verified classic-PC WM0 player binding and save-aware Explorer/Atlas context.
- Portable Windows runtime and exact-tag Actions release recipe.
- Stable documentation, unified CLI/version authority and removal of sealed climate runtime.

## v2.6.0

- Local WM0 points, polylines and simple polygons with editing and layer management.
- Reference-sphere measurements and versioned GaiaJSON exchange.
- Search, Inspector, Tours/Nearby integration with private-share exclusion.

## v2.5.0

- Reviewed character-specific Explorer locomotion.
- Route profile, terrain composition and encounter exposure.
- Slope/aspect and routing-network service areas.

## v2.4.0

- Unified App Shell and contained desktop/mobile docks.
- Explicit workspace connection status and folder guidance.

## v2.3.0

- Local Bookmarks, Recent, Nearby and Guided Tours.
- Safe identity deep links and cartographic route playback.
- Layer opacity, unified legends and local reference-sphere scale.

## v2.2.0

- Offline authored Gaia Atlas with reviewed provenance.
- Places, secrets and reward cards with conservative spatial binding.
- Spoiler controls and unified local search.

## v2.1.0

- FF7-inspired presentation with an explicit Scientific theme.
- Original local UI audio and reviewed party appearance bindings.
- Lighting, colour correction and model presentation refinements.

## v2.0.0

- Incremental local workspace generation and automatic loopback connection.
- Manifest-driven optional asset compatibility and reuse.

## v1.9.0

- Local original models, skeletons and animation previews.
- Explorer movement controls and read-only asset provenance.

## v1.8.0

- Native WM2/WM3 maps and textures.
- Explicit coordinate-space separation and transition provenance.

## v1.7.0

- Local original terrain textures and presentation controls.
- Conservative relief rendering with source/reconstruction distinctions.

## v1.6.0

- Graticule, spherical measurements and projection analysis.
- Linked map Compare and accessibility/layout refinements.

## v1.5.0

- Static source-topology routing and movement profiles.
- Expanded thirteen-projection presentation.

## v1.4.0

- Source-backed world event anchors and trigger inspection.
- Static provenance rather than runtime event simulation.

## v1.3.0

- Terrain compatibility and traversal/reachability layers.
- Explicit movement-policy limitations.

## v1.2.0

- Source encounter zones, rates and Chocobo Tracks.
- Provenance-aware gameplay inspection.

## v1.1.0

- Named locations and validated entrance representatives.
- Search, Fly-to and source evidence Inspector.

## v1.0.0

- Read-only world geometry parsing and frozen V1 spherical reconstruction.
- GIS export and interactive Globe/map Viewer.
