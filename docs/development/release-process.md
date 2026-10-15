# Release process

## Responsibilities

- `ci.yml`: ordinary push/PR Web validation, public audit and isolated native package smoke on Windows x64.
- `pages.yml`: explicitly dispatched source-only Viewer deployment.
- `release.yml`: approved annotated-tag Windows x64 packaging; dispatch defaults to artifact-only dry run.

Development completion does not grant publication permission. Obtain explicit user approval before remote main/tag/Release/Pages operations. Preserve existing tags/releases and published history; never force push or rebase published commits.

## Preflight and publication

1. Update **only** `src/gaiagis/_version.py` for the application version. Review current docs and concise CHANGELOG.
2. Verify clean intended commit, normal fast-forward baseline, non-climate regressions and public asset audit. Local package smoke verifies the recipe; do not use its ZIP as a Release upload.
3. After explicit publication approval, push the source commit normally and wait for real CI.
4. Create an annotated `vX.Y.Z` tag matching the authority at that exact successful commit, then push that approved tag.
5. The Windows x64 job checks out the exact tag, verifies annotation/version/commit/cleanliness and runtime architecture, runs Web tests/build/audit, freezes the portable app, runs isolated HTTP smoke and deep public audit, then creates its ZIP/SHA256.
6. After that job succeeds, assembly verifies the single Windows ZIP, manifest provenance and current annotated tag target. `SHA256SUMS.txt` covers only `GaiaGIS-vX.Y.Z-windows-x64.zip`. One publish job creates the new Release on an approved tag event or explicit non-dry-run dispatch. Build failure prevents publication; existing Releases are never overwritten. macOS is no longer built or published.
7. Separately approve/run source-only Pages and verify deployment/public fallback, Release download/checksum and exact tag target.

## Dry run

Manually dispatch `release.yml` with an existing recipe-containing annotated tag and **dry_run=true** to build/upload Actions artifacts without creating a Release. If the candidate has no tag yet, run the same recipe locally; this is equivalent recipe validation, not a remote workflow execution or official artifact.

Local validation and workflow execution are separate. Historical macOS code is unmaintained and is not a prerequisite for Windows publication. A code-only smoke cannot establish original-game background alignment. v4.0 and v4.1 are published; v4.2 QGIS desktop display/attribute acceptance and publication approval are complete. Manual desktop project close/reopen has not been claimed; automated PyQGIS save/reopen is separate evidence. Do not return to an older branch or retarget published tags.

## Short path after acceptance and publication approval

1. On a clean checkout, preserve main history and safely integrate the accepted application if necessary. If origin/main advanced, analyze and revalidate instead of resetting or forcing it. Run local regressions with actual read-only source/GDAL where available, explain every skip, push accepted main normally and wait for real Windows/Web CI.
2. Confirm `_version.py` matches the approved version at that successful main SHA. For v4.2, create `git tag -a v4.2.0 ACCEPTED_MAIN_SHA -m "GaiaGIS v4.2.0"` only if absent, then push only `refs/tags/v4.2.0`. If present, verify annotation and the peeled commit first; never overwrite it. The tag push starts the exact-tag cloud build and single publish job.
3. Wait for Release Actions build → assemble → publish. Verify the public Release is neither draft nor prerelease, contains complete feature/limitation notes, and allows anonymous download of `GaiaGIS-v4.2.0-windows-x64.zip` and `SHA256SUMS.txt`. Compare downloaded SHA256 with the checksum file and GitHub asset digest, and verify bundled manifest/source provenance against the annotated tag. Official uploads come from Actions; no local ZIP upload is needed. Pages deployment is separately authorized.

Local recipe simulations do not create real tags or prove cloud success. Tag checks, workflow Python syntax and checksum/provenance guards can be exercised with synthetic packages and mocked Git/GitHub responses; report them separately from actual Actions and public Release verification.

Single-platform assembly downloads the explicitly named `release-windows-x64` artifact into its explicitly named subdirectory; it does not depend on a pattern download's single-artifact flattening behavior. If release orchestration fails after a tag exists, preserve that tag, commit a minimal workflow fix normally and require its main CI to pass. An authorized dispatch from the corrected workflow ref can then rebuild the existing tag with `dry_run=false`; application checkout, package provenance and tag-target checks still use that unchanged annotated tag. Report the workflow commit separately from the tagged application commit.

## Distribution boundary

Portable delivery contains authored application code, compiled source-only Viewer, required open-source runtime, corresponding source and licence notices. It excludes private tests/logs, user saves, workspaces, screenshots, original assets and complete game-derived datasets. Generated assets are built from the user's installation after launch.

Failure requires diagnosing the actual build/smoke/audit condition. Do not edit historical tags/releases or claim an unbuilt executable exists. Official binaries come solely from Actions' exact-tag source build. Local `output/distribution/` is disposable developer output. Package/smoke success removes it by default; Actions passes `--keep-artifacts` to retain its exact-tag ZIP for upload. QA uses `output/dev/current/` and is removed on success; necessary failure evidence is bounded under `output/dev/failed-smoke/` or `failed-package/`. Output is not a historical archive.
