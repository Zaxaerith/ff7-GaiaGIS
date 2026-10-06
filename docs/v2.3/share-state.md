# Safe ShareState and deep links

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
