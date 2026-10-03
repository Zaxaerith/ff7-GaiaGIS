# Traversal profiles and data — v1.3

The public `src/gaiagis/traversal_profiles.json` is a small reference behavior
profile, shared directly by Python and TypeScript. It is **not** a derived map.
No `gaia-traversal.json`, generator, optional dataset loader, per-triangle copy
or normal extension is needed. Existing local V1 files remain required for map
geometry; POI/encounter files remain independently optional.

Schema `gaiagis-traversal-profiles`, version 1, compatibility
`classic-pc-reference`, current-executable equivalence
`not-verified-steam2026`. Each profile has stable id/name, model id, tint or null,
normal terrain mask, bridge-context sensitivity, exit-candidate mask and
departure-initiation mask or null. Null means not applicable, not invented data.
Hexadecimal masks are unsigned 32-bit facts; bit index is terrain 0–31. No
terrain/region names participate in evaluation.

`gaiagis.traversal.evaluate` / `evaluateTraversal` return state, reason,
evidence, profile, static terrain compatibility, movement-unknown,
departure initiation, completed-entry/exit-unknown and runtime-not-simulated.
An explicit scope distinguishes terrain occupancy from Highwind landing
initiation; Highwind airborne terrain occupancy is not assessed by that mode.
The primary map shows ordinary
terrain masks. **It does not use current bridge/vehicle/save state.** Human and
Chocobo bridge-context exceptions are explicitly explained in the Inspector.
The compact matrix compares ten normal profiles at the same source triangle.
Highwind is the exceptional profile: ordinary grass initiation, conditional
Northern Cave script path, conditional grass/script-7 destination issue, all
other terrain blocked for ordinary landing. These are not air-travel results.

`reference_gate` / `referenceGate` provide a separate local predicate diagnostic
with explicit model/tint, current terrain/model, leave state, airborne flag and
flight state. It preserves the script !=7 exit gate and bridge override. Its
default context is ordinary non-exit, non-bridge terrain comparison; it cannot
infer the user's current gameplay state. Unsupported model IDs return unknown
rather than exploiting the reference default-success branch. Invalid terrain,
script, packed input or supported tint raises an explicit error.

`chocobo_exit_height_compatible` / `chocoboExitHeightCompatible` accepts integer
**raw game heights**, checks |candidate - current| <200, and does not convert to
metres or assess slope. It evaluates one supplied candidate sample, not the
engine's entire five-sample/multiple-group exit search. Actual samples and
position history are not available in a static triangle. The Viewer displays
the constraint and leaves completion unknown; no synthetic exit points are made.

## Viewer and lineage

Display → Color layer → Traversal; Movement mode selects one of ten profiles.
Colors distinguish Allowed/Conditional/Blocked/Unknown. Allowed means static
classic-PC terrain compatibility, **not** present-day gameplay availability or
global reachability. Polar caps are unknown because they have no FF7 attributes.
Unused source terrain codes still have explicit mask results; their names do
not cause arbitrary unknown states.

Existing `terrain`, `script`, `origin` and source lineage are sufficient. Original
region/texture/Chocobo high bits do not alter this mask predicate. `renderToSource`
keeps projection fragments bound to canonical triangle IDs. The surface's
existing color buffer is updated; no new geometry, index buffer or vehicle mesh
is created. Traversal does not change latitudes, longitudes, height scale,
projections, selection or POI coordinate transformation.

Chocobo Tracks remains an independent source-flag overlay, with its own yellow
legend; it can override traversal colors while enabled. It is neither a terrain
capability nor a guarantee of capture. Encounter and Traversal sections coexist
without sharing runtime eligibility logic. Locations/search/fly-to and their
Inspector remain intact. No vehicle field-access claim is derived from a POI.

## Reproduce locally

```powershell
. .\scripts\use_workspace_environment.ps1
python -B scripts/inspect_traversal.py
python -B scripts/inspect_traversal.py --source 'YOUR_FF7_INSTALLATION'
python -B -m unittest discover -s tests -p test_traversal.py -v
Set-Location web
npm test
npm run build
npm run build:release
npm run audit:release
```

`inspect_traversal.py` writes aggregates/matrix to ignored `output/v1_3/`, guarded
by the existing workspace path isolation. Private real-source tests opt in via
`GAIAGIS_SOURCE_ROOT`; absent input skips clearly. `browser-traversal-qa.mjs`
requires locally generated V1/POI/encounters, a local dev server on 5173 and
source-only preview on 5175; its Chrome cache/temp/screenshots are in ignored
workspace output. It reads the Python matrix for cross-language QA. No files
are uploaded or saved in the game installation.

Sources, full model inventory and the strict evidence/runtime limitations:
[traversal research](traversal-research.md). GPL-3.0-only covers original GaiaGIS
code; reference decompilation and third-party dependencies retain their own
status. No unlicensed implementation is copied or bundled.
