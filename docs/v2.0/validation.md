# GaiaGIS v2.0.0 local validation

Validated on 2026-10-05. Baseline local main:
`0cc34e7839dc9372f9f1f0f1945a3226ff8abda6` (v1.9.0).
This release integrates existing capabilities; no new reconstruction, projection,
terrain rule, route topology, climate experiment or runtime simulation is introduced.
The public delivery remains code-only. Actual dataset reports and screenshots are
private ignored workspace outputs.

## Acceptance evidence (requested report items 1–71)

| # | Topic | Result / boundary |
|---:|---|---|
| 1 | AppState | Typed immutable Data, Map, View, Selection, Analysis, Explorer and Preferences slices; updates preserve unaffected slice references. |
| 2 | Map/view separation | WM0 GaiaGeographic versus WM2Native/WM3Native; projections and native camera modes are separate view state. |
| 3 | Capabilities | Pure map/data/Explorer-state checks; WM2/WM3 cannot acquire WM0 global measurement or routing capabilities. |
| 4 | Feature registry | Ten explicit feature definitions carry labels, required data/capabilities, supported maps, panel and defaults; consumed by shell availability. |
| 5 | Selection | Nine identity-based kinds: Triangle, Location, Entrance, Encounter, Event, Transition, Route, Measurement and Explorer. Owners dispatch directly; no geometry copied into state. |
| 6 | Resources | Idempotent reverse cleanup scopes, cancellation epochs, serialized workspace adoption, worker termination, owner caches and page-hide disposal. |
| 7 | Workspace format | Thirteen payload files in twelve logical groups, with one local manifest; no wrapper geometry copy. |
| 8 | Manifest schema | gaiagis-workspace/version 1; separate tool/generator versions; safe basenames, map IDs, hashes, sizes, dependency names; timestamps omitted. |
| 9 | Unified CLI | python -B -m gaiagis.build_workspace --source YOUR_FF7_INSTALLATION --output local-workspace; editable-install entry gaiagis-build-workspace. |
| 10 | Asset types | WM0 metadata/mesh, POI, encounters, events, routing, WM0 textures, WM2/WM3 native maps/textures, transitions, Explorer. |
| 11 | Compatibility | Manifest hash/size/map/dependency/cycle validation before adoption, cross-asset source bindings, then existing transport codecs. Unknown or incompatible data is not silently reinterpreted. |
| 12 | Directory picker | User-initiated recognized root-file reads only; nested folders/saves and arbitrary files are not scanned. |
| 13 | Fallback | Folder input and multi-file chooser; existing two-file geometry and independent optional inputs retained. Chromium folder-input path tested. |
| 14 | Degradation | Missing optional groups remain unavailable; corrupt optional groups isolated. Loaded/Legacy/Optional/Missing/Loading/Incompatible/Corrupt/Unsupported statuses remain distinct. |
| 15 | Surface deduplication | YES. Version 2 borrows map owners; adjacency remains. Integer recovery rejects incompatible precision, rather than changing movement rules. |
| 16 | Explorer v1 size | 9,857,900 bytes for this actual dataset. |
| 17 | Explorer v2 size | 851,560 bytes; eight models,43 clips, nine textures unchanged. |
| 18 | Reduction | 9,006,340 bytes, 91.36%. |
| 19 | Legacy compatibility | Existing version 1 Explorer and all other version 1 transports retained; real legacy Explorer regression 157/157 passed. |
| 20 | Determinism | Explorer v2 SHA-256: `53e5c35e3517a1eea2a1c447ba71d7b00e53aa4109ae97c5770d43676e3d313a`. Repeated identical-runtime/cache workspace builds are byte-identical; see runtime caveat below. |
| 21 | Panels | One primary Explore/Layers/Analysis/Map/View/Data sidebar or mobile drawer, one secondary context Inspector. Native layer/view controls use the same groups. |
| 22 | Onboarding | Explains mathematical reconstruction, private generation/local loading and About; explicit dismissal stored locally. |
| 23 | Inspector | Context/provenance renderers preserved; route and measurement results keyboard-selectable; Explorer owns a minimal HUD and restores prior selection on exit. |
| 24 | Search/actions | Verified Locations/Entrances/Transitions ranked by normalized name/aliases; route endpoints, measure-here and verified-entrance Explorer actions reuse existing owners. |
| 25 | Breadcrumb | Persistent map and coordinate-space context; native target opening does not imply a geographic transform. |
| 26 | Explorer UI | Persistent Exit HUD/touch pad; unrelated controls hidden, mobile drawer closes, overview camera/selection restored on exit. |
| 27 | Desktop | Real integrated workflows and all 13 views passed; source-only production plus local asset adoption also passed. |
| 28 | 390 px | Touch selection, context measurement, Explorer enter/exit, stacked comparison, focus and no-overflow checks passed. |
| 29 | 320 px | Same workflow passed, including folder-input fallback; screenshots visually reviewed. |
| 30 | Workflow A | Midgar search→Inspector→measure→Midgar/Kalm route→Equal Earth/Mercator comparison→Globe→verified entrance Explorer→exit PASS. |
| 31 | Workflow B | Source transition→WM2 native→original texture→Submarine preview→WM0 PASS; native global-analysis controls hidden. |
| 32 | Workflow C | Equal Earth Tissot/distortion probe→reference-sphere area→original texture PASS. |
| 33 | Workflow D | Touch Inspector→measure→Explorer→stacked comparison at 390 px and 320 px PASS. |
| 34 | Source-only startup | Median 134.8 ms, initial JS 90,097 encoded bytes; baseline 162.8 ms/239,112 bytes, five contexts each. |
| 35 | Full workspace | 19,124,791 payload bytes; sample 2369.7 ms; production workflow 2710.1 ms. |
| 36 | WM0 load | Production two-file chooser 535.6 ms. |
| 37 | Projection switch | All 13 endpoints passed; 20.8–226.9 ms in production, reduced motion. |
| 38 | Route query | Midgar→Kalm worker query 27.9 ms; topology and static rules unchanged. |
| 39 | Explorer load | Version2 decode/shared preparation 778.1 ms. |
| 40 | Explorer enter | Verified entrance→active 198.1 ms. |
| 41 | Map switch | WM0→WM2 canvas ready 82.8 ms. |
| 42 | Compare enter | 200.5 ms; second canvas released on close. |
| 43 | Draw calls/memory | Overview 3, comparison 3+3, closed 3+0; Explorer 21→exit 3; WM2 native 1. Heap 182–216 MB is observational, not a GC/leak proof. |
| 44 | Keyboard | ARIA tabs Left/Right/Home/End, Enter/Space tool-result selection, search keyboard regression and Escape checked. |
| 45 | Focus | Onboarding initial focus, mobile drawer Escape→menu, Inspector close→canvas/menu; Explorer exit restores controls. |
| 46 | ARIA/i 18 n | Tablist/tab/tabpanel, labeled dialog/controls, live load status; five locales with 567-key parity. |
| 47 | Reduced motion | Real workflows ran with prefers-reduced-motion: reduce; existing animation preference handling retained. |
| 48 | Contrast | Dark scene/light text, outlined focus and visible context buttons visually reviewed at desktop/320 px/390 px. No claim of exhaustive WCAG/screen-reader certification. |
| 49 | Python | 240/240 passed with actual read-only source,0 skipped/errors/failures. Public-source copy:210 passed,30 actual-source cases skipped. Climate tests executed 0. |
| 50 | Web | 495/495 passed across 19 files. Public-source copy:487 passed,8 private-artifact integration tests skipped,0 failures. |
| 51 | Browser | 72 integrated production checks +17 source-only checks +157 Explorer legacy +137 textures/cartography legacy =383 recorded assertions; all passed, no page errors. Development workflow 68 checks before the final legacy-reload cases also passed. |
| 52 | Regression | All non-climate Python/Web regressions included. Real legacy browser assertion bodies retained with a private adapter opening the new panel groups; not a claim of rerunning every historical browser script. |
| 53 | Integration | Actual 13-file workspace, legacy Explorer v1, full surface equality, optional/hash/dependency/cancellation tests, source-only clean copy, desktop/mobile A–D. |
| 54 | Build | npm run build PASS (TypeScript + Vite). |
| 55 | Code-only build | npm run build:release PASS; source-only build includes executable chunks/licenses only. |
| 56 | Release audit | npm run audit:release PASS,14 artifact files, game_derived_files 0; same in clean public-source copy. |
| 57 | Translations | 567 keys in en,zh-CN,zh-TW,ja,ko; runtime switching passed in browser. |
| 58 | Tracked files | 356 public files at this local RC; generated payloads/screenshots/profiles/output remain ignored. |
| 59 | README | Rewritten around the integrated product, public code-only data policy, real CLI, reconstructed/observed distinctions and licensing. |
| 60 | User guide | docs/user-guide.md: installation/generation/loading, six panels, mobile/keyboard, troubleshooting and limits. |
| 61 | Methodology | docs/methodology.md: frozen V1 assumptions, source provenance, static/runtime distinctions and uncertainty. |
| 62 | Architecture docs | docs/architecture.md and initial architecture-audit.md: slice/owner boundaries, minimal migration and resources. |
| 63 | Workspace docs | Workspace format, data compatibility, integration, performance and this validation report complete. |
| 64 | Proprietary tracked | 0. No FF7 MAP/BOT/LGP/TEX/executable/model resources committed. |
| 65 | Decoded public assets | 0. No original textures/models/animation dumps or complete decoded datasets committed. |
| 66 | Derived publication | Public derived data included = NO. All actual packs, manifest, GIS products and screenshots stay ignored locally. |
| 67 | Path/privacy audit | 0 private-user paths/credential patterns in public candidates. Diagnostics intentionally omit paths, input names/contents and secrets. |
| 68 | Source safety | FF7 source modified: NO. Seven core file sizes/hashes unchanged; all 73 protected mathematics/source/GIS checks unchanged. Additional field archive binding rechecked. |
| 69 | Commit | Local main commit containing this report; obtain exact SHA with git rev-parse HEAD. The completion message reports the resulting SHA, avoiding a self-referential document hash. |
| 70 | Working tree | Required clean after local commit; final git status verification is recorded in the completion message. |
| 71 | RC | GaiaGIS v2.0.0 local release candidate = YES after these local gates. No push, tag, Release or Pages deployment; stop for user acceptance. |

## Determinism and source precision

The existing compatible Stage 1-cache path and a fully fresh WM0 GIS build were
both exercised, then repeated with every modular step reused. Identical inputs,
runtime and cache produced byte-identical manifests/payloads. Stage 1 cache identity
is an input: a fresh GeoPackage has its own actual provenance hash. PNG compressed
bytes can differ between existing Python/zlib runtimes; all three decoded texture
pixel arrays and UV arrays were compared and were identical. Geometry, POI,
encounters, events, routing, native maps, transitions and Explorer payloads were
byte-identical between these paths. No universal cross-runtime binary determinism
is claimed, and no frozen PNG/UV/GIS algorithm was changed to force such a claim.

Imported-cache manifest SHA-256:
`cd6fed0d6c83e4c17dddb1ab6469ce02b01f5770099c87aa492508f9908baa30`.
Fresh-cache manifest SHA-256:
`8b430318dba4ccae54c67c51d9dd74ddbf4ba7e5eac817ab6699dbe993cb9cc0`.

Shared-surface validation covers 160,821 source triangles across WM0/WM2/WM3,
with zero position/attribute/neighbor differences against legacy Explorer v1.
WM0 inverse corner error was at most about 0.0154 raw north units and rounded to the
same source integers. The 0.125-unit acceptance guard rejects incompatible input.
Synthetic polar caps remain outside the original WM0 gameplay surface.

## Source fingerprint comparison

The installation was used only as binary/data input. Before/after SHA-256 values
are equal for every file below; sizes also match. No game-side cache or output exists.

| Source | Bytes before = after | SHA-256 before = after |
|---|---:|---|
| wm0.map | 3250176 | `43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C` |
| wm2.map | 565248 | `404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02` |
| wm3.map | 188416 | `70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3` |
| world_us.lgp | 3114259 | `975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C` |
| wm0.bot | 15638528 | `8C4312419869A3ED862F56A53713123ABED4938962E986460E300786D51A719E` |
| wm2.bot | 2260992 | `D1F90526594F0F70089AE2D71E9A1643C4434414A04FA13CF3B9BEAB2EE43720` |
| wm3.bot | 753664 | `B98E10B46D4E8427DEAE3514A4A448C28971E99F584011E7102E61B94F1FC3FF` |

Additional `flevel.lgp` source binding:
`af695ccf7c681be222f5f716758160e39469ec02bc0af3dd6f20a5e9c2a34807`.
The generator checks source fingerprints before and after generation. Frozen
73-file checks cover mapping/projection/core source semantics and existing GIS outputs.

## Reproduce local gates

```powershell
. ./scripts/use_workspace_environment.ps1
python -B scripts/test_application.py --source "YOUR_FF7_INSTALLATION" --output output/application-tests
cd web
npm test
npm run build
npm run build:release
npm run audit:release
node scripts/browser-v20-qa.mjs
```

Full browser QA expects an existing locally generated workspace under
`output/v2_0/workspace` and a local dev server. For an asset-free production preview,
set `GAIAGIS_QA_SOURCE_ONLY=1` and `GAIAGIS_QA_URL=http://127.0.0.1:5175`.
The public browser script writes only ignored reports/screenshots below the workspace.
Actual-source tests explicitly skip without local data; no test binary contains FF7 bytes.
GDAL projection regressions use the existing QGIS environment, never install a new tool.
No climate tests/simulations run in this application suite.

## Known limits retained

Steam 2026 executable/runtime equivalence is **NOT VERIFIED**. Traversal/routing are
static classic-PC analysis, not current save/story/ownership or guaranteed gameplay
reachability. Native WM2/WM3 global registration remains unknown. Script events keep
unresolved anchors and runtime conditions. Explorer positions/animation are previews,
not a world VM or save emulator. V1 reference radius, vertical scale and polar closure
remain mathematical assumptions; climate research remains Experimental/Inconclusive.
Chromium is the exercised browser; directory-input fallback exists but cross-browser
certification and exhaustive assistive-technology testing are not claimed. Performance
measurements are local sanity results; see [performance](performance.md).
