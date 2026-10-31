# Gameplay event geography and script provenance

v5.10 adds a session-only query over existing private assets. It changes no
Workspace, FieldLocal, Gameplay, Routing or Save schema. Public source-only
delivery contains no private event records or geometry.

## Field evidence

Open a Field Walkmesh, then **Gameplay event spatial evidence**. The existing
Field selector chooses the scene. Filter by numeric Actor ID, original table
Slot, Entry offset, instruction/record offset, asset, type or geometry status.
Empty filters mean all; zero remains a valid ID. Results and related records
are paged at 50. Triangle filtering returns only exact 3D contacts, not XY hits.

The adapter verifies current Context, asset digests, archive/maplist and scene
identity. Interaction Section 5 must equal the actual decoded Walkmesh hash;
Section 1/8 must agree with Script Evidence, and Gameplay Section 1 must agree
with the available scene evidence. Conflict rejects the corresponding channel.
Missing optional assets retain the remaining independent evidence.

Selecting a line uses the existing Canvas and Inspector. All contact triangles
are retained. **Same Actor** and **same exact Entry** are distinct candidate
relations; the Entry key includes Actor, raw Slot, table/main kind and offset.
Neither proves that the line triggers a grant or battle. Section 8 background
triggers have no Actor relationship. LINE definitions, SLINE updates and LINON
switches do not establish an execution order or current active state.

Choose a verified WM0 Entrance or incoming Gateway Arrival and check directed
reachability. The existing Gateway validator resolves that actual start in the
same Field (zero transfers); the existing WalkmeshNetwork supplies contact
Reach/Path/Access evidence. A shortest-hop witness, then lowest original
Triangle ID, is used without discarding other candidates. XY-only, disjoint,
variable endpoints and geometry-mismatched Access cannot prove a spatial path.
This is not collision, trigger execution, reward acquisition or game state.

Gameplay and guide cards can open their exact Field record through a
source-bound action. Formation and guide references use the original owners
and spoiler rules. Gameplay positions stay null; flagLinks stay empty. No new
reward markers, current-line state, messages, CMUSC, MAPJUMP or Flag analysis is
inferred. Existing parent-place precision remains unchanged.

## WM0 evidence

**GIS → World event geography** computes from the current WM0 Source and Events.
It separates original trigger faces, constant model placements and unresolved
observations. Region/Terrain filters operate on original IDs. Counts and raw²
are a union of source face identities: overlaps between event records count
once, distinct duplicate geometry faces remain distinct, and zero-area faces
remain in counts. Synthetic caps and display copies are excluded. This is not
event probability, physical ground area or a trigger footprint for a model.

Source face lists use the existing selection/highlight/Inspector. Spatial event
selection uses the original event owner. Unresolved rows never fly the map or
create markers; a Formation link is offered only when the exact current Events
digest and Worldscript provenance match Gameplay. The known EN source contains
100 trigger records / 1,271 source faces, 77 model placements and 156 unresolved
observations. Its 12 World Battles remain unlocated.

## Ownership and lifetime

Field decoding remains scene-lazy in the Field owner. The relation index retains
references and compact per-Actor/per-Triangle lookups; filter/pager changes do
not re-decode assets. Inspector close and Canvas pan do not clear evidence.
Changing scene, source, Workspace generation or leaving Field rejects pending
work. Shared Walkmesh networks and the Gateway solver are borrowed, not replaced.
WM0 statistics share the Source owner and do not install a competing mask or
alter terrain, Encounter, Service Area or Region Component layers.
