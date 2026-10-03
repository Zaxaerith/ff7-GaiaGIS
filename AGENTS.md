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
