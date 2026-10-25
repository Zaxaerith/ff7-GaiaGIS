# GaiaGIS local development workflow

User preference recorded on 2026-10-03:

- Develop and test locally by default. Local commits are allowed.
- Do not automatically push after a conversation or completed task.
- Wait for the user's explicit request to update GitHub for a completed
  version before pushing, opening/merging a remote PR, publishing a tag
  or release, deploying Pages, or changing repository metadata.
- A development branch is a local working aid; it is not permission to
  publish. When publication is explicitly requested, preserve history
  and use the agreed checks and merge workflow to update main.
- This preference supersedes the earlier instruction to publish the
  v1.1 development branch automatically. The already merged v1.1 work
  and published v1.0.0 release/tag are preserved.

All project writes, caches, profiles and outputs stay in this workspace.
FF7 installations are read-only binary/data inputs. Never modify them,
execute/import scripts from them, or include proprietary assets or
complete locally generated geometry/POI coordinate datasets in Git.
Generated data and private screenshots remain ignored. Public delivery
is code-only unless the user separately changes the distribution policy.

V1 reconstruction mathematics and climate research remain frozen unless
the user explicitly requests a new scope. Do not start an unsolicited
next version, climate simulation or reconstruction change.

## Permanent Web-first development workflow

GaiaGIS's primary product is the Web Viewer. Routine feature work and acceptance
start in `web/`: use Vite, the Web test suite and Browser E2E. Reuse
`output/dev/current/stability-tests/` for Browser acceptance output. Do not add
version-named local release directories; use the shared QA paths documented in
`docs/development/workspace-hygiene.md`.

Generate or update the private Workspace only when a task needs it, and prefer
the relevant incremental command over rebuilding all data. Preserve the
Workspace, recovery pairs and research results.

Do not build a local PyInstaller executable or Windows RC ZIP by default. GitHub
CI owns ordinary Windows build and smoke checks. The GitHub Release Workflow
builds the official Windows ZIP from its approved tag. Pages is a separate Web
publishing target. Use local packaging only to diagnose a launcher or packaging
failure, or when the user specifically requests a local package. After a formal
release, remove obsolete local candidate ZIPs and extracted package copies while
keeping unique source evidence and research reports.

Development and local commits do not authorize publication. Push, tag, Release,
Pages deployment and repository metadata changes still require the user's
explicit authorization.
