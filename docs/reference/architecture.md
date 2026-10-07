# GaiaGIS application architecture

GaiaGIS uses TypeScript, Vite and Three.js without a UI framework or backend.
The application integration preserves the established parsers, source topology, V1
mapping, thirteen projections, static gameplay evaluators and Explorer walker.

## Application boundaries

`web/src/app/state.ts` defines immutable Data, Map, View, Selection, Analysis,
Explorer and Preferences slices. Map identity/coordinate space is independent of
the selected projection and native camera mode. A map change invalidates selection
and map-specific analysis and exits Explorer; changing a projection does not
change source identities or physical measurements. Features query capabilities
from actual loaded/legacy data, current map and interaction mode, rather than
assuming every menu works everywhere. The feature registry describes feature
families, their maps, requirements, preferred panel and default visibility.

State stores small identities, statuses and tool intent, not copies of meshes,
texture images, routing arrays or entire datasets. Feature owners retain those
resources. Navigation stores references and callbacks for verified locations,
entrances and transitions. Triangle, location/entrance, event and native/transition owners dispatch selection
identities directly. Route/measurement result controls and encounter context actions
use the same state; Explorer restores its preceding selection on exit. The shared
Inspector borrows existing renderers/results, not a new coordinate authority.

## Ownership and disposal

- `main.ts` owns the active WM0 Viewer and replaces it on base dataset adoption.
- `mountMultimap` owns decoded native maps, native texture buffers and its one
  active native renderer. Switching maps disposes the previous native renderer;
  replacing a workspace also clears its old source-bound caches.
- Feature modules own their optional data and adopt it through existing codecs.
  Their registered workspace load ports replace prior ports on WM0 recreation.
- Explorer owns the model instance, input listeners, placement state and restored
  camera snapshot. Disposal is idempotent; replacement cancels obsolete pack
  loads. Explorer v2 borrows source surfaces from existing owners.
- Routing owns its worker and request guards. Projection comparison owns its
  temporary second rendering context and releases it when disabled.
- The shell owns its moved controls, observers, subscriptions, onboarding, HUD
  and shared Inspector container. `ResourceScope` releases these once in reverse
  order and restores persistent controls before layout replacement.

Only one interaction system captures map input at a time. Explorer suspends
analysis and overview controls and restores their previous values on exit.
The mobile Explorer drawer closes automatically so it cannot cover the touch pad.

## Loading and code splitting

Workspace discovery validates basenames, schema, map IDs, lengths, file hashes,
dependency references and cycles. Existing feature codecs then validate transport
versions, payload checksums and lineage. Cross-asset source hashes must agree.
Adoption is ordered and serialized; cancellation prevents obsolete follow-on
steps, and a newer request cannot be overwritten by a delayed older owner.
Optional corruption is isolated. Native maps and Explorer remain lazy imports;
WM0 rendering code loads only after geometry validation.

The six primary panels are Explore, Layers, Analysis, Map, View and Data.
A separate common Inspector contains the existing context renderers and actions;
WM2/WM3 show native coordinates, never fabricated longitude/latitude. Preferences
contain safe strings only. Diagnostics expose statuses, sizes and source hashes,
not paths, selected coordinates, save-state data or file content.

See [workspace contracts](workspace-format.md). Resource caching is scoped to active data
owners; there is no disk scan, persistent decoded-asset cache or network upload.


## Gaia Atlas

Atlas adds offline authored place knowledge, secrets and collectible/reward discovery to Explore search. Search names, aliases, categories, regions and item names; one-edit spelling fallback follows literal matches. The shared Inspector shows localized overview, type/region, access, gameplay, discoveries, related places, precision/evidence and reviewed sources. Sources are external links opened only when requested. The default spoiler setting hides major story rewards, including their search aliases; select Show all deliberately to reveal them.

Layers has Places, Secrets and Collectibles switches. Collectibles marks verified parent-place entrances only, never a chest or interior reward position. An entrance-level card enables existing route, measurement and Explorer actions. Parent-place/field-only cards offer Fly to parent place; unresolved records have no map point. Gold Saucer, Northern Cave, Ancient Forest and Sunken Gelnika retain searchable knowledge without guessed global placement. Native WM2/WM3 positions are never treated as geographic coordinates.

The local launcher generates the optional ignored `gaia-atlas.json` through the existing workspace builder, with curated-content, POI, source, transition and generator fingerprints. Warm reuse remains offline. Old workspaces without Atlas retain bundled knowledge with currently validated POI bindings. Public source-only pages can search/read knowledge without a spatial pack. Atlas can display optional parsed Save Context; it does not simulate treasure-collected state, battles or field rendering.

See [Atlas schema, spatial binding and provenance](atlas.md). Source-only distribution remains mandatory; all generated packs and screenshots stay ignored.


## Navigation & Discovery

`app/userState.ts` owns versioned personal browser state independently of workspace
and AppState asset lifetime. Validation/migration/fallback run before state is exposed;
one localStorage key persists identities, local views, tours and navigation preferences.
`app/navigation.ts` exposes current owner lookup and verified anchor metadata.
`navigationActions.ts` and the extended Feature/Layer registry centralize capability
and opacity defaults. AppState preference opacity mirrors central stored preferences;
it does not introduce another persistence key.

`shareState.ts` is a distinct public-ID/UI allowlist, never a generic AppState serializer.
`navigation/nearby.ts` precomputes vectors for a bounded linear scan using existing
sphere authority. `playback.ts` owns lightweight lifecycle state; its UI adapter uses
existing owner inspection and Fly-to. GaiaViewer publishes only the current runtime
corridor; RouteOverlay adds a prebuilt shared-buffer progress draw range.
`navigation/scale.ts` samples existing inverseDisplay/reference-sphere rays.

The lazy `ui/discovery.ts` owner integrates the existing six panels and cleans up
listeners, animation hooks, route callbacks, dialogs and moved legend elements on
replacement/disposal. Native maps retain separate cameras and no geographic transform.
Explorer entry pauses overview playback and hides unavailable tools. Automatic local
workspace completion precedes deep-link target application. Navigation delegates to the existing solver, projection, spatial pipeline and Explorer controller.

See [navigation state](../user/navigation.md), [spatial eligibility](../user/navigation.md),
[playback lifecycle](../user/navigation.md), [safe links](../user/navigation.md),
[scale/layers](cartography.md) and [validation](../development/testing.md).

## Analysis ownership

`analysis/spatial.ts` provides pure source-TIN gradient and solved-corridor summary
functions. GaiaViewer owns a lazy mesh-scoped slope/aspect cache and shares its
color attributes with Compare. `analysis/serviceArea.ts` adds bounded Dijkstra
through a distinct routing-worker request, borrowing existing graph/eligibility
owners; the route solver and weights are preserved. No additional spatial pack
or per-frame attribute computation is introduced.

`ui/spatialAnalysis.ts` mounts into existing Analysis and Layers, borrows runtime
owner datasets, rejects stale asynchronous results and clears/disposes controls
with the active viewer. Source-only startup owns explicit unavailable cards.
Native maps and Explorer use existing capability boundaries. Three registered
layers share opacity/reset/legend defaults. Exact v2.4 stored layer records receive
the new defaults during validation so saved views, bookmarks and tours survive;
other malformed records remain rejected.

`explorer/locomotion.ts` contains exact own-source binding selection and preview
rate policy. Model instances cache display floor offsets for those reviewed clips;
raw animation and skeleton data remain unchanged. The controller continues to own
all displacement, terrain eligibility and lifecycle. See [spatial methods](spatial-analysis.md).

## App shell and component system

The shell owns one header/footer boundary and one dock frame. Geographic and native
views use the same CSS slots. Existing renderer ResizeObservers handle slot changes;
no camera/projection/mathematical changes are required.

- At 1100px and above, the left dock reserves 324px while open; the optional right
  Inspector reserves 316px. Both can collapse independently, returning space to the map.
- Below 1100px, docks become overlays instead of squeezing the main viewport.
- At 700px and below, drawers occupy at most 72dvh within the header/footer frame.
  Opening one drawer hides the other. Selection opens the Inspector; toolbar controls
  can reopen or collapse either panel. Escape returns focus to its toolbar button.
- Docks use min-width/min-height zero, viewport-bounded height and internal scroll.
  Long Atlas cards scroll with their Inspector, avoiding nested card scroll traps.
- Analysis endpoints and results share the same card/field treatment. Existing
  calculation IDs/owners are preserved; public mode gets a workspace-required empty state.

The final scoped app-shell stylesheet unifies legacy owners through shared palette,
background/rim, active state, spacing, type hierarchy, focus rings, buttons, cards,
dialogs, status/footer and scrollbars. Nested Inspector/Analysis owners are content
containers rather than independent windows. FF7-inspired presentation remains the
default; Scientific explicitly changes the same tokens. GIS thematic swatches retain
their semantic colors. Map markers retain transparent hit areas rather than inheriting
window-button chrome.

The shell is presentation and lifecycle infrastructure; mathematical and source authority remain with their existing owners.

## Personal mapping and save ownership

`app/userState.ts` and its storage abstraction own migrated local UserLayer/UserFeature data. GaiaGame coordinates are stored once; projection/Globe/Compare buffers are derived display resources. Geometry and notes are excluded from public ShareState. See [GaiaJSON](gaiajson.md) and [User Mapping](../user/user-mapping.md).

`data/save.ts` parses explicitly imported PC files and their slots. `app/saveSession.ts` holds bytes/parsed selection only in session memory. Verified classic-PC WM0 bindings reuse frozen conversion; field/native/unsupported records remain raw. Save preview controls borrow existing Explorer and routing owners, never write a save or establish runtime unlocks. See [save evidence](save-format.md).

## Python, version and distribution boundaries

`src/gaiagis/` owns installed application code. Its unified CLI routes local, validate, build-workspace and build-sphere to the existing entry functions. The one-file root adapter preserves uninstalled checkout invocation. Shared `native_workspace.py` removes source/frozen exporter duplication; `runtime.py` only configures an existing optional QGIS process environment.

`_version.py` supplies setuptools metadata, local status, Vite build and portable manifest. Component/schema versions independently govern data compatibility. Climate runtime and candidate-orientation diagnostics are absent; only the sealed conclusion remains.

Maintained freeze/audit/smoke tools are in `tools/build/`. Ordinary CI, source-only Pages and exact-tag Release packaging have separate workflows. Local outputs are ignored developer evidence; official ZIPs originate from the approved tag's Actions checkout. See [release process](../development/release-process.md).


## Field / World integration

`src/gaiagis/field_context.py` owns the bounded PC maplist, section-8 gateway and targeted section-1 MAPJUMP
reader and optional private `gaia-field-context.json` exporter. It extends the
existing incremental workspace recipe, not a separate extractor or build system.
Field identities are archive/maplist IDs and internal names; Field local
coordinates are never transformed into GaiaGame or geographic coordinates.

`web/src/data/fieldContext.ts` validates the compact identity/evidence contract,
revalidates entrance bindings against loaded POI lineage, and builds incoming /
outgoing adjacency and gateway-only strongly connected components once. Components permit
only explicitly labelled mutual topological association; they are not geographic
containment. Names, proximity and world coordinates never establish membership.

`ui/fieldContext.ts` owns the private index, existing Explore search registrations,
Atlas Field Context, shared Inspector card and event-driven SVG topology browser.
Pan/zoom respond to pointer/wheel/buttons; no graph library, backend, force loop
or new main navigation page is introduced. Search entries have no geographic
anchor, persistent identity target or ShareState entitlement. Disposal removes
ports/listeners/diagram and invalidates pending loads; workspace replacement clears
source-bound context. The Save owner borrows the in-memory index through the same
scoped event boundary. See [Field contracts and evidence](atlas.md#field-context).


Spatial provenance remains in these same owners: authored Atlas Field identity
requests, source-bound gateway/MAPJUMP/native-entry metadata, and shared Inspector
evidence rows. The one Field payload is incrementally invalidated by POI and
transition fingerprints. Conditional script edges do not change containment or
Atlas geographic precision. Contextual field_only resolution is invalidated
with the in-memory Field index; no second archaeology pack or storage system is
introduced. Current contracts are documented in [Atlas/Field evidence](atlas.md).
