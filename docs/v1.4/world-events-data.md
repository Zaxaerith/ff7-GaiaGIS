# World Events data and provenance

v1.4 adds an optional, locally generated JSON file. The existing V1 transport,
POI, encounters and traversal profiles are unchanged. Original code is
GPL-3.0-only; this does not license FF7-derived coordinate data for publication.

## Generate and load

From the project root, with Python 3.12+ and your own English FF7 installation:

```powershell
. ./scripts/use_workspace_environment.ps1
python -B scripts/build_event_assets.py --source 'YOUR_FF7_INSTALLATION'
```

Default output is `web/public/data/gaia-events.json`. Optional `--field-archive`
selects an English flevel.lgp; `--output` must remain within the workspace and
outside selected read-only source directories. No QGIS runtime is required for
this exporter. It reads binaries only and never imports game-directory scripts.
Existing V1 geometry must have been generated separately with the documented
V1 pipeline. Use **Load Events** after loading the original two V1 files. Local
development also loads the file when present. The public source-only build
makes no default data requests. Missing/bad event files leave geometry,
locations and encounters usable; invalid replacements retain the prior events.

Enable **World Events**, select a category and use **Go to event** or a marker.
Fly-to, morphing, front/back culling and reduced motion reuse v1.1 behavior.
**Script Triggers** colors the existing source triangles (script >= 3); selected
event trigger triangles receive a distinct tint. It works without the optional
event file for raw MAP triggers. Trigger tint has visual precedence over terrain,
encounter/traversal coloring and Chocobo Tracks; those attributes are unchanged.

## Schema version 1

Top-level fields:

| Field | Meaning |
|---|---|
| schema / version | `gaiagis-events` / `1` |
| reconstruction / mapping | `v1-geometric-gaia` and existing V1 parameters |
| world_extent | WM0 raw extent |
| sources | SHA-256 of WM0, world_us.lgp, wm0.ev, FIELD.TBL and maplist |
| events | Spatially anchored potential events |
| unresolved | Candidates retained with reason and script provenance |
| extraction | Function/opcode inventory, call graph, limits and counts |

Events retain identity/type/display name; game_x/game_north/game_height and
V1 longitude/latitude/height; anchor_kind/world_map; section/mesh/triangle IDs
and trigger_triangle_ids; function_id/anchor_function/call_table_record/
instruction_offset/basic_block/opcode/raw_arguments; model/entity/field/
entry/scenario/battle/location identities where known; condition_kind,
runtime_availability, source_file/source_record/confidence and notes.
Offsets are **16-bit code word offsets**, excluding the 0x400-byte call table,
not archive byte offsets. `function_id` is the packed call-table header.

Unknown fields are null. entity_id stays null because model identity is not
proof of a particular runtime entity. Height comes only from a containing
source triangle, tagged `interpolated_from_surface`; it is not field height.
When no source surface contains a placement, height and triangle_id remain
null. Overlapping containing triangles with different heights also retain null
height/triangle lineage: XY alone cannot identify the model's surface. Matching
coplanar boundary triangles use a deterministic triangle-ID tie break.
Marker rendering uses a separately documented display-only height 0.
No nearest-triangle estimate or visual placement is permitted.

## Anchor and identity evidence

| Anchor | Evidence / meaning |
|---|---|
| derived_trigger_centroid | Source MAP script triangle component; representative interior centroid, not exact runtime player position |
| derived_terrain_gate_centroid | Northern Cave terrain-27 engine gate; classic-PC-reference evidence |
| script_model_position | Explicit constant SET_MESH_POS/SET_LOCAL_POS pair; script-defined placement, not current position |

Disconnected trigger components keep separate anchors. A scheduled call can
inherit the triggering cause, never a guessed moving-entity position. Objects
keep neutral `Scripted Model N` names; no lore database is added. Field identity
comes from FIELD.TBL + English maplist. Optional location_id uses the existing
explicit field-name identity mapping, never fuzzy display-name matching.
There is no manually entered coordinate table and no enemy-name inference.
Scripted Battle IDs remain distinct from random encounter scene tables.

## Validation and determinism

Export sorting, compact JSON and newline are fixed; no time, absolute install
path or random value is embedded. Same input produces byte-identical output.
Frontend checks schema/version/V1 mapping, required hashes, unique IDs, enums,
ranges, limits, destination completeness and runtime semantics. WM0 fingerprint
must match loaded geometry. Source-lineage binding validates referenced mesh
cells/triangles, MAP script or terrain-gate identity, height bounds and centroid
or placement coordinate bounds. Metadata cannot establish runtime equivalence.
Inputs are capped at 5 MB / 5,000 events / 10,000 unresolved records.

Runtime availability is always `not_simulated`. Savemap/model/vehicle condition
categories are summaries of symbolic dependencies, not translated story
milestones. Unresolved candidates are retained for research, not plotted at
guessed coordinates. See [research](world-events-research.md) and
[local validation](validation.md).

## Public boundary

`gaia-events.json` is ignored, excluded from public build copying, and not
committed. Public synthetic EV and event fixtures contain invented values.
Private screenshots, QA logs, source snapshots and all generated JSON stay
under ignored workspace output. No raw script binary is redistributed.
