# Field Evidence GIS Export

Use the source CLI to create a private GeoPackage for one Field and optionally a colocated QGIS project. The export brings together the original FieldLocal geometry and separate script and event attributes.

## Export

Use Python with GDAL ≥3.9. On Windows the existing adapter accepts the root of an installed QGIS/OSGeo4W environment via `GAIAGIS_QGIS_ROOT`. For v3 evidence, use local Node ≥22.12 with the checkout's pinned Web dependencies installed. The Windows portable Viewer omits the source CLI research dependencies.

```powershell
python -m gaiagis field-gis export --workspace output/local-workspace --field mkt_ia --format-version 3 --output output/exports/fieldlocal/mkt_ia-v3.gpkg --qgis-project
```

`--qgis-project` is optional and adds `mkt_ia-v3.qgz` beside the GeoPackage. Use unused output names under `output/exports/fieldlocal`. The GeoPackage is independently validated and published first. If project creation fails, the command reports the separate QGIS status and retains the complete GeoPackage.

| Format | Scope |
| --- | --- |
| Default / v1 | Original mesh, anchors, directed Access, network and source tables |
| v2 | v1 plus the Interaction geometry and related attributes, with the verified container version |
| v3 | All v2 spatial and attribute tables plus 18 evidence tables. Missing optional evidence is reported per channel |

`--start-triangle` and `--end-triangle` continue to select the optional directed Access snapshot. The CLI reads the existing Workspace for one Field. Previously exported packages keep their recorded formats and metadata.

## Identity and tables

The seven original spatial layers use Undefined Cartesian SRS `-1`, XYZ and no M. Triangle identity is `(field_id, triangle_id)`. Access retains its source Triangle and directed slot. LINE uses `(field_id, instruction_offset)`; a Trigger has an independent Section 8 slot. Use the `record_type` discriminator in `interaction_candidates`. A Numeric LINE and Trigger ID can coincide.

The 18 new tables have integer rowid keys plus unique natural source keys and foreign keys:

| Tables | Source identity and use |
| --- | --- |
| `evidence_sources`, `analysis_runs`, `analysis_status` | Workspace and asset fingerprints, archive/maplist/member and Section SHA, decoder, software, analysis revision, scope and status |
| `script_actors`, `script_entries`, `script_entry_aliases` | Actor ID, raw Entry root offset, and `(actor_id, kind, raw_slot, root_offset)`. Many aliases may map to a single root |
| `script_instructions`, `script_instruction_owners`, `script_conditions` | Raw Section 1 instruction offsets, opcode, width, verified or unresolved successors, original owner aliases where enumerated, and IF operand evidence |
| `script_events`, `gameplay_events`, `dialogue_references`, `event_interaction_candidates` | Eight analyzer target opcodes, original Gameplay records, Dialogue Text ID/status/operands, and distinct `same_actor` / `same_entry` relationships to LINE |
| `conditional_roots`, `conditional_controls` | Root status and rejection reason. Control key is `(root_offset, if_offset, successor, target_offset)`. Each relationship retains standard, strong and core flags |
| `ask_if_relations`, `request_edges`, `request_target_events` | ASK/IF raw bank, address, width and checked corridor. REQ source identity, target Entry and one-hop target events by original offsets |

Read `same_actor` as shared Actor context, and `same_entry` as the same exact original Actor/kind/slot/Entry ownership. Both are candidate links; only the LINE's own original geometry has exact 3D, XY-only or disjoint contact evidence. Gameplay, Dialogue and scripts are attributes without geometry. Dialogue omits the original text. Section 8 Triggers have no inferred Actor ownership.

Standard control is relative to an accepted raw Entry graph. Strong adds IF domination of the target. Core requires the same strong relation across all the target's owning roots. Distinct aliases never multiply the total number of raw roots. ASK `local` means bounded raw-address evidence with the allowed corridor checks. The REQ target keeps its own independent control evidence. See [Field conditional evidence](field-conditional-evidence.md) for exact semantics.

```sql
SELECT c.root_offset, c.successor, c.target_offset, e.kind, c.is_strong, c.is_core
FROM conditional_controls AS c
JOIN script_events AS e ON e.instruction_offset = c.target_offset
WHERE c.if_offset = :if_offset
ORDER BY c.root_offset, c.successor, c.target_offset;
```

## Open in QGIS

Open the QGZ with its GeoPackage in the same directory. Geometry, Interaction, Gameplay, Dialogue and Conditional Evidence have separate groups. In the attribute form, follow the configured parent/junction tables to original records. The **line contacts** layer filters to `record_type = 'line'`; **walkmesh triangles → contacts** retains both exact and XY-only rows with their flags. The GeoPackage can also be opened on its own in the QGIS Browser or queried using SQLite. Use the original keys instead of OGR FIDs for related records.

The project is set to Cartesian measurement and research browsing. FieldLocal coordinates remain in Raw Unit or Raw Unit². QGIS may display Meter for the undefined Cartesian SRS. Leave the CRS unresolved instead of assigning a geographic CRS. Keep different Fields in separate projects.

## Source validation, limits and missing data

The Python exporter invokes the fixed local Node entry from the current source checkout. That entry calls the production analyzer on the selected scene and checks the same reader contracts as the Viewer. Python checks the versioned response, claimed input fingerprints, cardinality, keys, SQLite integrity, and OGR readback. It rechecks observed files before publishing. The transport is bounded and ephemeral. The CLI accepts no external evidence snapshot.

Context and Walkmesh are required. Missing Node or too old a Node runtime leaves the Python geometry and verified Interaction available with an explicit `not_run` conditional status. Missing or rejected optional assets have their own row in `analysis_status`. Independently verified channels remain queryable. A missing claim is NULL with a reason. An available empty channel can have a valid zero row count. An unverified CFG successor retains its raw offset and has no enforced reference to a known instruction. Analysis limits produce no provisional strict rows.

The production analysis budgets apply. The exporter accepts up to 8,000,000 bytes of transport, 250,000 new rows and a 128 MB GeoPackage. The local child has a 90-second timeout. The exporter stages beside the destination and refuses existing outputs. Keep GeoPackages, QGZ files and private input assets out of shared source or release distributions.
