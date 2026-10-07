# Navigation user state

GaiaGIS v2.3 adds personal browser state independently of `GaiaWorkspace` and
project schemas. No account, sync endpoint, telemetry or upload is involved.
The single owner is `UserStateStorage`, using `gaiagis.user-state` in localStorage.
Schema is `gaiagis-user-state`, version 1. Existing language, presentation and
legacy view settings retain their established owners; v2.3 adds no separate
bookmark, history or tour storage keys.

The allowlisted document contains bookmarks, recent items, tours, and navigation
preferences (eight layer opacity values, ten registered visibility values and scale visibility).
Validation rejects unknown fields, malformed identities, duplicate record IDs,
invalid or degenerate cameras, mismatched-map selections, timing/opacity, excessive arrays and oversized serialized input.
Version 0 `favorites` identities migrate into version 1 bookmarks. Unknown future
versions and corrupt input recover to empty session state. Unavailable storage or
quota errors preserve edits in memory and display that persistence is unavailable.
There are no workspace blobs, screenshots, route arrays or copied Atlas facts.

Bookmarks support Location, Atlas, Entrance and Transition identities. Identity
bookmarks store kind, ID and map ID, name, short note and creation time. They resolve
against current navigation owners when opened. Renaming edits local text; deleting
also removes bookmark history references. Missing identities or spoiler-hidden
entities produce an explicit unavailable message. Local View bookmarks additionally
save bounded camera position/target/up/zoom, projection center, map/view mode, layer
preferences and an optional identity selection. Native view cameras remain native;
they do not acquire geographic coordinates. Public mode can save a view without a
camera. Camera values stay local and are excluded from links and tours.

Recently Viewed holds at most 30 items. Reopening an identity or bookmark moves its
existing entry to the front. It records the four supported identity kinds and
bookmark opens, never incidental triangle picks. Entries resolve names from current
owners rather than preserving copies of Atlas summaries.

Data → Clear local user data offers All, Bookmarks, Recent, Tours or Navigation
preferences. A second in-app dialog confirms the selected operation, with Cancel
focused first. Resetting navigation preferences restores v2.3 opacity/visibility
and scale defaults. It does not delete workspace files or reset older theme/audio/
language settings. Clear does not make an external request.

Limits: 200 bookmarks, 30 recent entries, 30 tours, 100 stops per tour; input JSON
is limited to 400,000 characters. A larger valid edited state stays in memory with
an explicit persistence warning rather than being saved as unreadable input. Browser storage is origin-specific, so localhost
and public Pages have separate personal states. There is no cross-origin sync.

Personal bookmark names, notes and saved tour names are preserved across UI locale
changes; they are not implicitly translated.

## Nearby and What's Here

Nearby resolves existing navigation owners; it does not geocode authored prose.
Only validated WM0 Location/Atlas place/Transition anchors with exact-source,
verified-anchor or entrance-level authority enter the index. Duplicate Atlas and
Location representatives at the same point are shown once per group. Entrances
remain bookmarkable but are not repeated as Nearby places.

Parent-place, field-only and unresolved rewards are excluded. Their parent place
may independently appear as an eligible place; no reward is assigned that parent's
distance or a fake exact point. Spoiler-hidden entities are removed by the existing
Atlas registry before indexing. No new locations, bindings or precision upgrades
are authored in this version.

The small index precomputes unit vectors and performs a linear scan. Great-circle
distance is `R * atan2(norm(cross(a,b)), clamp(dot(a,b),-1,1))`, with existing V1
reference radius 6,371,008.8 m. This is horizontal reference-sphere distance, not
surface terrain length, route length or a measurement of canonical FF7 geography.
Tests cover the antimeridian, poles, coincident anchors and radius exclusion.
Measured real-workspace query timings and eligible/excluded counts are recorded in
[validation](../development/testing.md).

Explore → Nearby offers nearest results or 50/100/250/500 km radius, bounded to
20 displayed results grouped into Places, Secrets and Transitions. An Inspector
Nearby action uses that entity's verified anchor. Near view center uses the existing
resolved geographic center. What's Here arms a one-shot canvas point selection,
using the existing projection inverse or a reference-sphere ray intersection.
That transient point is never added to storage or links. Outside the inverse domain
there is no fabricated result. WM2/WM3 native maps and Explorer make Nearby
unavailable; no WM0 transformation is invented for native maps.

## Guided Tours and Route Playback

Tours are version-1 user state records: ID, name, creation time and ordered stops.
A stop contains an ID, identity target, duration (1–120 seconds) and short title.
There are no coordinates, route nodes, snapshots, game assets or copied knowledge.
WM0 Location, Entrance, validated Transition and Atlas place identities are supported.
View bookmarks and native targets are excluded from the builder. Atlas places
without a current anchor can be informational card stops, with no camera Fly-to.
Reward records are not navigable tour stops.

Inspector → Add to tour builds a draft. Bookmarks → Add to tour or Tour from
bookmarks reuses identity bookmarks. Draft stops allow title/duration editing,
reordering and removal before saving. Saved tours persist in the central local
state; Edit copies stops to a new draft, allowing an independently saved tour.
There is no cross-map cinematic controller. Tour export/import and a built-in
sample tour are deferred: neither is required for this local RC.

Controls are Play, Pause, Previous, Next and Stop. The controller resolves each stop
against current owners, opens its card and reuses existing GaiaViewer Fly-to.
Missing/hidden stops are skipped. Reduced motion uses immediate existing focus,
not large camera animation. Pause stops the current flight and hold timer. Completion
or Stop restores the captured overview map/projection/camera/layers/selection.
Starting one playback pauses the other; applying a saved view pauses both.
Map changes and Explorer entry pause playback; disposal cancels callbacks and
restoration. No second camera system or Explorer autoplay is introduced.

Route Playback consumes only the current solved runtime corridor. The routing
worker, Dijkstra, graph, weights, movement profiles and result distances are unchanged.
The progress overlay has a prebuilt geometry sharing the current route's position
and visibility buffer attributes. Each tick changes an even draw range; it does not
rebuild geometry or solve a route. Projection morphing uses the existing projected
route buffer. Private points remain runtime-only.

Route controls are Play, Pause, Restart, Stop, speed 0.5/1/2/4× and optional Follow.
Follow samples existing corridor points through the existing focus method at most
about eight times per second; reduced motion disables Follow camera changes. Manual
camera navigation remains available. Map changes or Explorer pause playback;
replacing/clearing the route resets playback. Playback does not claim character
movement, terrain traversal animation or real-time FF7 travel speed.

## Safe ShareState and deep links

`gaiagis-share-state`, version 1, is an explicit allowlist. Copy link constructs
language, map ID, projection ID, native view mode, registered layer IDs, spoiler
mode and an optional public Location/Atlas identity. It never serializes AppState.
The encoder clears the incoming query, fragment and URL credentials. HTTP(S)
origins only are supported; file/data/javascript origins are rejected.

URL fields are `lang`, `map`, `projection`, `view` (native only), `layers`, `spoilers`,
and at most one of `place` or `atlas`. Known five-language/map/projection/layer/spoiler
values and the existing public authored-content identity lists are checked. Duplicate
parameters, unknown fields, invalid values, private IDs, conflicting targets and URLs
longer than 1,000 characters are rejected. A stale public target is discarded while
valid map/UI state can still load. Invalid links leave the standard application usable.

Example: `?place=midgar`. With the current local validated POI this opens the existing
Location/Atlas context. In public source-only mode it opens the Midgar authored Atlas
card with no spatial marker or camera Fly-to. Local automatic loading waits for the
workspace to finish before applying a target, so late owner adoption cannot erase it.
Spoiler-hidden targets remain hidden; links do not override the requested spoiler mode.

Forbidden values include latitude/longitude, XYZ, native positions, camera state,
triangle/section/mesh/node IDs, source hashes, route arrays, workspace payloads,
source paths, credentials, screenshots and local bookmark/view IDs. Local View
bookmarks may contain bounded camera state, but Copy link explicitly omits it.
The UI states this omission and exposes the safe link for manual copying if clipboard
access is unavailable. No share service, automatic upload or remote persistence exists.

Source links inside Atlas cards retain explicit click-only navigation. Sharing and
offline discovery do not fetch a Wiki page, article HTML, prose or image.
