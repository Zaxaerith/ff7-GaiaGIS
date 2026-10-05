# GaiaGIS application architecture

GaiaGIS uses TypeScript, Vite and Three.js without a UI framework or backend.
The v2.0 integration preserves the established parsers, source topology, V1
mapping, thirteen projections, static gameplay evaluators and Explorer walker.
The pre-implementation [audit](v2.0/architecture-audit.md) records the baseline.

## Application boundaries

`web/src/app/state.ts` defines immutable Data, Map, View, Selection, Analysis,
Explorer and Preferences slices. Map identity/coordinate space is independent of
the selected projection and native camera mode. A map change invalidates selection
and map-specific analysis and exits Explorer; changing a projection does not
change source identities or physical measurements. Features query capabilities
from actual loaded/legacy data, current map and interaction mode, rather than
assuming every menu works everywhere. The feature registry describes ten feature
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

See [workspace](v2.0/workspace-format.md), [data compatibility](v2.0/data-compatibility.md)
and [integration](v2.0/integration.md). Resource caching is scoped to active data
owners; there is no disk scan, persistent decoded-asset cache or network upload.


## Gaia Atlas (v2.2)

Atlas adds offline authored place knowledge, secrets and collectible/reward discovery to Explore search. Search names, aliases, categories, regions and item names; one-edit spelling fallback follows literal matches. The shared Inspector shows localized overview, type/region, access, gameplay, discoveries, related places, precision/evidence and reviewed sources. Sources are external links opened only when requested. The default spoiler setting hides major story rewards, including their search aliases; select Show all deliberately to reveal them.

Layers has Places, Secrets and Collectibles switches. Collectibles marks verified parent-place entrances only, never a chest or interior reward position. An entrance-level card enables existing route, measurement and Explorer actions. Parent-place/field-only cards offer Fly to parent place; unresolved records have no map point. Gold Saucer, Northern Cave, Ancient Forest and Sunken Gelnika retain searchable knowledge without guessed global placement. Native WM2/WM3 positions are never treated as geographic coordinates.

The local launcher generates the optional ignored `gaia-atlas.json` through the existing workspace builder, with curated-content, POI, source, transition and generator fingerprints. Warm reuse remains offline. Old workspaces without Atlas retain bundled knowledge with currently validated POI bindings. Public source-only pages can search/read knowledge without a spatial pack. No save-state, treasure-collected state, battle or field renderer is included.

See [research](v2.2/atlas-research.md), [schema](v2.2/atlas-schema.md), [spatial evidence](v2.2/spatial-binding.md) and [local validation](v2.2/validation.md). Source-only distribution remains mandatory; all generated packs and screenshots stay ignored.
