# GaiaGIS v2.3 durable status — Navigation & Discovery

Updated 2026-10-06 (Asia/Hong_Kong).
Read this file after compaction before continuing work.

## Authority

- Git repository, current source and this file are durable authority.
- Prior chats are not the project state source.
- User request is the v2.3 Navigation & Discovery specification.
- Baseline: published GaiaGIS v2.2.0.
- Baseline SHA: f137814fccb96ae6c76e111a8a9e411a21d41ba2.
- Work branch: local main.
- Initial working tree: clean.
- Author: Zaxaerith.
- No push, tag, Release or Pages operations for this task.
- Stop once local v2.3.0 RC is committed and clean.
- Do not start v2.4.

## Product scope

- Central versioned GaiaUserState and safe storage migration/fallback.
- Identity Bookmarks and local camera View Bookmarks.
- Bounded, deduplicated Recently Viewed history and clear controls.
- Nearby / What's Here from existing verified spatial anchors only.
- Lightweight Guided Tours from existing identities/bookmarks.
- Route Playback over existing solved runtime corridor.
- Allowlisted safe Deep Links / Copy Link.
- Unified layer opacity/reset and legend presentation.
- Reference-sphere local horizontal screen scale.
- Existing six main panels; Explore houses discovery sections.
- Desktop, 390px and 320px mobile/touch workflows.
- Five locales, keyboard controls and reduced motion.

## Frozen boundaries

- V1 inverse Mercator, reference radius, topology and synthetic caps.
- Periodic E/W seam and N/S cut.
- All 13 projection formulas.
- Location/Entrance identities and coordinate authority.
- Encounters, traversal, events and routing solver/weights/profiles.
- Transitions and WM2/WM3 native coordinate semantics.
- Original textures, UV, relief and game-derived transport.
- Explorer movement, models, lighting, audio and presentation.
- Atlas content, provenance, binding precision and spoiler semantics.
- Local Auto Workspace generation and source pipeline.
- Steam 2026 runtime equivalence remains NOT VERIFIED.
- Climate remains sealed Experimental / Inconclusive.
- Execute no climate tests or reconstruction changes.

## Privacy boundary

- No account, cloud sync, telemetry or user state upload.
- User personal map state is separate from workspace/project schemas.
- Use one centralized browser-local user-state storage owner/key.
- Store no decoded workspace, screenshots or route arrays in storage.
- Local View Bookmarks may hold bounded camera state.
- Shared URLs contain public identities/UI strings only.
- Never serialize entire AppState into a URL.
- No private lat/lon, XYZ, triangle IDs, route nodes or hashes in URLs.
- No source paths, pack IDs or local bookmark coordinates in URLs.
- Exported tours, if implemented, contain identities/titles/timing only.
- Generated data, browser profiles and screenshots stay ignored.
- All output/cache/profile writes stay inside this workspace.
- FF7 installation remains read-only binary input.
- No Google assets/icons/CSS/branding are copied.

## Initial architecture decisions

- Resolve saved identities against current owners; do not copy knowledge.
- Navigation registry will expose stable lookup/metadata hooks.
- Central user storage handles validation, migration, quota and corruption.
- ShareState uses explicit fields and public-ID allowlists.
- Nearby is a small precomputed-vector linear scan with spherical distance.
- Parent-place/field-only/unresolved rewards never become distance results.
- Nearby and physical scale unavailable in native maps.
- Tours support WM0 resolved identities; unresolved cards may be informative.
- Tour camera reuses the existing Fly-to and restores overview state.
- Route progress uses a prebuilt runtime buffer/draw range.
- Follow mode uses the current camera; reduced motion disables large motion.
- Layer registry owns opacity capabilities/defaults/preferences.
- Base surface stays opaque; critical UI/selection remains readable.
- Scale uses screen-local inverse positions or reference-sphere ray hits.
- Do not treat any projection scale as globally constant.
- Optional minimap deferred unless demonstrably low cost.
- No new heavy dependency or reverse-engineering scope.

## Required documents

- navigation-state.md: schema/storage/bookmarks/recent/private boundary.
- nearby.md: authority, distance, exclusions, native policy, benchmark.
- tours.md: targets, lifecycle, camera, restoration and route playback.
- share-state.md: safe fields, validation and fallback.
- scale.md: local horizontal scale algorithms and limits.
- validation.md: all 65 requested final metrics/topics.
- README, user guide and architecture updates after implementation.

## Completed phases

- Read complete v2.3 request and confirmed local baseline/clean main.
- Read v2.2 STATUS/validation/schema/spatial-binding.
- Read README, user guide, methodology, architecture and local-workspace.
- Read v2.1 validation and v2.2 research decisions.
- Existing search/Inspector/shell interfaces inspected.
- Durable working status established before feature implementation.

## Final RC evidence

- Version: 2.3.0; local main, author Zaxaerith.
- All required Navigation & Discovery scope is implemented and documented.
- Python: 303 passed, 0 skipped/errors/failures; actual source enabled.
- Climate tests executed: 0.
- Web: 627 passed / 5 explicit optional skips; 24 files.
- New state/share/nearby/playback/scale/integration cases: 67 passed.
- Browser: 128 / 128 passed: 70 navigation + 48 Atlas + 10 fallback.
- Desktop workflows A–E, 390px/320px touch, public/local/offline, five locales pass.
- All 13 projections, WM2/WM3 and Explorer lifecycle regression pass.
- build:release and audit:release pass; game-derived public files = 0.
- User state empty 416 bytes; exercised session 3,924 bytes.
- Nearby: 42 eligible representatives; excludes 12 parent, 6 field, 6 unresolved.
- Typical Nearby query ~0.1 ms (timer resolution 0–0.2 ms).
- Five baseline/current runs: loaded-UI median 2,538.5 → 2,718.1 ms (+179.6 ms).
- Post-GC heap delta +401,069 bytes; discovery JS/CSS decoded 34,794 bytes.
- Actual Route Follow: 30 nodes, 172.5 FPS sample, result unchanged.
- Warm launcher 2.42 seconds, all private workspace components reused.
- Five locales have 735 unique UI keys each.
- 419 tracked files, code/docs/tests only in this change.
- Independent before/final: 862 protected files and 12 FF7 inputs unchanged.
- No copied Wiki prose, Wiki images or original game assets added.
- No public derived dataset, uploads, private URL leaks, new/artifact path leaks or FF7 modification.
- Path scan separately retains 27 historic baseline installation-root references; no frozen cleanup.
- Optional tour import/export, sample tour, category toggles and minimap deferred.
- Steam 2026 runtime equivalence remains NOT VERIFIED; climate sealed unchanged.
- Full 65-item report: validation.md. Private evidence: output/v2_3/.

## Environment

- Approved local PowerShell commands available.
- Use per-command Git safe.directory; do not change global configuration.
- Python/Node/Chrome and existing QGIS runtime are installed.
- Existing private workspace supplies current validated source data.
- Tool command sandbox setup failed in preceding work; approved commands work.

## Completion checkpoint

- This status and validation are included in the final local RC commit.
- Resolve its exact SHA with `git rev-parse HEAD`; recorded in the final handoff.
- Final local commit is followed by a clean-status check.
- No publication, remote metadata changes or next-version work is authorized.
- Stop at this local RC; wait for user acceptance.
