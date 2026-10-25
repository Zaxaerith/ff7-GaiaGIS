# My Save

Import your own original FF7 PC / Steam 2013 `.ff7` save through **Data → My Save**. Parsing uses the browser File API; no upload or arbitrary-file HTTP endpoint is involved. A file contains fifteen slots, not one save. Choose a valid slot after reviewing empty/corrupt/checksum status. Reimport replaces the in-memory file; Clear removes the session state.

Inspector shows source-supported location text, game time, Gil, party members and levels/HP/MP, progress/raw state and world-position evidence. Unknown or unverified fields stay labelled. Story stage is never inferred from play time. Steam 2026 runtime equivalence remains unverified.

## Position and Explorer

Only the verified classic-PC WM0 world-module packing can produce a global Player Position. The parser validates module/map semantics and uses the frozen GaiaGame conversion. Field saves can contain stale world records: these never produce a global marker. WM2/WM3, unsupported map states or unverifiable packing show raw world coordinates only.

With a verified position and local geometry, Fly to Player, Explore from Here and Route from Player use existing systems. Source-only mode preserves information without fabricated navigation. Save-aware Explorer uses verified identities when available; subsequent movement is **GaiaGIS preview state**, never a save write or a claim about unlocked game content.

Atlas Save Context shows only parsed, verified state. Its existing spoiler filter remains authoritative; there is no guessed story-flag filter.

## Current Field

For a valid **field-module** slot, **Open Current Field** opens its existing
Walkmesh workspace and Inspector. Load the workspace generated from the
corresponding own installation. The reader uses the module and location ID, not
the preview text or stale world objects. Source-only mode, missing scenes and
unverified identity mappings retain the raw location ID with Unknown / Unverified.

With matching Field/Walkmesh sources, the saved signed X/Y and original Triangle
are checked exactly. An inside/boundary result receives a **Saved Field position**
marker. Its Z is interpolated from the current Walkmesh, not a saved character
height. Direction is shown only as its raw 0–255 value. Outside, invalid or
degenerate Triangles retain their raw values and reason without a marker or
snapping. Missing Walkmesh still permits the verified Field identity to open.
Clear, slot/import changes and leaving/replacing the Field or Workspace remove
the transient point and cancel pending placement. Reopen explicitly to locate it.

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

## WM0 static initialization prediction

The Save Inspector displays a predicted research state and cumulative groups
only when a loaded, validated source identifies one of the four reviewed
complete EN/FR/DE/ES `wm0.ev` fingerprints.
It uses a separate signed progress interpretation and three precise bits; the
original unsigned progress display remains available. Missing/mismatched sources
produce Unknown, including conflicts between two reviewed EVs. Inputs and the
EV fingerprint can be inspected alongside the result.

This is the verified script source's static result for the selected save inputs,
not an observed runtime state, a story chapter or a guarantee about later scripts.
**Open World Variants research** opens the existing research controls. Importing
its optional data and enabling/selecting a research state remain explicit actions;
the prediction never changes visible terrain or BASE routes.

## Privacy

Only parsed summaries remain in current-session memory after parsing; raw bytes,
filename and path are not retained. Save positions and predictions are not written
to localStorage, share URLs, navigation history, GaiaJSON, workspaces or packages.
Save files and Steam Cloud data are never edited or repaired. Only explicit import
reads a chosen file.

See [format and spatial evidence](../reference/save-format.md).
