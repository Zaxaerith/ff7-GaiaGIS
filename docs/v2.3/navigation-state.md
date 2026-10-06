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
