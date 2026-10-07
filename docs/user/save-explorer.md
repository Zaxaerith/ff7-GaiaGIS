# My Save

Import your own original FF7 PC / Steam 2013 `.ff7` save through **Data → My Save**. Parsing uses the browser File API; no upload or arbitrary-file HTTP endpoint is involved. A file contains fifteen slots, not one save. Choose a valid slot after reviewing empty/corrupt/checksum status. Reimport replaces the in-memory file; Clear removes the session state.

Inspector shows source-supported location text, game time, Gil, party members and levels/HP/MP, progress/raw state and world-position evidence. Unknown or unverified fields stay labelled. Story stage is never inferred from play time. Steam 2026 runtime equivalence remains unverified.

## Position and Explorer

Only the verified classic-PC WM0 world-module packing can produce Player Position. The parser validates module/map semantics and uses the frozen GaiaGame conversion. Field saves can contain stale world data: they do not produce a marker. WM2/WM3, unsupported map states or unverifiable packing show raw coordinates only.

With a verified position and local geometry, Fly to Player, Explore from Here and Route from Player use existing systems. Source-only mode preserves information without fabricated navigation. Save-aware Explorer uses verified identities when available; subsequent movement is **GaiaGIS preview state**, never a save write or a claim about unlocked game content.

Atlas Save Context shows only parsed, verified state. Its existing spoiler filter remains authoritative; there is no guessed story-flag filter.

## Current Field

For a valid **field-module** slot, My Save can show **Current Field** and open its
existing Inspector / Field Context. Load the workspace generated from the
corresponding own installation. The reader uses the module and location ID, not
the preview text or stale world objects. Source-only mode, missing scenes and
unverified identity mappings retain the raw location ID with Unknown / Unverified.

Field Context lists source-backed incoming/outgoing gateways and parent context.
Explore also searches Field Scene names and IDs. Place Cards offer a scene list
and a lightweight relationship diagram with parent filter, pan, zoom and neighbor
selection. The graph includes verified gateways and bounded MAPJUMP evidence. It remains
partial; story conditions and other jump semantics are unverified.
Fly to verified world entrance visits the existing world entrance, never an
invented interior point. WM2/WM3 do not acquire a global Field transform.

The current PC maplist ordering is reviewed against pinned ff7tk module/location
identities. The four Gelnika IDs require exact qa–qd archive names plus their
q_1–q_4 script headers, resolving that reviewed naming difference. Other
conflicting reference names and unreviewed maplists have no Save→Field binding. This does not claim Steam 2026 executable equivalence. World-module slots
continue to use the established verified Player Position policy.

## Privacy

Raw bytes and parsed state stay in current-session memory. They are not written to localStorage, share URLs, generated workspaces or packages. Save files and Steam Cloud data are never edited or repaired. Only explicit import reads a chosen file.

See [format and spatial evidence](../reference/save-format.md).
