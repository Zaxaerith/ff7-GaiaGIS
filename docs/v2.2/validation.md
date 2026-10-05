# GaiaGIS v2.2.0 local RC validation

Acceptance date: 2026-10-06 (Asia/Hong_Kong). Baseline: main / `5924fa6f29501085a308bc283d909743f84ac53e`, verified published v2.1.0. This release candidate adds Gaia Atlas only. Reconstruction, projections, climate and existing source parsers remain frozen. Steam 2026 executable equivalence remains NOT VERIFIED.

## Required 58-item report

| # | Acceptance item | Result / evidence |
| --- | --- | --- |
| 1 | External sources | 38 registry records: FF7 field-ID reference, original-game FF Wiki, Jegged, StrategyWiki; complete linked registry in atlas-research.md. |
| 2 | Review policy | Targeted original-game review on 2026-10-06; source spatial authority first; authored summaries, no runtime external fetching. |
| 3 | Named Locations total | 34 actual manual_verified_field_identity groups. |
| 4 | Named coverage | 34 / 34 (100%). |
| 5 | Exclusions | 0; unresolved extra sites are included as knowledge. |
| 6 | Secret / special sites | 11 entities tagged secret (including four Materia Caves); four additional researched special places beyond existing named coverage. |
| 7 | Collectible / reward records | 19; includes grouped rewards, not 19 independently mapped chests. |
| 8 | Source conflicts | Corel/Corral, reward name variants, Old Man cave/house description, Great Glacier return restrictions; choices and reasons in research report. |
| 9 | Unresolved facts | Six entities lack authoritative WM0 anchors; exact interior positions and unsupported reward timing/availability are omitted. |
| 10 | Kinds | 13 actually used: city, town, village, settlement, dungeon, landmark, materia_cave, world_map_site, chocobo_site, vehicle_site, secret_area, collectible_site, treasure_group. |
| 11 | Source schema | id/provider/title/HTTPS url/reviewed/type/notes; entity and fact source-ID references. |
| 12 | Binding types | location, parent_location, field_parent, non_spatial, unresolved; related entrances/transitions are lineage context. |
| 13 | Precision classes | exact_source, verified_anchor, entrance_level, parent_place, field_only, non_spatial, unresolved. |
| 14 | Spoiler classes | none/minor/major; hide-major default, show-all and hide-all options. |
| 15 | Localization | Five authored summary locales and complete UI dictionaries; canonical original-game names retained as fallback with multilingual aliases. No claim of official localized nomenclature. |
| 16 | Entities | 58. |
| 17 | Localized summaries | 290 (58 × 5). |
| 18 | Source references | 106 entity/fact references to 38 registry records. |
| 19 | Generated pack size | 79291 bytes (private ignored JSON). |
| 20 | Atlas SHA-256 | `992c59a7a3a5231b93aba37edaa0119b9e0b0324dfa8ed79efd1011814400d55`. |
| 21 | Manifest | 15 files; Atlas is optional, atlas-1, WM0, POI dependency plus curated/source/transition fingerprints. |
| 22 | Warm reuse | All steps reused; a curated-content update rebuilt only Atlas. Original geometry/texture/Explorer/presentation packs were reused. |
| 23 | exact_source | 0. |
| 24 | verified_anchor | 0. |
| 25 | entrance_level | 34. |
| 26 | parent_place | 12. |
| 27 | field_only | 6. |
| 28 | non_spatial / unresolved | 0 / 6. |
| 29 | No guessed points | Public request schema rejects coordinates; generated bindings serialize identities/evidence only. Source-verified POI entrances are the only point authority. Field/parent/unresolved records have marker=false. |
| 30 | Atlas search | Unified Explore registry; localized names, aliases, facets, normalized prefix/substring and one-edit fallback; existing Location/Entrance/Transition/Event search preserved. |
| 31 | Item / reward search | Knights, HP↔MP and Megalixir checks pass; visible reward terms lead to reward and parent cards. |
| 32 | Place Card | Shared Inspector with overview, type/region, access, gameplay, discoveries, spatial evidence, related places and sources. Missing sourced details explicitly remain unknown. |
| 33 | Sources | Reviewed source links, HTTPS and noopener/noreferrer; no automatic article requests. |
| 34 | Secrets layer | Original CSS diamond markers at validated existing entrances; deterministic 32px screen declutter. |
| 35 | Collectibles layer | Only verified parent-place anchors with visible discoveries; no reward-position markers. |
| 36 | Spoilers | Major reward hidden from search/card/marker aliases; show/re-hide verified in browser. |
| 37 | Context actions | Atlas verified entrance supports route start/destination, measure and Explorer; parent/field rewards only Fly to parent place; unresolved/public no spatial action. |
| 38 | Mobile QA | 390px and 320px: card, source links, keyboard search and no horizontal overflow; screenshots visually inspected. |
| 39 | Python tests | 303 passed, 0 skipped/failures/errors; actual source enabled. Atlas targeted 17 pass. Climate tests executed: 0. |
| 40 | Web tests | 560 passed / 5 skipped / 0 failed across 22 files; Atlas suite 23 passes. Five skipped tests require optional private fixtures at historical public-data test paths; actual current workspace is separately exercised in browser/Python. |
| 41 | Browser checks | 58 / 58 pass: 48 Atlas and 10 fallback checks, zero page errors/external requests. |
| 42 | Regression | 303 non-climate Python + full Web suites, 13 projection transitions, real routing/Explorer, native WM2 switch, optional pack degradation and stale-context cleanup. 484 protected files unchanged. |
| 43 | Desktop | 1440 × 900 actual local launcher, card/source/route/Explorer/layer/spoiler/locales pass. |
| 44 | 390px | Actual launcher acceptance passes; no overflow. |
| 45 | 320px | Actual launcher and source-only fallback pass; no overflow. |
| 46 | UI key count | 665 unique keys, complete parity across five locales; 63 new Atlas keys. |
| 47 | Search latency | 15.28–28.53 ms observed browser fill-to-results, including Playwright overhead; no network query. |
| 48 | Atlas load time | 3.10–3.40 ms handler parse/bind/refresh on desktop/390/320; excludes HTTP transfer and initial module download. |
| 49 | Tracked files | 398 including this report; no generated pack or screenshot tracked. |
| 50 | Copied Wiki prose | 0; independently authored short factual summaries. |
| 51 | Wiki images | 0. |
| 52 | Original game assets added | 0; code-only release audit passes. |
| 53 | Public complete game-derived dataset | NO; generated Atlas/POI/geometry and all screenshots remain ignored. |
| 54 | Private path leakage | 0 in added public content; diagnostics browser checks and staged-text audit. |
| 55 | FF7 source modified | NO: 12 input files independently compared before/after; all unchanged. |
| 56 | Local commit SHA | The main commit containing this report; exact SHA is reported in the final response and `git rev-parse HEAD`. A report cannot embed its own future commit hash. |
| 57 | Working tree | Clean verified immediately after the local commit; origin/main remains baseline. |
| 58 | GaiaGIS v2.2.0 local RC | YES. Stop after local commit; no push/tag/Release/Pages or v2.3. |

## Reproduction

Use the existing workspace environment helper and a user-selected read-only FF7 source. No private path belongs in a public report.

- `python -B scripts/test_application.py --source <selected-source> --output output/v2_2/application-tests` (excludes sealed climate tests).
- `npm --prefix web test`.
- `npm --prefix web run build:release` and `npm --prefix web run audit:release`.
- `python -B -m gaiagis.build_workspace --source <selected-source> --output output/local-workspace`, then repeat for warm reuse.
- Start the local launcher on 5182, serve the audited code-only dist-release on 5183 for source-only fallback, run `node web/scripts/browser-atlas-qa.mjs` and `node web/scripts/browser-atlas-fallback-qa.mjs`.

Ignored evidence lives under output/v2_2: independent safety-before snapshot, application-tests/tests.json and tests.log, workspace-build/warm logs, launcher logs, browser report/fallback-report and private screenshots. These records are local, reproducible and never part of public distribution. FF7 inputs were fingerprinted independently before implementation and again after QA. No current report was used as its own before baseline.

Browser tests exercise real source packs, not synthetic coordinates: all 13 projection views, cave/reward precision, route and Explorer entry, parent-only flight, spoiler default/show/re-hide, Sources, five locales, desktop/mobile, native view hiding, old workspaces without Atlas, corrupt optional Atlas, base dataset replacement, and public knowledge without data. Release bundle audit confirms only code, authored knowledge, original CSS and licensing notices.

## Limits and source decisions

Entrance precision describes a trigger representative, not the exact interior place or chest. Unknown gameplay/access details remain labelled unknown. Original English names are preserved where a reviewed official localized name was unavailable. Field-parent bindings do not identify which room/object inside the field contains a reward. Native WM2 knowledge has no synthetic global anchor. The six unresolved records remain searchable; none is falsely mapped. The five optional Web fixture skips are reported, not silently treated as executed tests.

The command sandbox helper failed initialization in this session. Approved local commands were used, with per-command Git safe.directory; global Git config was not modified. An initial browser run failed because a running launcher had a static-file whitelist from an earlier build, and another test used the manual-load status label for auto-load. Restarting the launcher and waiting for the Atlas load handler resolved those QA setup issues. Final reports pass on the final 2.2.0 build.

See [reviewed source registry/inventory](atlas-research.md), [schema](atlas-schema.md), [binding evidence](spatial-binding.md) and [durable status](STATUS.md). All work stays on local main. No publication operation is authorized or performed.
