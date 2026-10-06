# GaiaGIS v2.5.0 local RC validation

Baseline verified from remote main and annotated v2.4.0:
`79f9fe8b79eec5458f89b606f5d2cc553680b221`. Development is local main only,
author Zaxaerith. No publication or v2.6 work is authorized.

## Locomotion (requested items 1–10)

Items **1–7**: complete nine-character HRC, idle, old move, final clip, semantic
evidence, frame counts and rate table in [explorer-locomotion](explorer-locomotion.md).
World leaders retain bie/dta/baa. Extended use adcd/avcb/aeba/acfd/aehc/afeb.
Rates are 1, except Yuffie 14/15; nominal fast loop cadence 2 Hz. Timing is Explorer
preview timing, not verified original Steam runtime timing.

**8 — Foot displacement:** same actual source starting triangle, camera, northward
input and 50 × 0.02 s steps: all nine advance **900 raw horizontal units** (floating
error < 1e-5). Appearance never changes the existing Foot displacement/traversal.
All own clip/skeleton matrices remain finite; idle→move→idle and facing checked.

**9 — Sliding/ground audit:** fixed-camera source clips, posed skeleton measurements,
per-character moving screenshots and private recording inspected. Slower field walk
selection corrected. Extended negative posed-floor penetration is clamped through
cached display offsets; original airborne phases remain. Residual discrete-frame
foot sliding on uneven TIN and small existing world-leader ground offsets remain
preview limitations, not a runtime-perfect foot-lock claim. No forward-only gait is
applied over backward Foot displacement.

**10 — Non-humanoids:** Red XIII retains adda/29-bone quadruped aeba; Cait Sith
retains aebc/28-bone Moogle/cat aehc hopping cycle. No humanoid fallback/retarget.

## Route profile (11–15)

- **11:** Existing solved triangle corridor; face centroid→shared-edge midpoint→
  next centroid, raw TIN height interpolation, seam-safe exact source edge matching.
- **12:** Sum endpoint great-circle horizontal distances on the unchanged V1
  reference sphere R = 6,371,008.8 m. Unchanged graph cost shown separately.
- **13:** Raw game height and configured Gaia display height (1 m/raw); never
  Official FF7 elevation. Relief/1500-unit route-line clearance do not affect values.
- **14:** Actual Midgar→Kalm sample: corridor **2,643.448 km**; min **232.5 m**,
  max **609 m**, ascent **574.5 m**, descent **627.5 m**.
- **15:** Profile, terrain and exposure share one route traversal, observed about
  **1.2 ms** combined. SVG supports pointer, native keyboard range and mobile.

## Terrain (16–19)

- **16:** Current metadata source registry; no new ecological categories.
- **17:** Shared-edge-split legs weighted by length, never face count.
- **18:** Midgar→Kalm: Wasteland (9) **1,982.885 km / 75.01%**;
  Grass (0) **587.707 km / 22.23%**; Hill Side (16) **72.855 km / 2.76%**.
  Source labels are registry facts. Synthetic 50 m Grass/50 m Forest is exactly 50/50.
- **19:** Included in the same approximately 1.2 ms route traversal.

## Encounters (20–23)

- **20:** Static region/terrain encounter-set lookup coverage along corridor legs.
- **21:** Same route: set **0:1 1,982.885 km / 75.01%**, set **0:0
  660.563 km / 24.99%**; original scene tables remain inspectable.
- **22:** Chocobo-eligible source-flag distance **0 km** on this route; synthetic
  flag coverage and distinct lookup/alias segmentation are tested.
- **23:** No RNG, expected battles, occurrence count/probability or runtime state
  simulation exists. Inactive/fallback set coverage remains static source exposure.

## Surface (24–29)

- **24:** Direct TIN plane gradient, atan(hypot(a,b)) source-space degrees.
- **25:** Configured horizontal/vertical ratio 1/1 per raw unit. This is source-space
  slope, not reference-sphere physical terrain slope; inverse Mercator is nonuniform.
- **26:** North −Z, East +X; downslope atan2(−a,b), 0 N/90 E/180 S/270 W.
- **27:** Flat gradient < 1e-8 → undefined aspect; degenerate/vertical horizontal
  determinant → undefined slope/aspect. Separate undefined legend treatment.
- **28:** **142,586** source faces; synthetic caps excluded.
- **29:** Lazy per-viewer static arrays **1,140,688 bytes**. Actual first computation
  **131.9 ms**; cached across frames and every projection. Owner replacement releases it.

## Network (30–36)

- **30:** Bounded Dijkstra inside the existing routing worker, same CSR/weights and
  eligibility labels. No copied/new graph or raster buffer.
- **31:** Foot, Buggy, Tiny Bronco and all five Chocobos exercised. Highwind and
  native Submarine excluded. An origin outside a profile's eligible surface yields zero.
- **32:** Reference-sphere network path metres; UI km. Default 100 km; tested
  100/1000 km and synthetic exact threshold clipping. No travel time/isochrone.
- **33:** Allowed-only default; Include conditional uses unchanged routing semantics,
  explicitly not a runtime guarantee. Browser verifies conditional request/result.
- **34–35:** Midgar at **1000 km**: Foot/Yellow **430** visited nodes; Black/Gold
  **477**; approximately **0.5–0.9 ms** traversal after eligibility cache. Worker timing
  excludes component preparation, message copies and rendering. Counts differ where
  the existing movement policies differ, and may match within a shared local region.
- **36:** One Uint8 flag per reachable source triangle/node center; highlight over
  existing geometry, no fabricated continuous boundary or partially reachable polygon.

## UI (37–41)

- **37:** Existing Analysis: route profile/terrain/exposure cards, source slope/aspect
  controls, network service controls. Explicit route-first/data-unavailable states.
- **38–39:** Three registered layers and opacity defaults, continuous slope ramp,
  eight aspect directions and source-node service legend within Layers. Reset tested.
- **40:** Desktop, both docks, 390×844 and 320×568: internal scrolling, no horizontal
  overflow, Inspector bounded and map remains usable. Existing v2.4 shell unchanged.
- **41:** Comparison uses shared source color attributes; all thirteen projections
  retain exactly the same cached values and profile summaries. WM2/WM3 unavailable.

## Quality (42–52)

| Item | Result |
|---|---|
| 42 Python | 304 passed, actual source; climate executed 0 |
| 43 Web | 686 passed / 5 explicit optional skips; 26 files; 48 new cases |
| 44 Browser | 345/345: 114 v2.5 + 103 shell/workspace + 70 navigation + 48 Atlas + 10 fallback |
| 45 Projections | All thirteen; exact source attribute identity, route numbers invariant |
| 46 Desktop | PASS: route/cards/layers/Compare/Explorer/local/public |
| 47 390px | PASS |
| 48 320px | PASS |
| 49 Locales | Five locales, 807 keys each; actual browser labels and parity PASS |
| 50 Startup | Five interleaved production/manual-workspace runs: median 2934→2949 ms, +15 ms; warm launcher 2.66 s |
| 51 Memory | Post-GC JS heap median 17,852,920→17,926,660 bytes, +73,740 bytes; lazy surface arrays separately 1,140,688 bytes |
| 52 Tracked files | 445 |

Performance samples describe this machine/headless Chrome/workload, not a guarantee.
Startup excludes user-triggered surface precompute; JS heap excludes worker/GPU and
external typed-array backing stores. Existing source/geometry ownership remains shared.
Old v2.4 user-state layer defaults migrate without losing identities, Views or Tours.

## Safety and Git (53–60)

- **53 Proprietary assets added:** 0.
- **54 Public derived dataset added:** NO; release build/audit game-derived files 0.
- **55 Private screenshots tracked:** 0; profiles/recordings/results stay ignored.
- **56 Private paths:** 0 in v2.5 additions and public artifact. Historical baseline
  installation-root references remain frozen; private local workspace display stays
  confined to the existing authorized local endpoint/UI boundary.
- **57 FF7 source modified:** NO; 12 before/after source fingerprints checked; 735 protected historical/config/research files unchanged.
- **58 Local commit SHA:** Git HEAD of the completed local RC; exact SHA recorded in
  ignored final-handoff.json and the user report, avoiding a self-referential commit.
- **59 Working tree:** clean at the final local commit checkpoint.
- **60 v2.5.0 local RC:** YES; final local commit/clean checkpoint recorded in Git HEAD and final-handoff.json.

V1 reconstruction/radius/topology, thirteen formulas, source Locations/Atlas,
encounter/traversal/routing semantics, transitions, textures/UV/relief, native
maps, presentation/audio and automatic workspace contracts remain unchanged.
Steam 2026 equivalence remains NOT VERIFIED. Climate stays sealed Inconclusive.

## Evidence

Ignored output/v2_5 contains source-bindings.json, safety snapshots, posed-cycle
measurements, per-character screenshots/video, browser/report.json,
shell-regression/report.json, navigation-regression/report.json, Atlas/fallback
reports, Python/Web/build/audit logs and performance/report.json.
Final production UI review confirms the actual local launcher profile and six
translated public unavailable cards; no page errors. Restarted the QA launcher
after rebuilding its static artifact to refresh its intentional filename allowlist.
The new reproducible dev/private browser QA script is web/scripts/browser-v25-qa.mjs.
It requires loopback URLs, an existing private local launcher and a local Vite server.
No private outputs are release assets. Stop at local RC; no push/tag/Release/Pages.
