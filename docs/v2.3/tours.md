# Guided Tours and Route Playback

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
