# Development workspace hygiene

Keep maintained code, active development output and user research separate. Local
cleanup does not authorize publication; follow AGENTS.md for remote operations.

## Directory roles

- `src/`, `web/src/`, `tools/` and the existing test directories hold maintained
  code. Extend their current entry points instead of copying version-specific
  runners into output directories.
- `output/dev/current/` holds task-scoped QA output. Remove disposable fixtures,
  browser profiles, screenshots and build work after the task is accepted.
  Tests recreate their scratch directories when needed.
- `output/dev/failed-<kind>-<run-id>/` records failed runs. The application does
  not rotate these automatically; review and delete resolved, obsolete runs
  during ordinary maintenance.
- `output/local-workspace/`, including `.build/visual-recovery/` and recovery
  manifests, holds active research and recovery data. Preserve it.
- `output/exports/`, `qgis/`, private reference material and user-edited research
  are user data. An ignored file is not necessarily disposable.
- `output/distribution/` and task-local `package-*` directories hold generated
  binaries. Keep the active unpublished RC and its checksums; remove obsolete
  local candidates after release. Official binaries come from the release
  workflow. Git history and published releases retain formal version records.
- `.cache/`, `.venv/` and `web/node_modules/` contain reusable environments and
  downloads. Keep useful installed dependencies; bytecode, stale compile caches
  and temporary logs can be removed without reinstalling those dependencies.

## Retention

Keep unique source oracles, provenance, research findings and recovery pairs.
Historical protection manifests and old references do not require every QA log,
ZIP or wrapper to remain forever. Preserve the useful research evidence while
removing duplicate test output and completed one-time report generators.

Review uncertain GIS or research products before deletion. Use explicit paths
inside this checkout, respect active processes and filesystem redirects, and do
not use `git clean`, history rewriting or whole-workspace backup copies for
routine cleanup. Keep private inputs and generated game data ignored.

For a quick size check, ordinary filesystem statistics are sufficient. The
existing `tools/workspace_audit.py` remains available when its detailed report is
needed; routine cleanup does not require hashing all files or retaining a new
inventory. Do not add another archive or manifest system.
