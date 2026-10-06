# GaiaGIS v2.6 — Personal GIS / User Mapping

## Authority and baseline

- Repository, source and this STATUS are durable authority.
- Baseline verified by fetch/status/log on 2026-10-06.
- Local main and origin/main: eceeb41408657b274b372c3dda73afb06ab7ac62.
- Initial working tree clean; local main development only.
- v2.5 implementation and private-test distribution policy are preserved.
- Python tests and private QA remain local, ignored, untracked.
- No push, tag, Release, Pages or v2.7 authorization.
- All writes, caches, profiles, reports and exports stay inside the workspace.
- FF7 installation is strictly read-only data input.
- Climate remains sealed; execute no climate tests.

## Scope

- WM0 user-created Point, Polyline and simple Polygon.
- Create/select/vertex edit/move/delete/duplicate, names/notes/tags/styles.
- User layers with ordering/visibility/opacity and confirmed nonempty deletion.
- Existing Inspector, Search, Fly-to, local point Tours and Nearby.
- One versioned GaiaUserState storage record; migration and corruption recovery.
- Explicit GaiaJSON import/export, strict validation and bounded size/counts.
- Reference-sphere measurements; never WGS84/EPSG:4326.
- Batched dirty rendering shared by Globe, thirteen projections and Compare.
- Desktop, 390px, 320px and five locales.
- Local RC commit and clean tree; stop for human acceptance.

## Frozen owners

- Reconstruction, radius, source geometry/topology and projection formulas.
- WM2/WM3 native spaces; user drawing explicitly unavailable there.
- Source/Atlas locations, precision, provenance and encounter records.
- Routing weights/traversal, v2.5 spatial analysis and locomotion.
- Workspace generation/loading and private data boundaries.
- v2.4 shell/design tokens; extend its existing groups/Inspector.
- No new FF7-derived pack, telemetry, cloud sync or account.

## Coordinate decisions

- Geometry mapId wm0; coordinateSpace GaiaGame.
- game_east is periodic original X, in [0, 294912).
- game_north = 229376 - original Z, in [0, 229376].
- Origin is southwest of the existing raw source rectangle.
- Convert only at runtime with the existing frozen sourceGeographic mapping.
- Store one geometry independent of projection, camera, workspace and globe.
- Measure minor great-circle edges on R = 6,371,008.8 m.
- Polygon rings stored without repeated closing vertex; simple polygons only.
- Explicit handling of seam crossings, winding, coincidences and degeneracy.

## Architecture plan

- New pure user-mapping schema/validation/operations module.
- GaiaUserState version 2 extends existing local storage abstraction.
- v0/v1 migration preserves bookmarks/recent/tours/preferences.
- Separate version 1 GaiaJSON envelope; explicit import/export only.
- Add local user-feature identity to navigation, never ShareState.
- Point anchors carry user-created provenance, separate Nearby group.
- Batched render owner borrows projection/context; no object per segment.
- Dirty geometry/style updates; no storage rewrite on projection switch.
- Drawing input owns capture only while drawing/editing; restores controls.
- Pointer/touch and keyboard Finish/Cancel; shared Inspector forms.
- Native/Explorer entry cancels drawing; owner replacement disposes resources.

## Limits under implementation

- 32 layers, 500 features, 20,000 total vertices.
- 512 vertices per simple polygon; bounded lines and point lists.
- 4 MiB UTF-8 serialized user-state/import protection.
- Storage quota failures preserve validated in-memory state with visible warning.
- Invalid import is atomic and cannot alter existing user state.
- No screenshots, workspace packs or generic serialized AppState allowed.

## Phases

1. Baseline and owner audit: complete.
2. Schema/migration/measurement/CRUD core: complete.
3. Batched rendering and drawing/editing UX: complete.
4. Navigation/Inspector/layers/import/export integration: complete.
5. Web/private browser/regression/performance/safety validation: complete.
6. Docs/version/local RC: complete; RC identity is final local main HEAD.

## Tests and evidence

- Baseline Web 686 passed / 5 explicit optional skips.
- Baseline v2.5 private Browser 345/345; Python 304, no climate execution.
- Baseline source hash authority retained in ignored output/v2_5/safety-before.json.
- New private evidence goes only to ignored output/v2_6.
- New public Web tests use synthetic authored geometry only.
- Private Python tests must never be added to Git again.

## Open decisions / risks

- Globe/back-face and projection seam rendering must not bridge long screen lines.
- Simple polygon fill and spherical measurement domains must be explicit.
- User features require clear provenance and privacy-safe Tour identities.
- Drawing must not steal native/Explorer/route/measurement interaction.
- Local quota limit and actual hundreds-feature performance need measurement.

## Final checkpoint

- User state version 2, GaiaJSON version 1, one existing browser key.
- Drawing/My Layers/Inspector/navigation/projection/Globe/Compare complete.
- Point/Line/Polygon create/edit/move/delete/duplicate and explicit exchange pass.
- User Points only in local Nearby/Tours; public ShareState private leakage 0.
- Esc capture precedes shell dismissal; source/user overlap picking verified.
- Three shared objects per viewport, bounded seam-split tessellation, dirty buffers.
- Web 770 pass / 5 optional skips; Browser 525/525; Python 304, climate 0.
- Desktop/390px/320px, all thirteen views, native regressions and five locales pass.
- Five dictionaries: 859 keys each. Build/release build/release audit pass.
- 500 features / 8,100 vertices: compile median 8.8 ms; state/UI save 41.5 ms;
  state 632,096 bytes, buffers 651,600 bytes, stationary geometry rebuilds 0.
- Full 862-item historical audit retained; four differences explicitly reconciled
  against current baseline. Three predate this task; launcher version only is new.
- All 735 sealed evidence records and twelve FF7 input hashes unchanged.
- Frozen source/analysis/math/Explorer owners unchanged; public derived data NO,
  proprietary assets/private paths/uploads 0; private tests remain untracked.
- Version metadata 2.6.0; docs/User Guide updated. Local RC = YES.
- No remote mutation, tag, Release or Pages. origin/main remains the baseline.

## Final action

Commit the verified files to local main as Zaxaerith, record HEAD in the delivery
report and verify clean working tree. Preserve ignored evidence, including the
rejected raw audit and complete reconciled audit. Stop for human acceptance.

## Stop condition

All requested modules and checks pass; docs and 2.6.0 metadata complete;
read-only source hashes unchanged; local commit by Zaxaerith; clean tree.
Then stop without publication and await human acceptance.
