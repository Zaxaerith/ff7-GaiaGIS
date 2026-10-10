# Release process

## Responsibilities

- `ci.yml`: ordinary push/PR Web validation, public audit and isolated native package smoke on Windows x64 and macOS ARM64.
- `pages.yml`: explicitly dispatched source-only Viewer deployment.
- `release.yml`: approved annotated-tag native Windows/macOS packaging; dispatch defaults to artifact-only dry run.

Development completion does not grant publication permission. Obtain explicit user approval before remote main/tag/Release/Pages operations. Preserve existing tags/releases and published history; never force push or rebase published commits.

## Preflight and publication

1. Update **only** `src/gaiagis/_version.py` for the application version. Review current docs and concise CHANGELOG.
2. Verify clean intended commit, normal fast-forward baseline, non-climate regressions and public asset audit. Local package smoke verifies the recipe; do not use its ZIP as a Release upload.
3. After explicit publication approval, push the source commit normally and wait for real CI.
4. Create an annotated `vX.Y.Z` tag matching the authority at that exact successful commit, then push that approved tag.
5. Both native jobs check out the exact tag, validate annotation/version/commit/cleanliness, install pinned Python and Node tooling, run Web tests/build/release audit, freeze the portable executable/app, perform isolated code-only HTTP smoke and deep public audit, and create their own ZIP/SHA256. `macos-14` is the explicit ARM64 runner; the recipe also asserts the actual interpreter architecture and rejects Rosetta. Mac signatures are ad-hoc, not Developer ID/notarized.
6. Only after **both** jobs succeed, an assembly job verifies checksums, both manifests and the current annotated tag's commit, then creates one `SHA256SUMS.txt` covering `GaiaGIS-vX.Y.Z-windows-x64.zip` and `GaiaGIS-vX.Y.Z-macos-arm64.zip`. One publish job creates the new Release on an approved tag event or explicit non-dry-run dispatch. A failed platform prevents assembly/publication; existing Releases are never overwritten.
7. Separately approve/run source-only Pages and verify deployment/public fallback, Release download/checksum and exact tag target.

## Dry run

Manually dispatch `release.yml` with an existing recipe-containing annotated tag and **dry_run=true** to build/upload Actions artifacts without creating a Release. If the candidate has no tag yet, run the same recipe locally; this is equivalent recipe validation, not a remote workflow execution or official artifact.

The v3.3 local Windows implementation has not dispatched these workflows or built a Mac binary. Native Mac build/service/Tk, Finder/browser, downloaded Gatekeeper and target MacBook Neo acceptance must be recorded separately. A successful code-only Actions fixture cannot prove cold generation from actual private game inputs. See [native build and acceptance](building.md).

## Distribution boundary

Portable delivery contains authored application code, compiled source-only Viewer, required open-source runtime, corresponding source and licence notices. It excludes private tests/logs, user saves, workspaces, screenshots, original assets and complete game-derived datasets. Generated assets are built from the user's installation after launch.

Failure requires diagnosing the actual build/smoke/audit condition. Do not edit historical tags/releases or claim an unbuilt executable exists. Official binaries come solely from Actions' exact-tag source build. Local `output/distribution/` is disposable developer output. Package/smoke success removes it by default; Actions passes `--keep-artifacts` to retain its exact-tag ZIP for upload. QA uses `output/dev/current/` and is removed on success; necessary failure evidence is bounded under `output/dev/failed-smoke/` or `failed-package/`. Output is not a historical archive.
