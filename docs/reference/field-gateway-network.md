# Field Gateway Network (v5.9)

Open an existing Field Workspace, then expand **Cross-scene static reachability**.
The tool uses current Field Context v3+ and Walkmesh v1; no new Workspace asset,
Manifest, UserState or data format is required. Source-only viewers explain the
missing resources rather than inventing a route.

## Starts, target and continuity

Select a stable identity, not a name-derived coordinate:

- A verified WM0 POI Entrance, cross-checked against FIELD.TBL, World Script,
  maplist, Field identity and the specified local Triangle/XY.
- An incoming Gateway Arrival in the current Field. The source segment and
  destination point are independently checked before it becomes a start.
  A selected arrival remains in the choices while viewing later legs.

Choose the target Field ID/internal name and a limit of 1, 2 or 3 transfers.
Success means arrival in that Field at the last recorded Triangle/XY; it is not
a path to every point in the scene. A start already in the target has zero legs.

Every search state retains Field ID, actual Triangle ID, local XY/computed Z,
depth, source identity and predecessor. Gateway candidates use exact 3D contact
with the raw mesh. The existing `WalkmeshNetwork.reach/path/gateway/evidence`
methods supply directed Access and original offsets. All contact candidates are
retained; a witness is chosen by fewest Access hops, then lowest Triangle ID.
Gateway records are considered in slot order; BFS supplies a bounded chain with
fewest transfers, not a jointly shortest physical path.

After crossing, the next state's sole start is the Gateway's target Triangle.
It is never replaced by a scene representative, Triangle 0 or another Entrance.
Triangle 0 is otherwise a valid original ID. Repeated Field/Triangle states are
not expanded again; the earlier shallower state dominates the transfer budget,
while the chosen predecessor and arrival evidence stay intact. XY-only,
disjoint, invalid targets and Access paths with mismatched geometric edges are
rejected. Unknown/missing assets and source mismatches remain explicit.

**Limit reached** means the target was not reached within the selected bound
and some branches were truncated; it does not prove longer chains impossible.
Diagnostics show rejected candidates and their source start, Gateway and reason.
Counts include all inspected rejections; only the first 20 detail rows are shown.

## Display and lifecycle

Select a result leg to view its source Field on the existing Walkmesh Canvas.
It shows the actual local start/end, path and source Gateway anchor. The operation
fold collapses to give the map space; reopen it to select another leg without
solving again. Original Access slots/Section-5 offsets and Gateway/Section-8
offset, target XY/Triangle, all candidates and source hashes are in the shared
Inspector. The existing Field back history restores local path context.

The existing Field Graph highlights result Gateway edges that are in the current
graph scope. Its MAPJUMP edges remain separate, dashed identity evidence. The
scene graph's SCC or `FieldIndex.connected()` is not spatial reachability.

Only touched scenes/networks and validated Gateway records are cached for this
session. Context/Walkmesh object, file SHA, archive/maplist and Workspace
generation bind the query. Async decode/query tickets reject stale results.
Replacing resources, changing map or returning to World clears this query and
its cache. Closing Inspector, Canvas pan/zoom, changing scene view, viewing a leg
or going back does not rerun the query. No result enters bookmarks, URLs or saves.

## Evidence limits

This is Gateway-only static geometry and directed Access, not original-game
runtime access. It does not evaluate story/flags, triggers, character collision
radius, model abilities or travel time. Z is interpolated from current Walkmesh,
not the actor's saved height. No coordinate transform to WM0 is introduced.

MAPJUMP has a verified destination identity but current Context lacks spatial
source/spawn evidence. World `wm*` placeholder names and dummy target coordinates
are not GIS WM0/WM2/WM3 nodes. Native ENTER_FIELD records do not create reverse or
cross-mode traffic edges. All remain browsable through the existing evidence UI,
and none is used to bridge a failed Gateway chain. WM0 Routing/Journey and Atlas
precision are unchanged.
