# Locally generated locations and entrance provenance

This layer extends the stable V1 Geometric Gaia reconstruction. It does
not redefine latitude, geometry, projections, climate or world topology.
The [entrance investigation](field-entrance-research.md) preceded the parser.

## Generate and load

From the project root, after generating the existing V1 mesh:

```powershell
. .\scripts\use_workspace_environment.ps1
python -B scripts/build_poi_assets.py --source 'YOUR_FF7_INSTALLATION'
```

The output is `web/public/data/gaia-poi.json`, ignored by Git. The CLI also
accepts `--field-archive 'YOUR_ENGLISH_FLEVEL_LGP'` for extracted layouts
and `--output output/your-local-poi/gaia-poi.json`. Output paths must remain
inside the workspace; game inputs are opened read-only. The English
archive is resolved beside `data/wm` using explicit case-insensitive
discovery. Missing identity data is an error, not a guessed mapping.

Keep the existing `gaia-meta.json` and `gaia-mesh.bin` unchanged. In the
Viewer, open those two together, then use **Display → Load Locations**.
Without a POI file the map remains usable and says “Locations unavailable”.
Local development optionally loads an existing generated POI file.
The public source-only build never fetches generated datasets and files
selected in the browser are never uploaded.

## Schema version 1

Top-level fields: `schema = gaiagis-poi`, `version = 1`,
`reconstruction = v1-geometric-gaia`, `world_extent`, `mapping`, `sources`,
`locations`, `entrances`, `unresolved`, `extraction`. Source hashes bind
the four input payloads (WM0 file; EV, table and maplist archive entries).
No absolute installation path is needed in the transport.

| Record | Fields / meaning |
| --- | --- |
| Location identity | `id`, `name`, `display_name`, `category`, `aliases`, `field_names`, `name_source` |
| Location navigation | `primary_entrance`, `entrance_ids`, `longitude`, `latitude`, `height`, `navigation_kind = primary_entrance` |
| Derived center | `center` is an equal-record-weight spherical chord centroid, including scenarios; null when ambiguous. `source_kind = derived_navigation_center`. It is not a game trigger and is not the default fly target. |
| Entrance raw position | `game_x` (east), `game_north`, `game_height`: centroid of a chosen source trigger triangle in raw game units |
| Entrance V1 position | `longitude`, `latitude`, `height`: the existing `Mapping.game_to_geographic` applied to that raw point, using the default frozen V1 configuration |
| Triangle lineage | `world_map`, `section_id`, `mesh_id`, `triangle_id`, `trigger_triangle_ids`, `region_id` |
| Script lineage | `source_script` (EV function ID), `function_header`, `script_calls` with call-table record and instruction **word** offset relative to the EV code area |
| Destination identity | `entrance_table_id` (1-based), `scenario` (0/1), `field_id`, `field_name`, `field_table_record`, `field_table_byte_offset` |
| Field-local destination | `field_x`, `field_y`, `field_triangle`, `field_direction`: distinct from world position and heading |
| Source / quality | `source_kind = derived_from_entry_trigger`, `source_file = wm0.map`, `source_record`, `confidence = verified_trigger_derived_position`, `notes` |
| Height | `height_source = interpolated_from_surface`; raw height is a triangle interpolation, not a FIELD.TBL world height. V1 metres retain the existing assumed scale. |
| Unknowns | `heading`, `trigger_radius`, `availability` are null; no runtime state was simulated. |

The frontend validates schema, finite numeric ranges, identifiers,
scenario/table indexing, all entrance references and the frozen V1
mapping declaration. It compares WM0 hashes with loaded V1 metadata,
then verifies every trigger triangle against the actual loaded mesh's
lineage/script. Representative position bounds, interpolated height and
region must agree with that source triangle. Malformed optional data
does not destroy an already loaded mesh or valid locations layer.

## Source responsibilities

- **WM0 MAP:** base trigger triangles, raw vertex positions, height,
  source lineage and FF7 region. Shared geometric edges define separate
  trigger components; each component remains a separate entrance.
- **wm0.ev inside world_us.lgp:** mesh call identity, ENTER_FIELD constant
  arguments and conditional scenario branches. Duplicate script paths
  to the same component/table/scenario retain all call sites in one record.
- **field.tbl inside world_us.lgp:** destination field ID and field-local
  landing information. It supplies no world coordinate.
- **maplist inside flevel.lgp:** field ID → internal name. The installed
  archive includes an unused empty final slot; a reference to an empty
  slot is rejected.
- **Existing V1 Mapping:** all geographic coordinates. No new POI
  projection or inverse-Mercator implementation is introduced.
- **Editorial name map:** friendly English names, aliases, grouping and
  simple categories only. It cannot alter positioning or create entries.

## Editorial names and limitations

The coordinate-free `NAME_GROUPS` table in `src/gaiagis/poi.py` annotates
verified internal fields. For this dataset all 34 generated location
names use those explicit annotations; raw internal names and parsed
numeric field IDs remain available in every entrance.

Examples of grouping: `psdun_1` / `psdun_2` → Mythril Mine;
`nivl_3` → Nibelheim's distinct entrances; `snow` → Icicle Inn's
two approaches; `itown1a` / `itown1b` → Mideel's story variants.
Unknown internal names are retained verbatim as category `entrance`.
Categories are navigational annotations, not game-native taxonomy.

Identity/name cross-checks:
[FF7 field IDs](https://ff7-mods.github.io/ff7-flat-wiki/FF7/Field/Field_ID.html),
actual local maplist, and the documented entrance labels in
[Landscaper's worldscript constants](https://github.com/maciej-trebacz/ff7-landscaper/blob/master/src/ff7/worldscript/constants.ts).
The latter warns that its labels may contain errors, so it is not used
as an executable mapping or coordinate oracle. Internal field identity
comes from the actual game data. Friendly labels remain an explicit,
reviewable human annotation rather than a claim that the game stores
these English POI strings.

Gold Saucer and Northern Cave are unresolved in this static base-trigger
extractor. Model/system functions, dynamic stack arguments, runtime
vehicle/state guards and alternative-section substitutions require
separate research. No visually estimated locations enter this dataset.
Wutai story destinations and other scenarios are retained without a
claim that they are simultaneously accessible. Trigger representatives
are points inside source triangles, not buildings' surveyed centers.

## Viewer behavior

Locations render as DOM markers, with no additional Three.js draw calls.
All five modes call their existing projection functions; morphing
interpolates the corresponding endpoints alongside the surface.
Globe occlusion and Orthographic hemisphere visibility hide far-side
markers. Major settlement labels use screen collision/priority checks;
other names appear on hover, keyboard focus or selection. Selected
entrance navigation updates that location's marker to the chosen entry.

Search ranks exact name, prefix, substring, alias and internal field
matches; Unicode normalization and case folding are used. Arrows,
Enter and Escape act on the focused search input, not map rotation.
Fly-to uses a 900 ms spherical shortest arc on Globe, shortest wrapped
longitude on Orthographic and planar camera panning on the rectangular
map views. Reduced motion applies the endpoint immediately. A projected
rectangle has a fixed longitude cut; its planar pan is not a spherical
orbit. `#location=<id>` resolves after a POI dataset is loaded.

The triangle inspector remains available. The location inspector lists
all entrances and provenance without conflating field-local facing with
world heading. Screenshots and real-data QA outputs remain private.

## Distribution

`gaia-poi.json` contains game-derived coordinates. It is local-generated
data under the same separate distribution gate as `gaia-mesh.bin`.
The code-only release includes the schema reader, generator, name
annotations, documentation and synthetic tests, but no complete POI
coordinate dataset. GPL-3.0-only applies to original code; it does not
grant rights to FF7 or third-party material.
