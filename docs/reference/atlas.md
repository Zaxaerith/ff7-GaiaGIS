# Atlas schema v1

`src/gaiagis/atlas_data/content.json` is the public authored registry. Python `atlas.validate_content` and browser `parseAtlasContent` reject malformed shapes, duplicate IDs, invalid kinds/regions/spoilers, missing five-locale text, missing source references, unsafe URLs, broken/self relations, incompatible binding shapes, public coordinate fields and duplicate named coverage. The current data has 58 entities and 290 translated summaries. The source registry and structured fact inventory live in the authored JSON, not a second documentation database.

An entity has `id`, `kind`, `canonicalName`, `localizedNames`, `aliases`, `summary`, `region`, `tags`, `spoilerLevel`, `spatialBinding`, `relatedLocations`, `relatedEntities`, `collectibles`, `secrets`, `sources`, `facts`, `notes`. Names/summaries and fact text require en, zh-CN, zh-TW, ja and ko. Localized place labels use established names where available. Uncertain Materia, weapon and item names retain their original label with translated context; these labels are not claimed to be official translations. Canonical names remain searchable aliases. UI labels, authored summaries and every structured fact are translated. `facts` have typed access/gameplay/reward/category/secret text, their own spoiler class and source references. Source records contain `id`, `provider`, `title`, HTTPS `url`, ISO `reviewed` date, `type` and `notes`; types are game_identity, reverse_engineering, wiki and reference. No article content is embedded.

Kinds: city, town, village, settlement, dungeon, landmark, materia_cave, world_map_site, chocobo_site, vehicle_site, secret_area, collectible_site, treasure_group. Regions: eastern, western, northern, wutai, islands, underwater, unknown. Tags support places, secrets, collectibles and descriptive lookup. Spoilers: none, minor, major. Modes: hide-major (default), show-all, hide-all. Hidden reward names are removed from parent search aliases as well as cards/markers; Fact search terms also obey the selected spoiler mode in all five locales. Sources cite visible facts and the entity bibliography, without exposing hidden fact text.

Binding requests support location (`locationId`), parent_location (`locationId`), field_parent (`locationId`, `fieldNames`), field_identity (`fieldNames`, requiring private Field Context), non_spatial and unresolved. Direct entrance/transition/triangle bindings are deliberately not advertised without a researched entity requiring them. The initial pack uses established Location/Entrance lineage; related transitions provide context only. This is a bounded first Atlas schema, not a promise that unsupported binding variants resolve.

The ignored `gaia-atlas.json` pack has schema `gaiagis-atlas`, version 1, `curated_sha256`, `content`, POI `sources` and entity-keyed `bindings`. Bindings contain kind, precision, evidence, locationId, entranceId, fieldNames, relatedEntrances, relatedTransitions and marker. They contain no longitude, latitude, XYZ or source-triangle coordinate data. Seven precision vocabulary classes exist: exact_source, verified_anchor, entrance_level, parent_place, field_only, non_spatial, unresolved. The first two have zero records because current evidence supports neither claim.

Workspace generator marker is `atlas-1`. Manifest asset type atlas / map WM0 depends on gaia-poi.json; source signature includes wm0.map, world_us.lgp, flevel.lgp, curated-content hash and optional transition-pack hash. Output hash/size and per-generator version guard reuse. Content changes invalidate Atlas only; missing/corrupt/old-generator Atlas rebuilds independently. Optional failure omits Atlas from a new manifest while preserving other capabilities. Existing workspaces without an Atlas pack use bundled authored knowledge and verified currently loaded POI identities; source-only public pages retain offline knowledge/search with no spatial anchor.

## Atlas spatial binding and evidence

Position authority remains the validated POI pipeline. Atlas never geocodes prose, measures a Wiki map, chooses a nearest triangle, interpolates a missing point or translates native map positions into global coordinates.

For `location`, find the existing Location by ID, then its primary Entrance. Require matching parent identity, `derived_from_entry_trigger`, representative triangle membership in trigger triangles and recorded script calls. The largest source trigger triangle centroid remains the existing POI representative, unchanged. Label it entrance_level / existing_entrance, never an exact interior site. Atlas markers and route/measurement/Explorer actions reuse that Entrance. No new coordinate constants are serialized.

For `parent_location`, require the existing parent; emit parent_place / parent_only, no Entrance ID or marker. For `field_parent`, also verify every field name belongs to the parent; emit field_only / field_link, no Entrance ID or marker. Cards offer only Fly to parent place. The user's mental model is explicit: this action visits a known entrance of the parent, not the reward's position. There is no independent collectible dot.

Unknown identities remain unresolved. Non-spatial knowledge remains non_spatial. Missing POI allows knowledge/search but no context position. Browser pack validation rederives every binding from validated POI and requires matching source hashes. Related entrance/transition IDs are lineage/context references, not new navigation coordinates. Native map switch hides Atlas markers and clears incompatible selection/context through the established lifecycle.

Base Atlas pack precision counts (before optional Field Context resolution): exact_source 0; verified_anchor 0; entrance_level 34; parent_place 12; field_only 6; non_spatial 0; unresolved 6. 34/34 existing named Locations are covered; exclusions 0. The four cave rewards and Sage Enemy Skill/Temple Black Materia are field-only. Round Island and eleven reward groups are parent-place. All six unresolved records have marker=false and no location/entrance point. Collectibles layer marks only known parent places with visible discoveries, not chest positions.

Deterministic Atlas-only declutter suppresses overlapping anchors within 32 screen pixels in stable entity order. It is recalculated each frame as the camera/projection changes. Atlas markers morph through the existing 13-view pipeline and disappear in Explorer/native views. Declutter does not alter existing locations, events, geometry or projection mathematics.

Synthetic tests reject coordinates in public requests, unsourced facts, missing coverage, field mismatch, fake precision/markers, mismatched source hashes and changed entrance identities. Actual source tests verify the 34 entrance bindings. Screenshots and generated packs are private ignored artifacts.

## Gaia Atlas research

Reviewed 2026-10-08. Target: original Final Fantasy VII, including classic PC field identities. Remake/Rebirth sections were excluded. Repository/source data establish identity and position; external references establish authored knowledge, never coordinates.

## Method

Inventory the actual local POI dataset first: 34 named Locations with `manual_verified_field_identity`. Review targeted original-game pages for each group, then special world sites and geographically relevant rewards. Read individual references and cross-check the four Materia Caves and access restrictions. Search-index excerpts were used when Wiki direct access was unavailable; this is a bounded editorial review, not a full article snapshot. No crawling, article HTML, images or quoted prose is distributed. Source IDs identify provenance for each entity and fact; important access facts have their own references. Review date is recorded per source. There are 58 entities and no named-location exclusions.

Local source identities are the highest authority for spatial binding. Field ID documentation is supporting reverse-engineering evidence. Wiki/Jegged/StrategyWiki supply short authored gameplay descriptions. No official location publication with usable coordinate evidence was found; no source is labelled official. Summary translations are authored editorial translations, not claims to reproduce official localized nomenclature. Canonical original-game names remain aliases; uncertain proper names retain their original label with translated context. Documented common aliases support multilingual lookup. Item/site names must remain identifiable across original and later naming variants.

## Scope and decisions

34 named places, Round Island parent context, four additional researched special places, and 19 collectible/reward records are included. Reward records can group related items; their count is not an inventory of every treasure chest. Access conditions are descriptive facts, not save-state availability. Major spoiler facts remain hidden by default. No collected-state, battle, field renderer or story progression is implemented.

| Issue | Evidence / decision |
| --- | --- |
| Corral / Corel Valley | Existing verified POI uses Corral Valley; external pages use Corel Valley. Preserve POI identity and add alias. |
| HP-MP / HP↔MP and Knights of Round / the Round | Normalize punctuation and retain original-game naming aliases. |
| Typoon / Typhon | Original English reward name Typoon retained; later naming is an alias, not a different reward. |
| Old man's house described as cave | Keep existing identity and anchor; editorial knowledge does not change POI classification. |
| Great Glacier return restriction | Jegged overview, walkthrough and Materia pages differ on later return access. Omit a permanent-unavailability claim. |
| Materia cave access | Green for Mime, blue for Quadra Magic, black for HP↔MP, gold for Knights; higher compatible chocobos described explicitly. No unlock simulation. |
| Lucrecia reward timing | Rewards documented; exact battle threshold omitted rather than inferred. |
| Gold Saucer / Northern Cave | Knowledge included, WM0 authoritative anchor unresolved; no nearest Corel or crater point. |
| Ancient Forest | Optional access/puzzle/rewards supported externally. WM0 entry 55 targets anfrst_3; a scene-only binding is available, but no validated WM0 Entrance anchor. |
| Sunken Gelnika | WM2 knowledge retained. Never reinterpret native coordinates as WM0 geographic coordinates. |
| Round Island | Associated with existing cave entry as parent-place context; no invented island-centre coordinate. |

The six base-unresolved entities are Ancient Forest, Sunken Gelnika, Gold Saucer, Northern Cave, Ancient Forest rewards and Gelnika rewards. With the reviewed private Field Context they become field_only; their global anchors remain unresolved. Unknown exact chest position, interior layout and unsupported availability detail remain unknown. Atlas makes no Steam 2026 executable-equivalence claim.

## Content curation and Inspector

The single registry in `src/gaiagis/atlas_data/content.json` records bibliographic
URLs, review dates and per-fact references. Gameplay knowledge covers access,
local activities, selected bosses/enemies, Materia, equipment and optional
rewards. It is a curated guide to these entities, not a full treasure database.
Empty `notes`, boss/shop fields or child lists are not filled merely for coverage.
Wutai Outskirts and Corral Valley Cave currently have source identity context
but insufficient independently checked gameplay detail; their empty sections
stay absent. A world/Field identity alone does not justify adding a gameplay fact.

Overview and applicable access, gameplay, discoveries and related-place sections
lead the Inspector. Each displayed fact has its own explicit source link. When a fact also supplies the overview, it is cited there and not repeated in another section. Sections without
visible facts or child entities are omitted, including those emptied by spoiler
filters. Technical/Spatial Evidence, Field context and source fingerprints are
collapsed initially; the source bibliography is also collapsed. Source links
open only on user action. They never fetch Wiki content during startup or search.

The bundled current authored registry supplies knowledge in both public and
local modes. A validated older workspace pack still supplies its source-bound
spatial metadata when its entity request matches. It cannot replace current
translations/facts with an older copy; changed requests use the existing
conservative POI resolver and optional Field Context. Re-running the local
launcher incrementally refreshes the Atlas pack without rebuilding other assets.

### Source availability and disagreements

The removed POI research path is linked to its frozen published commit rather
than current main. Six former Fandom/StrategyWiki links returned HTTP 403 during
review; accessible targeted original-game guide pages replace them, while source
IDs remain compatible. An HTTP response proves availability, not factual
authority; every gameplay claim still requires a relevant page. No article HTML,
images, translated passages or scraped name list is stored.

Ancient Forest's brief location overview omits the mountain-chocobo alternative
that its detailed guide includes. The access fact cites the detailed guide and
does not impose an Ultimate-Weapon-only requirement. Great Glacier's location
overview says it cannot be revisited, whereas its walkthrough and Materia pages
describe return or later recovery. The Atlas marks this disagreement and does
not assert a blanket missability rule. Weapon-seller guides disagree about
repeatability; only the agreed Mythril exchange and box contents are recorded.
Mime descriptions here cover preceding party actions without adopting an
unverified blanket Limit restriction. Story-specific conditions and outcomes
are separately spoiler classified; major revelations are absent from default
cards, search terms and section titles.

These content additions do not change spatial requests, precision, coordinate
constants, markers or the six archaeology conclusions. Forest/Gelnika rewards
remain authored group knowledge with local Field context, never chest positions
or new global coordinates.

## Field Context

A private workspace can connect an existing world Entrance to its destination
Field and browse verified **gateway** and bounded **MAPJUMP** connections. Field identity is
`flevel.lgp` fingerprint + maplist index + internal archive name. Display names
remain internal names unless a separate reviewed naming source exists. No Wiki
name table, messages, scripts, backgrounds, textures or models are exported here.

The optional logical asset `field-context` uses `gaia-field-context.json`, schema
`gaiagis-field-context`, version **2** (the reader also accepts version 1), coordinate space **FieldLocalIdentity**.
Its compact contract contains:

- `archive`, source SHA-256 bindings, `scriptTransitions: bounded_mapjump`;
- `nodes`: field `id`, internal `name`, available/missing/corrupt status, reviewed
  PC `saveId` or null, plus a bounded script-header `scriptName`;
- `edges`: `fromField`, destination `to`, gateway number and section-relative
  evidence `offset`;
- `exits`: world-entry pseudo-field identities, with the same evidence indices;
- `unresolved`: invalid sections or missing destinations, never a guessed edge;
- `bindings`: existing Entrance/Location IDs, destination Field ID and verified
  direct/unresolved status;
- `scriptEdges` / `scriptExits`: verified MAPJUMP destinations and section-1
  offsets, without spawn coordinates or script bytes;
- `scriptUnresolved`: unsupported/invalid boundaries or unavailable destinations;
- `nativeRelations`: world EV function/offset, entry/scenario and destination
  Field identity, without native or global positions.

Incoming connections are derived from the directed edges. World-entry names such
as `wm2` in maplist are **entry identities**, not a WM2-native coordinate transform.
The payload contains no Field positions and no duplicated world entrance positions.
Unknown extra properties, invented coordinate spaces, invalid/dangling verified
edges, conflicting evidence indices and mismatched POI identities are rejected.
Source basenames and fingerprints contain no private filesystem paths.

### Evidence and bounds

The independent GaiaGIS reader cross-checks [Makou Reactor FieldPC / InfFile /
MapList](https://github.com/myst6re/makoureactor/tree/2452025714c033d698d1754a776bdcd5713427bd/src/core/field)
and the original [Qhimm field-format investigation](https://forums.qhimm.com/index.php?topic=3247.0).
PC files are bounded LZSS data with nine section offsets. Section 8 is 740 bytes
(or the documented 536-byte variant); its twelve 24-byte gateway records begin at
byte 56. Destination ID is the little-endian word at record +18. The inactive
sentinel is 0x7FFF. Only a successfully decoded archive scene can be the endpoint
of a verified scene edge. Scripts are decoded only along bounded entry-rooted control flow, never scanned
for MAPJUMP byte patterns or executed. This is a partial connection graph, not complete field runtime or
story/save availability.

Direct binding requires the exact field ID/name, an available archive scene and
existing verified WM0 entrance script evidence. [FIELD.TBL](https://ff7-mods.github.io/ff7-flat-wiki/FF7/WorldMap_Module/FIELD.TBL.html)
connects world script entry/scenario to maplist ID; its local spawn coordinates
are not global coordinates. The browser independently compares every binding to
currently loaded, validated POI, including source hashes.

`verified_parent` denotes a **unique mutual gateway association** to a directly
bound place, computed through strongly connected components. The UI explicitly
states that this does not establish geographic containment. One-way reachability
alone is insufficient. Multiple candidate places are ambiguous; absence of a
verified direct/mutual association is unresolved. Direct entrance evidence remains
direct even if its component has other roots. Cycles do not cause repeated traversal.

### Browsing and spatial policy

Explore labels results **Field Scene**, indexing exact internal names, reviewed Gelnika header aliases and decimal /
hex IDs. Inspector shows incoming/outgoing gateways, archive evidence, parent
context and world-exit identities. Place/Atlas cards list their direct or mutually
associated scenes; field-only Atlas records select their existing exact field-name
requests. The SVG diagram supports pan, zoom, node selection, neighbor highlight
and parent filtering. An Atlas Field scene set can open a scoped graph of those
scenes and verified one-hop neighbors; that scope is connectivity, not geographic
containment. Its deterministic grid is a topology layout, never a map.

Open parent place and Fly to verified world entrance borrow existing POI owners;
these actions require active WM0. A Field selection contains no geographic point,
never becomes a Nearby anchor and cannot enter public ShareState or user tours.
An Atlas `field_only` record stays `field_only`, with marker=false. Parent bindings,
WM2/WM3 and V1 reconstruction remain unchanged. Authored independent Field
identity requests can resolve only to field_only after local source validation.

Public source-only mode explains the missing Field dataset and retains authored
Atlas knowledge. It never probes an installation or downloads a field graph.
Generated Field context remains ignored/local, with one optional manifest asset;
missing/invalid context does not invalidate the remaining workspace. Generator
and POI/source fingerprints govern rebuild/reuse. No runtime API can read arbitrary
files or expose flevel.lgp.


### Targeted script archaeology and precision

The independent section-1 reader cross-checks the pinned [Makou Reactor opcode
metadata](https://github.com/myst6re/makoureactor/blob/2452025714c033d698d1754a776bdcd5713427bd/src/core/field/Opcode.cpp),
[MAPJUMP structure](https://github.com/myst6re/makoureactor/blob/2452025714c033d698d1754a776bdcd5713427bd/src/core/field/Opcode.h)
and [ff7tools script-format implementation](https://github.com/cebix/ff7tools/blob/6bf1fbcec2c88c1856cffd4a371719b406fee654/ff7/field.py).
Format facts guide original bounded decoding; no external parser is executed.

The header must identify 0x0502; actor names, sound offsets and 32 script-entry
words per actor precede code bounded by the string-table offset. The first RET
of actor initialization defines the documented default/main entry. Fixed widths,
bounded SPECIAL variants and KAWAI length establish instruction ownership.
Unknown widths stop an interval. A declared entry may restart decoding; a branch
cannot invent a boundary in an unknown interval. Operand overlap, out-of-bounds
entry/branch or truncated instructions invalidate that scene's script evidence.

Only MAPJUMP 0x60 is emitted: its ten-byte instruction contains a constant
little-endian destination maplist ID. Its Field-local spawn coordinates are not
read into output. Forward/back jumps and conditional branches determine possible
static reachability; RET/RETTO/GMOVR stop flow. Both conditional outcomes are
retained, without evaluating story/save state. CMUSC 0xFD has differing six/eight
byte widths in independent references, so remains unsupported. Prepared-map
jumps, minigame transitions and other semantics remain unverified.

Script connections are available in Inspector and the graph, but **do not enter
the gateway-only parent-association calculation**. Cutscene/teleport cycles are
not proof of geographic containment. Missing scenes and unsupported semantics
remain unresolved. The original gateway records and validated Entrance owners
are unchanged.

An authored `field_identity` request lists reviewed exact internal names without
a Location or coordinates. Its base Atlas binding remains unresolved until the
reviewed local maplist and available Field scenes match. The resulting view is
field_only, marker=false, no Entrance/Location anchor. Clearing/replacing the
Field payload restores unresolved. This contextual result does not persist new
coordinates or modify the Atlas pack. Public source-only retains authored cards
and explanatory requests, without asserting a generated source match.

Ancient Forest uses anfrst_1–5 and WM0 entry 55 → anfrst_3. Sunken Gelnika uses
qa–qd: actual script headers identify q_1–q_4, gateway connectivity joins them,
and WM2 ENTER_FIELD entry 31 → FIELD.TBL record 60 → qa establishes native
context. Gold Saucer's ropest ↔ gldst MAPJUMPs and gldst ↔ gldgate gateways
establish scene connectivity. Northern Cave's WM0 entry 59 targets las0_1
(Highwind deck), whose MAPJUMPs reach las0_2; that scene reaches las0_3. None
establishes a new validated WM0 Entrance anchor. Reviewed external names are
semantic annotations, never coordinate sources or automatic name matching.

Forest/Gelnika reward records refer to their reviewed **scene sets** and authored
parent Atlas entities. Individual reward-to-room assignments, chest positions,
Field-local XYZ and global reward positions remain unverified. No item-location
claim is inferred from a group label.

For Save→Field, the reviewed maplist plus exact qa/qb/qc/qd and q_1/q_2/q_3/q_4
header pairs resolve the four previously conflicting IDs. A mismatched header,
unreviewed maplist or absent scene cannot claim this compatibility. Other
conflicting IDs remain unverified; this is not modern executable equivalence.

### Spatial Evidence contract

Shared Atlas/Field Inspector presentation derives compact evidence steps with
`sourceType`, `sourceIdentity`, existing `precision`, `relation` (known/inferred/
unresolved), and optional `reason`. Actual maplist/header, directed gateway or
MAPJUMP and world EV/FIELD.TBL records are known source evidence. Reviewed Atlas
identity/group annotations and mutual topological associations are explicitly
inferred relationships. Missing global anchors and unsupported semantics are
shown as unresolved. Conditional static edges never assert current access.

World-entry provenance may trace a directed scene path from an existing native
arrival; this remains topology, without deriving a Field global point. A borrowed
world Entrance retains its existing POI script/table identity and Location. Source
fingerprints are carried once in the private payload, not repeated as raw data
or private paths. No chain adds coordinates to an Atlas or Field selection.

The existing Atlas filters include Resolved anchor, Field-only, Parent-place and
Unresolved. Resolved means the binding has a validated anchor; identity-only
records are not grouped with those anchors. The same authored content remains
searchable offline. No save bytes, scripts/messages dump, complete graph or
coordinate tables are shipped in the public Web artifact.

### Field-local Walkmesh

The existing Field Inspector offers **View Walkmesh** for a locally generated
scene. The Canvas is a raw XY plan (+X right, +Y up), not the game's camera or a
world-map inset. Original triangle IDs, vertex order, signed XYZ and the fourth
int16 component are retained. Z colouring is optional and shows the raw third
component; it is not metres, a sea-level datum or an assertion of global height.
The documented fourth component is alignment padding (equal to v0.z in the
examined installation), never a collision flag. Its values are not rewritten.

Section 5 starts with a uint32 count, followed by 24 bytes of vertices and 6
bytes of directed access per triangle. Edge slots are **v0→v1, v1→v2, v2→v0**,
unlike the opposite-corner convention of the existing world surface. A target
of 0xffff is blocked. Non-reciprocal links, self-links, endpoint mismatches and
3D/XY degeneracy are counted and preserved, not repaired. Invalid lengths,
counts or target indices make the scene mesh unavailable without removing
its valid identity/script/gateway context. Static access is not current
story-dependent reachability.

Selection highlights outgoing neighbors and exposes raw vertices, edge targets
and anomaly labels. Drag pans; wheel/buttons zoom; Home resets; arrow keys and
the triangle-ID input allow selection of overlapping triangles. Returning to
scene connections preserves the selected identity. No Field locomotion,
physics, pathfinding, global conversion or entry-point markers are provided.
Gateway local alignment remains unverified here; Section 8 and MAPJUMP continue
to be separate topology evidence.

Format references: [Qhimm Section 5](https://qhimm.ifcaro.net/qhimm/index.php/FF7/Field/Walkmesh/),
[PC Field layout](https://ff7-mods.github.io/ff7-flat-wiki/FF7/Field.html), and
[Makou Reactor's pinned mesh presentation](https://github.com/myst6re/makoureactor/blob/2452025714c033d698d1754a776bdcd5713427bd/src/3d/WalkmeshWidget.cpp).
The two wiki descriptions share historical material; the editor and actual
local records provide the additional cross-check, not an independent second
wiki claim. Reference descriptions do not establish equivalence to a live
modern executable.
