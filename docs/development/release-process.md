# Release process

## Normal development and delivery

GaiaGIS's primary product is the Web Viewer. Use Vite, Web tests and Browser E2E
for daily work. Private Workspace data is generated only when needed and updated
incrementally. Reuse `output/dev/current/stability-tests/`; do not create
version-named local package trees.

GitHub CI owns normal Windows build and smoke validation. Do not run local
PyInstaller or make Windows RC ZIPs as a routine development step. The Release
Workflow builds the official Windows ZIP from an explicitly approved tag. Pages
is a separate Web release target. Run the local packaging recipe only for a
focused launcher/packaging diagnosis or at the user's request.

After a formal release, remove its obsolete local candidate ZIPs and extracted
package copies. Keep unique source evidence and research reports. Publication
still requires the user's explicit approval, as described below.

## Responsibilities

- `ci.yml`: ordinary push/PR Web validation, public audit and isolated native package smoke on Windows x64.
- `pages.yml`: explicitly dispatched source-only Viewer deployment.
- `release.yml`: approved annotated-tag Windows x64 packaging; dispatch defaults to artifact-only dry run.

Development completion does not grant publication permission. Obtain explicit user approval before remote main/tag/Release/Pages operations. Preserve existing tags/releases and published history; never force push or rebase published commits.

## Preflight and publication

1. Update **only** `src/gaiagis/_version.py` for the application version. Review current docs and concise CHANGELOG.
2. Verify clean intended commit, normal fast-forward baseline, non-climate regressions and public asset audit through GitHub CI. CI performs the ordinary Windows smoke; only the approved-tag Release Workflow produces the official ZIP. Local packaging is reserved for the focused exception above.
3. After explicit publication approval, push the source commit normally and wait for real CI.
4. Create an annotated `vX.Y.Z` tag matching the authority at that exact successful commit, then push that approved tag.
5. The Windows x64 job checks out the exact tag, verifies annotation/version/commit/cleanliness and runtime architecture, runs Web tests/build/audit, freezes the portable app, runs isolated HTTP smoke and deep public audit, then creates its ZIP/SHA256.
6. After that job succeeds, assembly verifies the single Windows ZIP, manifest provenance and current annotated tag target. `SHA256SUMS.txt` covers only `GaiaGIS-vX.Y.Z-windows-x64.zip`. The publish job checks out the exact requested tag so its curated `docs/releases/vX.Y.Z.md` is available, and fails before publication if that file is missing. It creates a new Release only on an approved tag event or explicit non-dry-run dispatch. Build failure prevents publication; existing Releases are never overwritten. macOS is no longer built or published.
7. Separately approve/run source-only Pages and verify deployment/public fallback, Release download/checksum and exact tag target.

## Dry run

Manually dispatch `release.yml` with an existing recipe-containing annotated tag and **dry_run=true** to build/upload Actions artifacts without creating a Release. A local recipe build is not a routine prerequisite; use it only for a focused packaging investigation or when requested.

Local validation and workflow execution are separate. Historical macOS code is unmaintained and is not a prerequisite for Windows publication. A code-only smoke cannot establish original-game background alignment. Automated PyQGIS save/reopen is separate from human desktop acceptance. Preserve existing published tags.

Local recipe simulations do not create real tags or prove cloud success. Tag checks, workflow Python syntax and checksum/provenance guards can be exercised with synthetic packages and mocked Git/GitHub responses; report them separately from actual Actions and public Release verification.

Single-platform assembly downloads the explicitly named `release-windows-x64` artifact into its explicitly named subdirectory; it does not depend on a pattern download's single-artifact flattening behavior. If release orchestration fails after a tag exists, preserve that tag, commit a minimal workflow fix normally and require its main CI to pass. An authorized dispatch from the corrected workflow ref can then rebuild the existing tag with `dry_run=false`; application checkout, package provenance and tag-target checks still use that unchanged annotated tag. Report the workflow commit separately from the tagged application commit.

## Distribution boundary

Portable delivery contains authored application code, compiled source-only Viewer, required open-source runtime, corresponding source and licence notices. It excludes private tests/logs, user saves, workspaces, screenshots, original assets and complete game-derived datasets. Generated assets are built from the user's installation after launch.

Failure requires diagnosing the actual build/smoke/audit condition. Do not edit historical tags/releases or claim an unbuilt executable exists. Official binaries come solely from Actions' exact-tag source build. A package/smoke run removes only its own generated artifacts on the default success path; preserve an explicitly retained local candidate and unrelated output. Actions passes `--keep-artifacts` to retain its exact-tag ZIP for upload. QA uses `output/dev/current/`; remove task-owned temporary output on success. Preserve the active unpublished RC and unique research evidence; remove obsolete candidates and disposable QA output after acceptance. Do not create per-version output trees for new work. Output remains a development workspace rather than a general historical archive; see [workspace hygiene](workspace-hygiene.md) for retention and migration rules.
