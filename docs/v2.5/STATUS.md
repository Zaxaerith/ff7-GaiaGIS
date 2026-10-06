# GaiaGIS v2.5 — Explorer Locomotion & Spatial Analysis

## Authority and baseline

- Repository/source/this document are durable authority.
- Remote main, local main and annotated v2.4.0 resolve to
  `79f9fe8b79eec5458f89b606f5d2cc553680b221`.
- Release existence verified through GitHub, published 2026-10-06.
- Initial working tree clean. Development stays on local main.
- No push, tag, Release, Pages or v2.6 authorization.
- All writes, caches, profiles and evidence remain inside this workspace.
- FF7 installations are read-only data inputs.

## Scope

- Re-research six Extended character locomotion bindings.
- Preserve each original skeleton/model identity and own animation.
- Foot movement displacement is independent of selected appearance.
- Route elevation profile, distance-weighted terrain and encounter exposure.
- WM0 source-TIN slope and aspect.
- Network service area by path distance over the existing graph.
- Existing Analysis panel, layer/opacity/legend architecture and five locales.
- Synthetic numeric tests, real-source private browser/visual QA and regressions.
- Local RC commit by Zaxaerith after validation; stop for human acceptance.

## Frozen owners

- V1 inverse Mercator, radius, geometry/topology and seam/cap semantics.
- All thirteen projections, WM2/WM3 native coordinate spaces.
- Locations/Entrances, Atlas content/provenance/precision, transitions.
- Encounter records/lookup, traversal rules and routing weights/semantics.
- Texture/UV/relief, presentation/audio, v2.4 shell/workspace UX.
- Local automatic workspace generation and loading contract.
- Steam 2026 runtime equivalence remains NOT VERIFIED.
- Climate stays sealed Experimental / Inconclusive; execute no climate tests.

## Locomotion findings

- Existing Extended pack includes three actual field-loader clips each.
- Controller always chooses clip 1 for movement; this reproduces the slower gait.
- A third clip is a candidate only, not semantic proof.
- Need source-context evidence plus posed-cycle inspection before selecting it.
- Cloud/Tifa/Cid world-map identity bindings remain untouched.
- No cross-character retarget, procedural gait or animation inventions.
- Any cadence adjustment must be labeled Explorer preview timing.

## Analysis methodology decisions

- Borrow existing loaded WM0 mesh and frozen inverse mapping for raw TIN corners.
- Do not generate a new spatial pack or routing graph.
- Route summaries traverse the solved triangle corridor once.
- Segment splits must follow shared source edges; weight by segment distance.
- Height remains raw game height and configured 1 m/raw display height.
- Distance uses the unchanged V1 reference sphere.
- Slope uses source horizontal units and explicit vertical/horizontal ratios.
- Aspect north is decreasing source Z; east is increasing source X.
- Flat or degenerate aspect is undefined.
- Encounter exposure is static lookup/flags, never expected battles or RNG.
- Service area reuses the existing worker graph and eligibility labels.
- Thresholds are reference-sphere path metres, not travel time.
- Caps are excluded; WM2/WM3 analysis is unavailable.

## Architecture decisions

- New pure spatial functions live alongside existing analysis modules.
- Existing routing solver code/edge weights remain unchanged.
- Worker gains an additive service-area request type.
- Surface attributes computed once per loaded mesh and reused for all projections.
- Current viewer supplies shared color buffers to projection comparison.
- Analysis UI borrows owner datasets and rejects stale async results.
- New layer controls use registered opacity/reset defaults.
- No chart framework or new dependencies.
- SVG profile supports pointer and keyboard inspection.
- Private results/screenshots/animation measurements stay ignored in output/v2_5/.

## Phases

1. Baseline/context/source audit: completed; actual own bindings and posed clips measured.
2. Locomotion correction: completed; own-source fast whitelist, preview cadence, display nonpenetration.
3. Pure spatial methods: completed; 47 meaningful numeric/source cases plus state migration.
4. Worker/viewer/UI/layer integration: completed; lifecycle and native/source-only gates verified.
5. Source/browser/performance/regression validation: completed; final translated labels and method metadata verified.
6. Documentation/version/local RC: docs, 2.5.0 metadata and safety complete; local RC commit checkpoint recorded in Git HEAD.

## Tests

- Baseline v2.4: Python 304; Web 638 + 5 optional skips.
- Baseline Browser 231/231; actual deployed Pages 36/36, no v2.5 deployment.
- v2.5 Web: 686 passed / 5 optional skips; 26 files; 48 new cases.
- Python: 304 passed with actual source; climate executed 0.
- Browser: 345/345 = 114 new + 103 shell + 70 navigation + 48 Atlas + 10 fallback.
- Nine characters: own identities/finite poses/idle transitions; equal 900 raw units in 1 s.
- Visual QA: nine moving screenshots, posed bounds and private video retained ignored.
- Desktop/390px/320px: bounded docks, internal scroll and usable map PASS.
- All thirteen projections/Compare: shared attributes and route numeric invariance PASS.
- WM2/WM3/Explorer lifecycle, public fallback and local/manual workspace regressions PASS.
- Five locales: 807 keys each; actual translated labels verified.
- Release build/public audit PASS; game-derived files 0.
- Startup production medians: 2934→2949 ms, +15 ms; warm launcher 2.66 s.
- Post-GC JS heap median: +73,740 bytes; lazy surface arrays separately 1,140,688 bytes.
- Surface first compute: 131.9 ms; combined route summary about 1.2 ms.
- Service Midgar 1000 km: Foot/Yellow 430 nodes; Black/Gold 477; cached traversal 0.5–0.9 ms.
- Performance is local observation, excludes worker/GPU/backing stores where stated.

## Remaining limitations

- Preview timing is not verified Steam runtime timing.
- Residual discrete-frame foot sliding/uneven TIN and original world-leader offsets remain.
- Original Cait Sith airborne/hopping phases retained; no IK or retarget invented.
- Sampled center/shared-edge corridor distance differs from unchanged graph centroid cost.
- Height is configured 1 m/raw display; slope uses source-space ratio 1/1.
- Service highlights reachable node-center faces, not continuous buffers or travel time.
- Missing encounters retain explicit unavailable exposure; no RNG simulation.
- Native/global transform and runtime/save availability remain unknown.
- No implementation blockers remain; final safety and all checks passed; local RC complete at Git HEAD.

## Final checkpoint and next action

- 12 FF7 inputs and 735 protected historical/config/research files unchanged.
- Frozen owners unchanged; private paths/assets/screenshots/uploads added 0.
- Tracked count: 445; release build/audit PASS.
- Version 2.5.0, local main commit author Zaxaerith.
- Exact RC SHA is Git HEAD and ignored final-handoff.json; no self-referential SHA.
- Working tree clean after the commit checkpoint.
- Origin/main and v2.4.0 remain the published baseline.
- Stop for human acceptance; no push/tag/Release/Pages or v2.6.

## Stop condition

All required modules and meaningful checks pass, private source hashes unchanged,
public artifact clean, docs completed, version 2.5.0, local commit and clean tree.
Then stop without publication.

## Phase checkpoint — numeric implementation

- Python 304 passed, climate executed 0; real source enabled.
- Shared-edge midpoint denominator error found by synthetic test and fixed.
- Fast clips: adcd/avcb/aeba/acfd/aehc/afeb, own skeletons only.
- Yuffie preview rate 14/15; others 1; nominal loop cadence 2 Hz.
- Float32 source corner ambiguity guard retained from Explorer.
- New three layer IDs extend opacity defaults; old user state migrates defaults.
- UI legend must mount after shell groups exist; lifecycle ordering corrected.
