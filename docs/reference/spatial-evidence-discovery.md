# Spatial Evidence Discovery

Use the existing search box under **World** or **Game Guide**. The category selector narrows the same results. **Search tools** still finds GIS commands. A name can match several objects, including separate entrances, guide entries and Fields. Select an identity to inspect its source.

| Search | Identity |
| --- | --- |
| `location:<id>`, `entrance:<id>`, `atlas:<id>` | Place, original entrance or public guide entry |
| `face:0` | Original WM0 source face in the current mesh |
| `field:<id-or-name>` | Field Context entry |
| `item:0`, `materia:0`, `formation:0` | Original dictionary or Battle ID |
| `enemy:0/0`, `set:0:0` | Composite Scene/Enemy ID and Encounter region/slot |
| `field:<id> triangle:0`, `gateway:0`, `trigger:0` | Local original Triangle or Section 8 slot. Repeat the Field qualifier for each query. |
| `field:<id> line:<offset>`, `instruction:<offset>`, `event:<offset>`, `dialogue:<offset>` | Original Field records or a verified CFG instruction boundary. Repeat the Field qualifier for each query. |
| `field:<id> if:<offset>`, `ask:<offset>`, `req:<offset>`, `text:0` | Field-scoped branch, ASK, REQ or Dialogue reference. Repeat the Field qualifier for each query. |
| `field:<id> actor:0 slot:0 entry:<offset> kind:table` | One owner alias predicate. Use `entry:<offset>` on its own with Field scope to find the raw root and its aliases. |

Numbers are decimal. Zero is a legitimate identifier. The current source determines whether it exists. Enter accepts the active search option. Arrow keys move through the options and Escape dismisses or cancels a search. The Inspector and Field workspace provide a return to search.

## Source precision

The global directory uses current POI, Atlas, Field, Gameplay and Encounter sources. Item and Materia acquisitions require verified literal operands. Formation is the original Battle ID. Enemy identity is the pair of Scene ID and Enemy ID. Encounter references retain their original Set, kind, weight and byte offset. The map computes coverage only when requested.

Script and geometry retrieval is limited to one explicitly selected Field. A raw instruction boundary can be available without verified ownership. The geometry and contact candidates belong to the original LINE or Triangle. Same Actor, same Entry, REQ and Gameplay relationships remain non-spatial. An original IF record can be opened before running strict analysis. Explicitly expand the Field strict-evidence panel to use its existing analyser and proof budgets.

Route links use an existing valid encounter analysis for the selected leg, family and reference/candidate range. World–Field links require a completed current chain. Searching alone does not solve a route or build a coverage mask.

## Coverage and privacy

Public Guide search works without private assets. Missing or rejected Field channels are identified alongside usable results. The search stops at 500 candidates, displays at most 50 per page and asks for a narrower query when needed. A new query cancels the pending one. Source replacement retires old search results and actions.

Private navigation remains in the current session. Its selection and derived view are excluded from URL, Recent, Share and saved selection actions. The ordinary public place, Guide and bookmark navigation retain their normal behavior. The Atlas spoiler selector applies to the unified directory. Unclassified private Gameplay labels and related detail are visible under **Show all**. Original dialogue text is outside the search catalogue.
