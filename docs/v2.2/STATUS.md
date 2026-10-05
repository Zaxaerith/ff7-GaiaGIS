# Gaia Atlas v2.2 durable development status

Last updated: 2026-10-06 (Asia/Hong_Kong).
This is working memory, not the final validation report.

## Authority and baseline

- Current Git repository, documentation and validated source are authority.
- Do not read or depend on old Codex conversations.
- Workspace is the existing project checkout.
- Baseline branch: main.
- Baseline commit: 5924fa6f29501085a308bc283d909743f84ac53e.
- Initial working tree: clean.
- origin/main matches baseline after git fetch --tags.
- v2.1.0 tag and published non-draft Release verified.
- Local main development only; commit only after RC acceptance checks.
- Author remains Zaxaerith.
- No push, tag, Release, Pages or v2.3 work.

## Goal

- Gaia Atlas: Places, Secrets, Collectibles, Knowledge.
- Source-provenanced, spatially rigorous, offline searchable knowledge layer.
- Cover every actual named Location or record an explicit exclusion.
- Research special world sites and geographically relevant rewards.
- Five locales: en, zh-CN, zh-TW, ja, ko.
- Default hides major spoilers.
- Unified Explore search, existing Inspector Place Cards, Layers controls.

## Frozen boundaries

- V1 inverse Mercator, radius, topology, caps and E/W/N/S handling frozen.
- Thirteen projections and source geometry frozen.
- Locations, entrances, encounters, traversal, events and routing frozen.
- WM2/WM3 native coordinates and transition semantics frozen.
- Texture/UV, relief, Explorer movement/landing/model sources frozen.
- v2.1 lighting, presentation and audio frozen.
- Local Auto Workspace remains the single launcher/generator path.
- Steam 2026 executable equivalence remains NOT VERIFIED.
- Climate remains sealed Experimental / Inconclusive; execute no climate tests.

## Restored context

- Read README, user guide, methodology and architecture.
- Read v2.0 local workspace and validation.
- Read v2.1 validation and party model research.
- Read v2.1 presentation, lighting and data research.
- Source POI groups editorial identities, not coordinate constants.
- Named Location navigation is its primary verified entrance.
- Entrance representative is largest source trigger triangle centroid.
- This is entrance precision, never the exact interior reward position.
- Existing public POI identity registry has 34 possible named groups.
- Actual generated inventory: 34 named Locations; all covered.
- Gold Saucer and Northern Cave are explicitly unresolved in POI.
- Six panels and a common Inspector already exist.
- Navigation registry already combines Location, Entrance, Transition, Event.
- Workspace schema 1 / workspace-1 / tool 2.0.0 describe compatibility.
- Per-asset generator markers can invalidate only one payload.
- Workspace generator uses source + dependency + output hashes for reuse.
- Optional assets fail independently; public source-only startup has no pack.

## Architecture decisions

- Public curated JSON with names, authored summaries, facts and source registry.
- No public coordinate constants or complete game-derived datasets.
- Python Atlas validator and binder beside existing exporters.
- Single build_workspace gains an optional Atlas step.
- Generated gaia-atlas.json remains ignored and manifest-listed.
- Browser Atlas owner validates public content and local binding separately.
- Existing search/Inspector/actions consume identity references.
- Independent markers only for validated world anchors.
- Field-only and parent-place rewards appear in cards, not map markers.
- Lightweight normalized name/alias/reward search.
- Deterministic marker decluttering; no proximity/tours/bookmarks feature.

## Schema decisions

- AtlasEntity stable ID, kind, localized names and summaries, aliases.
- Region/tags/spoiler, typed sourced facts and related entity/location IDs.
- AtlasSource registry: provider, title, URL, reviewed date, type, notes.
- Each factual entry and important fact must refer to valid source IDs.
- Public binding requests carry identity references only.
- Local binding includes kind, evidence, precision and validated lineage.
- Precision: exact_source, verified_anchor, entrance_level, parent_place.
- Also field_only, non_spatial, unresolved.
- Unresolved knowledge remains searchable but has no navigation coordinate.
- Actual exact_source count may be zero; never increase it by guessing.

## Source policy

- Target original FF7 (1997/classic PC); exclude Remake/Rebirth lore.
- Actual source first, then reverse-engineering, official, Wiki, references.
- Targeted page reads only; no blind crawling or site mirror.
- Authored short factual summaries; no copied prose/images/article HTML.
- Runtime never fetches external sources; links open only by user action.
- Cache/research outputs and screenshots, if needed, stay ignored locally.
- Record disagreements, chosen interpretation and unresolved relationships.

## Completed phases

- Baseline repository/fetch and workflow inspection complete.
- Required existing documentation read and current source interfaces inspected.
- Durable working memory established before implementation.
- Public curated data and strict Python/Web validators implemented.
- Workspace Atlas generator/hash/reuse integration implemented.
- Unified Explore, Inspector, Layers and context actions integrated.
- Independent before snapshot: 484 protected files and 12 FF7 inputs.

## Unresolved / environment

- Command sandbox setup fails with helper_unknown_error.
- Approved local commands work; use per-command safe.directory for Git.
- Do not modify global Git configuration.
- Targeted original-game Wiki, Jegged and field reference research complete.
- 58 entities, 38 source records, 290 authored summaries.
- 34 entrance-level, 12 parent-place, 6 field-only, 6 unresolved.
- Chrome/Playwright transport confirmed; screenshots stay ignored.

## Current test status

- Python Atlas pack generation passes on actual existing workspace.
- Web production build passes with Atlas search/card/layer integration.
- Python non-climate application suite: 303 passed, actual source enabled.
- Final Web full suite: 560 passed / 5 optional private-fixture tests skipped.
- Atlas Web suite: 23 passed including one-edit spelling fallback.
- Release code-only audit passed.
- Workspace 15 assets; original components reused; warm all reused.
- Atlas browser acceptance: 48 checks passed on actual desktop/390/320.
- Fallback acceptance: 10 checks passed (old/corrupt/public/replacement).
- Zero page errors or external requests; 665 complete UI keys.
- Final versions set to 2.2.0; release source-only audit passes.
- Historical test counts are context only, not current verification.
- Schema/provenance/no-fake-coordinate/search/spoiler/workspace gates pass.
- Non-climate regressions and source-only release audit pass.
- Actual desktop, 390px and 320px browser workflows pass.
- Independent frozen-file and FF7 before/after fingerprints match.

## Next action

- Final 58-item validation report and independent safety audit complete.
- All local RC acceptance gates pass; 398 public tracked files.
- The final local main commit contains only public code/docs, author Zaxaerith.
- Verify clean tree after commit, report its SHA and immediately stop.
- Do not publish or start another version.
- Update this file after every major phase and read it after compaction.
