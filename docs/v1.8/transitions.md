# Map transitions

The analyzer reuses the shared EV decoder and bounded world-event analysis.
Constant propagation, branch reachability, scheduled calls, return, widening,
cycle/state/instruction/depth guards remain bounded. No story or save state is
executed. Map-specific placement bounds are explicit; engine chunk headers
retain the classic 36-column addressing convention. Native positions use the
documented map-specific offset and exact source MAP trigger components.

| From | To | Source/destination anchor | Transform | Evidence / conditions |
|---|---|---|---|---|
| WM0 | WM2 | Both runtime-dependent | Reference native-engine offset | Classic model 13, terrain 3 and button edge; dispatcher/save restoration |
| WM2 | WM0 | Both runtime-dependent | Reference native-engine offset | Same controls; additional EXIT_UNDERWATER opcode path retained |
| FIELD | WM3 | Both unresolved | Link only | Dispatcher snowfield world-entry range ≥0x3c; no source field spatial anchor inferred |
| WM3 | FIELD | 25 anchored trigger-component records | Link only | Constant ENTER_FIELD destinations; runtime branch conditions retained |
| WM2 | FIELD | 2 anchored, 5 unanchored records | Link only | Field ID/table evidence; dynamic positions remain unresolved |

The full local inventory also retains WM0 field exits. A world-to-field exit is
not automatically a field-to-world re-entry or a paired global transform.
Native field exit destinations include internal maplist identity; names do not
drive coordinate inference. No nearest triangle or visually guessed pair is
created. The 25 WM3 records lead to `move_s`, `gaiafoot` and `hyou12` identities.
They are not 25 unique locations or proof of an Overworld-to-Glacier affine map.

The two explicit surface/undersea reference links and one actual WM2 opcode
site have no fixed source point; they appear in the evidence list, never as
invented markers. `Open linked map` changes the Viewer map. A resolved target
point would focus the native camera; unknown points remain null. `Return to
Overworld` is Viewer navigation, not a simulation of gameplay exit conditions.
Markers are only created for spatially anchored native records. There is no
reliable direct WM0-to-WM3 marker in this release.

Each record retains map identities, anchor kinds, native position or null,
lineage, call/function/word offset, opcode, raw arguments, field identity,
condition categories, evidence and runtime availability `not_simulated`.
The JSON is local-generated and ignored; only the analyzer/schema/tests/docs
are distributed. Current Steam2026 runtime equivalence remains NOT VERIFIED.
