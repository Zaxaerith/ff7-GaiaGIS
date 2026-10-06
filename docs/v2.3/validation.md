# GaiaGIS v2.3.0 local RC validation

Baseline: published v2.2.0, `f137814fccb96ae6c76e111a8a9e411a21d41ba2`.
Validation date: 2026-10-06. Local main only, author Zaxaerith. No publication.
This document is included in the final local RC commit; its exact SHA is Git HEAD
and is recorded in the final handoff. Climate tests executed: **0**.

Independent before/after evidence covers **862 protected files and 12 inspected
FF7 inputs**. Frozen source, reconstruction, projection, routing, Explorer and Atlas
content/provenance/binding modules remain unchanged. Reports, source paths, browser
profiles and private screenshots are ignored under `output/v2_3/`.

| # | Required report item | Result |
|---|---|---|
| 1 | User-state schema/version | `gaiagis-user-state`, version 1 |
| 2 | Migration | Version 0 favorites become identity bookmarks; invalid/unknown versions recover to empty session state |
| 3 | Persistence | One browser-origin localStorage key: `gaiagis.user-state`; quota/unavailable storage retains in-memory edits |
| 4 | Typical stored bytes | Empty state 416 bytes; exercised multi-bookmark/view/tour session 3,924 bytes |
| 5 | Clear/reset | All or Bookmarks/Recent/Tours/Navigation preferences; second in-app confirmation, Cancel first |
| 6 | Bookmark target kinds | Location, Atlas, Entrance, Transition, plus Local View |
| 7 | View bookmarks | Bounded local camera, map/projection/native view, registered layer preferences, optional identity selection |
| 8 | Rename/delete | Name/note editing; deletion removes bookmark history references |
| 9 | Bookmark persistence | Real reload/deep-link browser check passed |
| 10 | Private coordinates | Local camera only; no identity coordinate/summary copy and no camera in URLs |
| 11 | Recent entity kinds | Four identity kinds and bookmark opens; incidental triangles excluded |
| 12 | History size | 30 maximum |
| 13 | Dedupe | Repeated identity/bookmark moves to front |
| 14 | Eligible Nearby entities | 42 default-mode grouped/deduplicated anchors: existing places and validated WM0 transitions |
| 15 | Exclusions | 12 parent-place, 6 field-only, 6 unresolved Atlas entities; no reward distance from a parent representative |
| 16 | Distance | Existing V1 reference sphere, R = 6,371,008.8 m; atan2(cross norm, dot) great-circle distance |
| 17 | Antimeridian/poles | Unit checks pass for short seam arc, poles and coincident points |
| 18 | Native policy | Nearby unavailable in WM2/WM3; no global transform invented |
| 19 | Query time | Observed 0–0.2 ms, typically about 0.1 ms, for the 42-anchor index; browser clock resolution limits small samples |
| 20 | Tour schema | Local record ID/name/created and ordered identity-only ID/target/duration/title stops |
| 21 | Tour targets | WM0 identities; Atlas places without anchors are informational; native/view/reward targets excluded by builder |
| 22 | Tour controls | Play, Pause, Previous, Next, Stop; draft timing/title/reorder/remove |
| 23 | Camera | Existing Fly-to; completion/Stop restores captured overview camera/projection/layers/selection |
| 24 | Reduced motion | Immediate focus for tours; Follow camera movement disabled |
| 25 | Tour persistence | Central user state; actual public/local browser workflows pass |
| 26 | Import/export | Deferred optional scope; no coordinate export path exists |
| 27 | Route implementation | Existing solved corridor, shared projected buffer attributes, independent even draw range |
| 28 | Follow | Existing focus method on runtime corridor samples, throttled; no Explorer autoplay |
| 29 | Speed | 0.5×, 1×, 2×, 4× |
| 30 | Solver unchanged | Protected worker/graph/profile/math hashes unchanged; browser result text/node count unchanged after playback/projection switch |
| 31 | Playback performance | 1,000 progress updates keep identical geometry/buffer references; actual 30-node corridor Follow sample 172.5 FPS, solver result unchanged |
| 32 | ShareState | `gaiagis-share-state`, version 1; separate strict allowlist |
| 33 | URL fields | Language, map, projection, native view, registered layer IDs, spoiler mode, public Location or Atlas ID |
| 34 | Forbidden fields | Coordinates/XYZ/camera, triangle/node IDs, hashes, paths, packs, screenshots, credentials, entire AppState |
| 35 | Fallback | Public `?place=midgar` opens authored card without fake Fly-to; local waits for workspace; stale/invalid targets remain graceful |
| 36 | URL size | Exercised Atlas link 88 characters; maximum 1,000 |
| 37 | Leakage audit | Allowlist rejection tests, real URL inspection and new tracked changes/public artifact scan: zero private-coordinate/path leaks |
| 38 | Opacity layers | Terrain tint, Encounters, Traversal, Reachability, Events, Atlas, Distortion/Tissot, Routes |
| 39 | Opacity persistence | Central user preferences mirrored into existing PreferenceState; no extra storage key |
| 40 | Reset | Registered defaults restored; analysis visibility reset preserves solver result; Secrets/Collectibles visibility included |
| 41 | Legend | Existing terrain/encounter/traversal and tracks keys consolidated in Layers, with reachability/distortion/route/Atlas keys |
| 42 | 2D scale | Screen-local plane hits → existing inverseDisplay → existing reference-sphere distance |
| 43 | Globe scale | Two current-camera reference-sphere ray hits; hide on miss/unstable result/morph |
| 44 | Native scale | Hidden in WM2/WM3 and Explorer |
| 45 | Projection sanity | All 13 projection browser morphs; pure finite-screen/geodesic checks for 12 planar projections plus Globe; Mercator high-latitude change |
| 46 | Python | **303 passed**, no skips/failures/errors; actual source enabled; no climate tests |
| 47 | Web | **627 passed / 5 explicit optional skips**, 24 files; 67 new navigation/integration tests |
| 48 | Browser | **128 / 128 pass**: 70 navigation/discovery + 48 Atlas regression + 10 fallback |
| 49 | Regression | Locations/Atlas/routing, 13 projections, original texture/Traversal/Compare, WM2/WM3, Explorer lifecycle and optional Atlas recovery pass |
| 50 | Desktop | A–E workflows, persistence, deep links, confirmations, offline/public parity and no page errors: PASS |
| 51 | 390px | Touch Bookmark/Recent/Nearby/Tour/Route/Opacity; no horizontal overflow: PASS |
| 52 | 320px | Same touch workflows and no horizontal overflow: PASS |
| 53 | Five locales | 735 UI keys each; parity/unique/nonempty tests and actual five-language browser checks pass |
| 54 | Startup impact | Five interleaved baseline/current runs, median loaded UI: 2,538.5 → 2,718.1 ms (+179.6 ms); launcher warm reuse 2.42 s |
| 55 | Memory/storage impact | Post-GC median heap 95,096,041 → 95,497,110 bytes (+401,069); lazy discovery JS/CSS 34,794 decoded bytes; no new dependency |
| 56 | Tracked file count | 419 |
| 57 | Proprietary assets added | **0**; tracked additions are code/docs/tests only |
| 58 | Public derived dataset added | **NO**; audited build game-derived files = 0 |
| 59 | External uploads | **0**; no account/sync/telemetry; all QA observes no automatic external requests |
| 60 | Private coordinate URL leaks | **0** |
| 61 | Private path leakage | **0 in v2.3 changes and public Web artifact**; 27 pre-existing baseline installation-root references retained separately |
| 62 | FF7 source modified | **NO**, all 12 independent before/after hashes unchanged |
| 63 | Local commit | Local main commit containing this validation; exact SHA recorded in final handoff |
| 64 | Working tree | Clean at the final post-commit checkpoint |
| 65 | v2.3.0 local RC | **YES** after the local commit checkpoint; no push/tag/Release/Pages |

## Evidence and practical limits

The existing Atlas content remains 58 entities covering all 34 Named Locations.
Precision counts remain 0 exact-source, 0 verified-anchor, 34 entrance-level,
12 parent-place, 6 field-only and 6 unresolved. Copied Wiki prose = 0,
Wiki images = 0, original assets added = 0. Steam 2026 runtime equivalence remains
NOT VERIFIED; V1 reconstruction assumptions and sealed Experimental/Inconclusive
climate status remain unchanged.

Commands: `python -B scripts/test_application.py --source YOUR_READ_ONLY_SOURCE
--output output/v2_3/application-tests`, `npm --prefix web test`,
`npm --prefix web run build:release`, `npm --prefix web run audit:release`,
`node web/scripts/browser-v23-qa.mjs`. The 48+10 regression scripts were adapted into
ignored v2.3 output paths from existing Atlas QA, retaining old spatial assertions
while allowing the newly authorized non-spatial bookmark/share actions.

Browser evidence: `output/v2_3/browser/report.json`,
`output/v2_3/atlas-regression/report.json`,
`output/v2_3/atlas-regression/fallback-report.json`.
Performance evidence: `output/v2_3/performance/report.json` and `route.json`.
Independent protection/privacy evidence: `output/v2_3/safety-before.json` and
`safety-final.json`. Private paths/screenshots are not attached to public delivery.

A whole-repository path scan also found 27 pre-existing installation-root references
in historical documents, safety fixtures and source defaults. These frozen baseline
files remain unchanged. This RC introduces zero such references, and the public Web
artifact contains zero. This distinction avoids reporting a whole-history cleanup
that was not performed.

Headless Chrome timing/FPS/heap samples describe this machine and workload; they
are not a guarantee for every device. Small query timing rounds to the browser clock.
Tour import/export, built-in sample tour, legend category toggles and optional minimap
remain explicitly deferred. No v2.4 work has started.
