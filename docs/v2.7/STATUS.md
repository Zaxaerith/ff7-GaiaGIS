# GaiaGIS v2.7 — Save Game Explorer & Distribution

Baseline: clean main/origin/main `0ad45d6d309b76abc2291f21c3cc9c9e04e2fea3`, verified 2026-10-07. Repository, source and this document are durable authority.

## Authorized scope

P0: publish missing historical code-only v2.5/v2.6 tags/releases and update source-only Pages to v2.6 if stale. P1: browser-local, session-only read-only FF7 PC/Steam 2013 multi-slot save inspection; spatial markers require verified coordinate evidence. P2: reproducible Windows x64 portable build, audit and smoke, explicit publication workflow.

v2.7 remains local main only: no push/tag/release/Pages until human acceptance. No v2.8, climate or frozen reconstruction change. All writes/caches/evidence stay inside the workspace. FF7 installation and user save directory are read-only. Private tests and samples stay untracked.

## Baseline evidence (before repair)

v2.5 public commit `eceeb41408657b274b372c3dda73afb06ab7ac62`: Web checks run 37453713948 succeeded. v2.6 commit `0ad45d6d309b76abc2291f21c3cc9c9e04e2fea3`: run 37467077680 succeeded. Remote releases/tags stop at v2.4.0; Pages last deployed v2.4 commit 79f9fe8. P0 verified missing historical releases, not missing binaries. No historical portable binaries will be claimed.

## Progress

P0 complete: annotated v2.5.0 and v2.6.0 tags point to their exact supplied,
CI-verified commits. Both code-only Releases are Published. Automatic source
archives were inspected. Pages now serves v2.6, run 37573186301 successful;
v2.4 and published history unchanged.

P1 complete: session-only browser File API reader, 15 independent PC slots,
CRC/header/bounds/empty handling, existing Data/Inspector/Atlas Save Context,
five locales, verified classic-PC WM0 packing through frozen Gaia mapping.
Fly/Explorer/Route require appropriate verified position/local datasets. Field,
native and unsupported bindings stay raw only. All provided real saves are
field saves; real world-module Steam runtime comparison remains unverified.
Story flags, acquired vehicles and Chocobo breeding/stable meanings remain
Unknown, not inferred from time or visibility masks.

P2 complete locally: onedir Windows EXE and compiled source-only Viewer,
stdlib private geometry transport, embedded runtime/licenses/source archive,
deep asset/bytecode audit, fresh-ZIP scrubbed-environment cold/warm smoke and
compiled browser checks. Manual Windows build workflow never publishes;
release.ps1 defaults local-only and requires explicit publication mode.
It covers CI → tag → Release ZIP/checksum → Pages → downloaded-package smoke.

Validation: Python 304; Web 833 / 5 optional skips; Browser 626 / 626; five
locales 894 keys each. Twelve game input and four save hashes unchanged.
Private tests remain untracked. See [validation](validation.md),
[save format](save-format.md), [spatial binding](save-spatial-binding.md) and
[distribution](distribution.md).

Local RC = YES, awaiting human acceptance. Isolation is a fresh extracted ZIP
and scrubbed process environment, not a fresh Windows VM. Interactive native
folder selection and a real world-module Steam save remain manual acceptance
items. No signing identity is claimed. Final commit/ZIP SHA256 are reported in
the local delivery receipt. Stop after the local main commit; do not publish
v2.7 or start v2.8.
