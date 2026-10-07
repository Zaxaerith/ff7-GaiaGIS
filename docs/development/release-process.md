# Release process

## Responsibilities

- `ci.yml`: ordinary push/PR Web validation, builds and public audit.
- `pages.yml`: explicitly dispatched source-only Viewer deployment.
- `release.yml`: approved annotated-tag Windows packaging; dispatch defaults to artifact-only dry run.

Development completion does not grant publication permission. Obtain explicit user approval before remote main/tag/Release/Pages operations. Preserve existing tags/releases and published history; never force push or rebase published commits.

## Preflight and publication

1. Update **only** `src/gaiagis/_version.py` for the application version. Review current docs and concise CHANGELOG.
2. Verify clean intended commit, normal fast-forward baseline, non-climate regressions and public asset audit. Local package smoke verifies the recipe; do not use its ZIP as a Release upload.
3. After explicit publication approval, push the source commit normally and wait for real CI.
4. Create an annotated `vX.Y.Z` tag matching the authority at that exact successful commit, then push that approved tag.
5. Actions checks out the exact tag, validates annotation/version/commit/cleanliness, installs pinned Python and Node tooling, runs Web tests/build/release audit, freezes the portable executable, performs isolated smoke and deep public audit, then creates the ZIP and SHA256.
6. Actions uploads build artifacts and, on an approved tag event or explicit non-dry-run dispatch, creates a new published GitHub Release and attaches `GaiaGIS-vX.Y.Z-windows-x64.zip` and `SHA256SUMS.txt`. It rejects an existing Release rather than overwriting it.
7. Separately approve/run source-only Pages and verify deployment/public fallback, Release download/checksum and exact tag target.

## Dry run

Manually dispatch `release.yml` with an existing recipe-containing annotated tag and **dry_run=true** to build/upload Actions artifacts without creating a Release. If the candidate has no tag yet, run the same recipe locally; this is equivalent recipe validation, not a remote workflow execution or official artifact.

## Distribution boundary

Portable delivery contains authored application code, compiled source-only Viewer, required open-source runtime, corresponding source and licence notices. It excludes private tests/logs, user saves, workspaces, screenshots, original assets and complete game-derived datasets. Generated assets are built from the user's installation after launch.

Failure requires diagnosing the actual build/smoke/audit condition. Do not edit historical tags/releases or claim an unbuilt executable exists. Official binaries come solely from Actions' exact-tag source build. Local `output/distribution/` is always ignored developer evidence.
