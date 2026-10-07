# Atlas schema v1

`src/gaiagis/atlas_data/content.json` is the public authored registry. Python `atlas.validate_content` and browser `parseAtlasContent` reject malformed shapes, duplicate IDs, invalid kinds/regions/spoilers, missing five-locale text, missing source references, unsafe URLs, broken/self relations, incompatible binding shapes, public coordinate fields and duplicate named coverage. The current data has 58 entities, 38 sources and 290 summaries.

An entity has `id`, `kind`, `canonicalName`, `localizedNames`, `aliases`, `summary`, `region`, `tags`, `spoilerLevel`, `spatialBinding`, `relatedLocations`, `relatedEntities`, `collectibles`, `secrets`, `sources`, `facts`, `notes`. Names/summaries and fact text require en, zh-CN, zh-TW, ja and ko. Names may retain canonical original-game names; UI labels and authored summaries are translated. `facts` have typed access/gameplay/reward/category/secret text, their own spoiler class and source references. Source records contain `id`, `provider`, `title`, HTTPS `url`, ISO `reviewed` date, `type` and `notes`; types are game_identity, reverse_engineering, wiki and reference. No article content is embedded.

Kinds: city, town, village, settlement, dungeon, landmark, materia_cave, world_map_site, chocobo_site, vehicle_site, secret_area, collectible_site, treasure_group. Regions: eastern, western, northern, wutai, islands, underwater, unknown. Tags support places, secrets, collectibles and descriptive lookup. Spoilers: none, minor, major. Modes: hide-major (default), show-all, hide-all. Hidden reward names are removed from parent search aliases as well as cards/markers; Sources reflect only visible facts.

Binding requests support location (`locationId`), parent_location (`locationId`), field_parent (`locationId`, `fieldNames`), non_spatial and unresolved. Direct entrance/transition/triangle bindings are deliberately not advertised without a researched entity requiring them. The initial pack uses established Location/Entrance lineage; related transitions provide context only. This is a bounded first Atlas schema, not a promise that unsupported binding variants resolve.

The ignored `gaia-atlas.json` pack has schema `gaiagis-atlas`, version 1, `curated_sha256`, `content`, POI `sources` and entity-keyed `bindings`. Bindings contain kind, precision, evidence, locationId, entranceId, fieldNames, relatedEntrances, relatedTransitions and marker. They contain no longitude, latitude, XYZ or source-triangle coordinate data. Seven precision vocabulary classes exist: exact_source, verified_anchor, entrance_level, parent_place, field_only, non_spatial, unresolved. The first two have zero records because current evidence supports neither claim.

Workspace generator marker is `atlas-1`. Manifest asset type atlas / map WM0 depends on gaia-poi.json; source signature includes wm0.map, world_us.lgp, flevel.lgp, curated-content hash and optional transition-pack hash. Output hash/size and per-generator version guard reuse. Content changes invalidate Atlas only; missing/corrupt/old-generator Atlas rebuilds independently. Optional failure omits Atlas from a new manifest while preserving other capabilities. Existing workspaces without an Atlas pack use bundled authored knowledge and verified currently loaded POI identities; source-only public pages retain offline knowledge/search with no spatial anchor.

## Atlas spatial binding and evidence

Position authority remains the validated POI pipeline. Atlas never geocodes prose, measures a Wiki map, chooses a nearest triangle, interpolates a missing point or translates native map positions into global coordinates.

For `location`, find the existing Location by ID, then its primary Entrance. Require matching parent identity, `derived_from_entry_trigger`, representative triangle membership in trigger triangles and recorded script calls. The largest source trigger triangle centroid remains the existing POI representative, unchanged. Label it entrance_level / existing_entrance, never an exact interior site. Atlas markers and route/measurement/Explorer actions reuse that Entrance. No new coordinate constants are serialized.

For `parent_location`, require the existing parent; emit parent_place / parent_only, no Entrance ID or marker. For `field_parent`, also verify every field name belongs to the parent; emit field_only / field_link, no Entrance ID or marker. Cards offer only Fly to parent place. The user's mental model is explicit: this action visits a known entrance of the parent, not the reward's position. There is no independent collectible dot.

Unknown identities remain unresolved. Non-spatial knowledge remains non_spatial. Missing POI allows knowledge/search but no context position. Browser pack validation rederives every binding from validated POI and requires matching source hashes. Related entrance/transition IDs are lineage/context references, not new navigation coordinates. Native map switch hides Atlas markers and clears incompatible selection/context through the established lifecycle.

Actual generated precision counts: exact_source 0; verified_anchor 0; entrance_level 34; parent_place 12; field_only 6; non_spatial 0; unresolved 6. 34/34 existing named Locations are covered; exclusions 0. The four cave rewards and Sage Enemy Skill/Temple Black Materia are field-only. Round Island and eleven reward groups are parent-place. All six unresolved records have marker=false and no location/entrance point. Collectibles layer marks only known parent places with visible discoveries, not chest positions.

Deterministic Atlas-only declutter suppresses overlapping anchors within 32 screen pixels in stable entity order. It is recalculated each frame as the camera/projection changes. Atlas markers morph through the existing 13-view pipeline and disappear in Explorer/native views. Declutter does not alter existing locations, events, geometry or projection mathematics.

Synthetic tests reject coordinates in public requests, unsourced facts, missing coverage, field mismatch, fake precision/markers, mismatched source hashes and changed entrance identities. Actual source tests verify the 34 entrance bindings. Screenshots and generated packs are private ignored artifacts.

## Gaia Atlas research (v2.2)

Reviewed 2026-10-06. Target: original Final Fantasy VII, including classic PC field identities. Remake/Rebirth sections were excluded. Repository/source data establish identity and position; external references establish authored knowledge, never coordinates.

## Method

Inventory the actual local POI dataset first: 34 named Locations with `manual_verified_field_identity`. Review targeted original-game pages for each group, then special world sites and geographically relevant rewards. Read individual references and cross-check the four Materia Caves and access restrictions. Search-index excerpts were used when Wiki direct access was unavailable; this is a bounded editorial review, not a full article snapshot. No crawling, article HTML, images or quoted prose is distributed. Source IDs identify provenance for each entity and fact; important access facts have their own references. Review date is recorded per source. There are 58 entities and no named-location exclusions.

Local source identities are the highest authority for spatial binding. Field ID documentation is supporting reverse-engineering evidence. Wiki/Jegged/StrategyWiki supply short authored gameplay descriptions. No official location publication with usable coordinate evidence was found; no source is labelled official. Summary translations are authored editorial translations, not claims to reproduce official localized nomenclature. Canonical original-game English names remain the five-locale name fallback; documented common aliases support multilingual lookup. Item/site names must remain identifiable across original and later naming variants.

## Scope and decisions

34 named places, Round Island parent context, four additional researched special places, and 19 collectible/reward records are included. Reward records can group related items; their count is not an inventory of every treasure chest. Access conditions are descriptive facts, not save-state availability. Major spoiler facts remain hidden by default. No collected-state, battle, field renderer or story progression is implemented.

| Issue | Evidence / decision |
| --- | --- |
| Corral / Corel Valley | Existing verified POI uses Corral Valley; external pages use Corel Valley. Preserve POI identity and add alias. |
| HP-MP / HP↔MP and Knights of Round / the Round | Normalize punctuation and retain original-game naming aliases. |
| Typoon / Typhon | Original English reward name Typoon retained; later naming is an alias, not a different reward. |
| Old man's house described as cave | Keep existing identity and anchor; editorial knowledge does not change POI classification. |
| Great Glacier return restriction | Jegged and original-game Wiki differ on returnability/leadership context. Omit a permanent-unavailability claim. |
| Materia cave access | Green for Mime, blue for Quadra Magic, black for HP↔MP, gold for Knights; higher compatible chocobos described explicitly. No unlock simulation. |
| Lucrecia reward timing | Rewards documented; exact battle threshold omitted rather than inferred. |
| Gold Saucer / Northern Cave | Knowledge included, WM0 authoritative anchor unresolved; no nearest Corel or crater point. |
| Ancient Forest | Optional access/puzzle/rewards supported externally. No verified existing POI or transition identity; unresolved. |
| Sunken Gelnika | WM2 knowledge retained. Never reinterpret native coordinates as WM0 geographic coordinates. |
| Round Island | Associated with existing cave entry as parent-place context; no invented island-centre coordinate. |

The six unresolved entities are Ancient Forest, Sunken Gelnika, Gold Saucer, Northern Cave, Ancient Forest rewards and Gelnika rewards. Unknown exact chest position, interior layout and unsupported availability detail remain unknown. Atlas makes no Steam 2026 executable-equivalence claim.

## Reviewed source registry

| ID | Reference | Type | Reviewed |
| --- | --- | --- | --- |
| field-identity | [GaiaGIS source evidence — GaiaGIS validated original-game field identities](https://github.com/Zaxaerith/ff7-GaiaGIS/blob/main/docs/reference/atlas.md) | game_identity | 2026-10-06 |
| field-reference | [FF7 flat wiki — FF7 Field ID reference](https://ff7-mods.github.io/ff7-flat-wiki/FF7/Field/Field_ID.html) | reverse_engineering | 2026-10-06 |
| wiki-caves | [Final Fantasy Wiki — Materia Cave](https://finalfantasy.fandom.com/wiki/Materia_Cave) | wiki | 2026-10-06 |
| caves | [Jegged — The Materia Caves](https://jegged.com/Games/Final-Fantasy-VII/Side-Quests/Materia-Caves.html) | reference | 2026-10-06 |
| wiki-forest | [Final Fantasy Wiki — Ancient Forest](https://finalfantasy.fandom.com/wiki/Ancient_Forest) | wiki | 2026-10-06 |
| forest-guide | [StrategyWiki — Ancient Forest guide](https://strategywiki.org/wiki/Final_Fantasy_VII/Ancient_Forest) | wiki | 2026-10-06 |
| lucrecia | [Jegged — Lucrecia’s Crystal Cave](https://jegged.com/Games/Final-Fantasy-VII/Side-Quests/Lucrecias-Crystal-Cave.html) | reference | 2026-10-06 |
| old-man | [Final Fantasy Wiki — Old man’s house](https://finalfantasy.fandom.com/wiki/Old_man%27s_house) | wiki | 2026-10-06 |
| weapon-seller | [Final Fantasy Wiki — Weapon seller](https://finalfantasy.fandom.com/wiki/Weapon_seller) | wiki | 2026-10-06 |
| wiki-glacier | [Final Fantasy Wiki — Great Glacier (Final Fantasy VII)](https://finalfantasy.fandom.com/wiki/Great_Glacier_(Final_Fantasy_VII)) | wiki | 2026-10-06 |
| midgar | [Jegged — Midgar](https://jegged.com/Games/Final-Fantasy-VII/Locations/Midgar.html) | reference | 2026-10-06 |
| kalm | [Jegged — Kalm](https://jegged.com/Games/Final-Fantasy-VII/Locations/Kalm.html) | reference | 2026-10-06 |
| chocobo-farm | [Jegged — Chocobo Farm](https://jegged.com/Games/Final-Fantasy-VII/Locations/Chocobo-Farm.html) | reference | 2026-10-06 |
| mythril-mine | [Jegged — Mythril Mine](https://jegged.com/Games/Final-Fantasy-VII/Locations/Mythril-Mine.html) | reference | 2026-10-06 |
| fort-condor | [Jegged — Fort Condor](https://jegged.com/Games/Final-Fantasy-VII/Locations/Fort-Condor.html) | reference | 2026-10-06 |
| junon | [Jegged — Junon](https://jegged.com/Games/Final-Fantasy-VII/Locations/Junon.html) | reference | 2026-10-06 |
| temple-of-the-ancients | [Jegged — Temple of the Ancients](https://jegged.com/Games/Final-Fantasy-VII/Locations/Temple-of-the-Ancients.html) | reference | 2026-10-06 |
| mideel | [Jegged — Mideel](https://jegged.com/Games/Final-Fantasy-VII/Locations/Mideel.html) | reference | 2026-10-06 |
| costa-del-sol | [Jegged — Costa del Sol](https://jegged.com/Games/Final-Fantasy-VII/Locations/Costa-del-Sol.html) | reference | 2026-10-06 |
| mt-corel | [Jegged — Mt. Corel](https://jegged.com/Games/Final-Fantasy-VII/Locations/Mount-Corel.html) | reference | 2026-10-06 |
| north-corel | [Jegged — North Corel](https://jegged.com/Games/Final-Fantasy-VII/Locations/North-Corel.html) | reference | 2026-10-06 |
| corel-desert | [Jegged — Corel Desert](https://jegged.com/Games/Final-Fantasy-VII/Locations/Corel-Prison.html) | reference | 2026-10-06 |
| gongaga | [Jegged — Gongaga](https://jegged.com/Games/Final-Fantasy-VII/Locations/Gongaga.html) | reference | 2026-10-06 |
| cosmo-canyon | [Jegged — Cosmo Canyon](https://jegged.com/Games/Final-Fantasy-VII/Locations/Cosmo-Canyon.html) | reference | 2026-10-06 |
| nibelheim | [Jegged — Nibelheim](https://jegged.com/Games/Final-Fantasy-VII/Locations/Nibelheim.html) | reference | 2026-10-06 |
| rocket-town | [Jegged — Rocket Town](https://jegged.com/Games/Final-Fantasy-VII/Locations/Rocket-Town.html) | reference | 2026-10-06 |
| wutai | [Jegged — Wutai](https://jegged.com/Games/Final-Fantasy-VII/Locations/Wutai.html) | reference | 2026-10-06 |
| bone-village | [Jegged — Bone Village](https://jegged.com/Games/Final-Fantasy-VII/Locations/Bone-Village.html) | reference | 2026-10-06 |
| icicle-inn | [Jegged — Icicle Inn](https://jegged.com/Games/Final-Fantasy-VII/Locations/Icicle-Inn.html) | reference | 2026-10-06 |
| chocobo-sages-house | [Jegged — Chocobo Sage's House](https://jegged.com/Games/Final-Fantasy-VII/Locations/Chocobo-Sages-House.html) | reference | 2026-10-06 |
| mt-nibel | [Jegged — Mt. Nibel](https://jegged.com/Games/Final-Fantasy-VII/Locations/Mount-Nibel.html) | reference | 2026-10-06 |
| great-glacier | [Jegged — Great Glacier](https://jegged.com/Games/Final-Fantasy-VII/Locations/Great-Glacier.html) | reference | 2026-10-06 |
| corral-valley | [Jegged — Corral Valley](https://jegged.com/Games/Final-Fantasy-VII/Locations/Corel-Valley.html) | reference | 2026-10-06 |
| forgotten-capital | [Jegged — Forgotten Capital](https://jegged.com/Games/Final-Fantasy-VII/Locations/Forgotten-Capital.html) | reference | 2026-10-06 |
| sunken-gelnika | [Jegged — Sunken Gelnika](https://jegged.com/Games/Final-Fantasy-VII/Locations/Sunken-Gelnika.html) | reference | 2026-10-06 |
| gold-saucer | [Jegged — Gold Saucer](https://jegged.com/Games/Final-Fantasy-VII/Locations/Gold-Saucer.html) | reference | 2026-10-06 |
| northern-cave | [Jegged — Northern Cave](https://jegged.com/Games/Final-Fantasy-VII/Locations/Northern-Cave.html) | reference | 2026-10-06 |
| round-island | [Jegged — Round Island](https://jegged.com/Games/Final-Fantasy-VII/Locations/Round-Island.html) | reference | 2026-10-06 |

## Curated entity inventory

The following is authored public knowledge and identity requests; it contains no generated geometry or POI coordinate table.

| ID | Name | Kind | Binding request | Sources |
| --- | --- | --- | --- | --- |
| midgar | Midgar | city | location | field-identity, midgar |
| kalm | Kalm | town | location | field-identity, kalm |
| chocobo-farm | Chocobo Farm | chocobo_site | location | field-identity, chocobo-farm |
| mythril-mine | Mythril Mine | dungeon | location | field-identity, mythril-mine |
| fort-condor | Fort Condor | world_map_site | location | field-identity, fort-condor |
| junon | Junon | city | location | field-identity, junon |
| temple-of-the-ancients | Temple of the Ancients | dungeon | location | field-identity, temple-of-the-ancients |
| old-mans-house | Old Man's House | settlement | location | field-identity, old-man |
| weapon-sellers-house | Weapon Seller's House | world_map_site | location | field-identity, weapon-seller |
| mideel | Mideel | town | location | field-identity, mideel |
| quadra-magic-cave | Quadra Magic Cave | materia_cave | location | field-identity, caves |
| costa-del-sol | Costa del Sol | town | location | field-identity, costa-del-sol |
| mt-corel | Mt. Corel | landmark | location | field-identity, mt-corel |
| north-corel | North Corel | town | location | field-identity, north-corel |
| corel-desert | Corel Desert | landmark | location | field-identity, corel-desert |
| gongaga | Gongaga | village | location | field-identity, gongaga |
| cosmo-canyon | Cosmo Canyon | settlement | location | field-identity, cosmo-canyon |
| nibelheim | Nibelheim | town | location | field-identity, nibelheim |
| rocket-town | Rocket Town | town | location | field-identity, rocket-town |
| lucrecias-cave | Lucrecia's Cave | dungeon | location | field-identity, lucrecia |
| hp-mp-cave | HP↔MP Cave | materia_cave | location | field-identity, caves |
| wutai | Wutai | town | location | field-identity, wutai |
| wutai-outskirts | Wutai Outskirts | world_map_site | location | field-identity, field-reference |
| mime-cave | Mime Cave | materia_cave | location | field-identity, caves |
| bone-village | Bone Village | village | location | field-identity, bone-village |
| corral-valley-cave | Corral Valley Cave | dungeon | location | field-identity, field-reference |
| icicle-inn | Icicle Inn | town | location | field-identity, icicle-inn |
| chocobo-sages-house | Chocobo Sage's House | chocobo_site | location | field-identity, chocobo-sages-house |
| round-island-cave | Round Island Cave | materia_cave | location | field-identity, caves |
| impaled-zolom | Impaled Zolom | landmark | location | field-identity, field-reference |
| mt-nibel | Mt. Nibel | landmark | location | field-identity, mt-nibel |
| great-glacier | Great Glacier | landmark | location | field-identity, great-glacier, wiki-glacier |
| corral-valley | Corral Valley | landmark | location | field-identity, corral-valley |
| forgotten-capital | Forgotten Capital | dungeon | location | field-identity, forgotten-capital |
| quadra-magic-cave-reward | Quadra Magic | collectible_site | field_parent | caves, wiki-caves |
| hp-mp-cave-reward | HP↔MP | collectible_site | field_parent | caves, wiki-caves |
| mime-cave-reward | Mime | collectible_site | field_parent | caves, wiki-caves |
| round-island-cave-reward | Knights of the Round | collectible_site | field_parent | caves, wiki-caves |
| kalm-treasure | Megalixir | treasure_group | parent_location | kalm |
| mine-materia | Long Range | treasure_group | parent_location | mythril-mine |
| junon-enemy-skill | Enemy Skill | treasure_group | parent_location | junon |
| bone-harp | Lunar Harp | treasure_group | parent_location | bone-village |
| bone-key | Key to Sector 5 | treasure_group | parent_location | bone-village |
| gongaga-titan | Titan | treasure_group | parent_location | gongaga |
| wutai-pagoda | Leviathan / All Creation | treasure_group | parent_location | wutai |
| glacier-materia | Alexander / Added Cut / All | treasure_group | parent_location | wiki-glacier |
| weapon-mythril | Great Gospel / Gold Armlet | treasure_group | parent_location | weapon-seller |
| old-man-mythril | Mythril / Bolt Ring | treasure_group | parent_location | old-man |
| lucrecia-rewards | Death Penalty / Chaos | treasure_group | parent_location | lucrecia |
| sage-enemy-skill | Enemy Skill | collectible_site | field_parent | chocobo-sages-house |
| temple-black-materia | Black Materia | collectible_site | field_parent | temple-of-the-ancients |
| ancient-forest | Ancient Forest | secret_area | unresolved | wiki-forest |
| sunken-gelnika | Sunken Gelnika | vehicle_site | unresolved | sunken-gelnika |
| gold-saucer | Gold Saucer | world_map_site | unresolved | gold-saucer |
| northern-cave | Northern Cave | dungeon | unresolved | northern-cave |
| forest-rewards | Slash-All / Typoon / Apocalypse | treasure_group | unresolved | forest-guide |
| gelnika-rewards | Double Cut / Hades / Highwind | treasure_group | unresolved | sunken-gelnika |
| round-island | Round Island | landmark | parent_location | round-island |


## Field Context

A private workspace can connect an existing world Entrance to its destination
Field and browse verified **gateway** connections. Field identity is
`flevel.lgp` fingerprint + maplist index + internal archive name. Display names
remain internal names unless a separate reviewed naming source exists. No Wiki
name table, messages, scripts, backgrounds, textures or models are exported here.

The optional logical asset `field-context` uses `gaia-field-context.json`, schema
`gaiagis-field-context`, version **1**, coordinate space **FieldLocalIdentity**.
Its compact contract contains:

- `archive`, source SHA-256 bindings, `scriptTransitions: unverified`;
- `nodes`: field `id`, internal `name`, available/missing/corrupt status, reviewed
  PC `saveId` or null;
- `edges`: `fromField`, destination `to`, gateway number and section-relative
  evidence `offset`;
- `exits`: world-entry pseudo-field identities, with the same evidence indices;
- `unresolved`: invalid sections or missing destinations, never a guessed edge;
- `bindings`: existing Entrance/Location IDs, destination Field ID and verified
  direct/unresolved status.

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
of a verified scene edge. Scripts are not scanned for MAPJUMP byte patterns or
interpreted. This is a partial connection graph, not complete field runtime or
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

Explore labels results **Field Scene**, indexing exact internal names and decimal /
hex IDs. Inspector shows incoming/outgoing gateways, archive evidence, parent
context and world-exit identities. Place/Atlas cards list their direct or mutually
associated scenes; field-only Atlas records select their existing exact field-name
requests. The SVG diagram supports pan, zoom, node selection, neighbor highlight
and parent filtering. Its deterministic grid is a topology layout, never a map.

Open parent place and Fly to verified world entrance borrow existing POI owners;
these actions require active WM0. A Field selection contains no geographic point,
never becomes a Nearby anchor and cannot enter public ShareState or user tours.
An Atlas `field_only` record stays `field_only`, with marker=false. Parent bindings,
unresolved Atlas records, WM2/WM3 and V1 reconstruction remain unchanged.

Public source-only mode explains the missing Field dataset and retains authored
Atlas knowledge. It never probes an installation or downloads a field graph.
Generated Field context remains ignored/local, with one optional manifest asset;
missing/invalid context does not invalidate the remaining workspace. Generator
and POI/source fingerprints govern rebuild/reuse. No runtime API can read arbitrary
files or expose flevel.lgp.
