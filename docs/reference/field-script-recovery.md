# Field Script Recovery and CFG provenance (v5.12)

This release recovers static PC Field script boundaries. It does not validate
execution in the original game, music playback, story conditions or new spatial
positions. All dialogue, gameplay and interaction precision rules remain intact.

## Two explicit decoding identities

`legacy-stop` preserves the previous CMUSC stop. Context v1–v5 and evidence v1
remain readable with that meaning; importing them never silently recovers code.

`field-cfg-en-cmusc8-1` advances CMUSC by eight bytes. It is selected only when
the complete original EN Field archive **and** maplist match the pinned SHA-256
values in `field_provenance.py`. A language label, filename, matching fragment or
plausible successor cannot select it. Other languages and modified sources keep
the legacy profile. The old six-byte table entry is not a compatibility mode:
zero-valued parameters can masquerade as RET instructions.

New Context v6 records `scriptDecoder` and uses `field-context-9`. New
Interaction, Script Evidence, Gameplay and Dialogue use transport/JSON v2 and
their respective `*-2` generators. They bind the same decoder, exact Context
SHA, archive/maplist and original Field/Section identities. Interaction v2 adds
the previously absent Context SHA. A matching Section SHA alone cannot authorize
a relationship between different CFG generations.

Walkmesh remains v1 / `field-walkmesh-1`. Older Manifest entries labelled
`field-context-6/7/8` for that same geometry are still accepted. Visual and other
GIS products do not consume script CFG revisions. No geometry is rebuilt.

## Controlled local migration

Stop every local server or external application reading this Workspace first.
Use the existing original EN source, keeping its files read-only:

```powershell
python -m gaiagis field-recovery --source YOUR_FF7_PC_DATA --workspace output/local-workspace
```

This bounded migration authenticates the old inventory, reads only the 24
affected original members, retains the other 678 compressed scene chunks, and
updates Context, Interaction, Script Evidence, Gameplay, optional Dialogue and
Manifest. It retains existing Battle/Kernel/World/Atlas evidence. A with-text
Dialogue remains with-text; metadata-only remains metadata-only. If Dialogue was
absent it stays absent. No original text is printed by the command.

For separate validation before installation:

```powershell
python -m gaiagis field-recovery --source YOUR_FF7_PC_DATA --workspace output/local-workspace --stage-only
python -m gaiagis field-recovery --workspace output/local-workspace --apply-staged
```

The candidate stays private under `.build/field-cfg-candidate/`. A second staging
request refuses an existing candidate. Keep it only for validation, then remove
that candidate directory after a successful commit. Normal incremental builds
also use the controlled recovery path for an eligible existing legacy EN group.

The server and migrator share an exclusive OS lease. Backups contain **only the
changed files and old Manifest**, under `.build/recovery/field-cfg/<transaction>/`.
Each individual replacement uses a same-volume atomic rename; Manifest is last.
The journal is `.build/field-cfg-transaction.json`. Exceptions restore the old
group. Startup recovers interrupted commits before opening a server or starting
an incremental build: an authenticated complete new group is retained, otherwise
the authenticated old group is restored. Recovery is idempotent. Unrecognized
external changes or damaged backups stop recovery rather than overwrite them.

```powershell
python -m gaiagis field-recovery --workspace output/local-workspace --recover
python -m gaiagis field-recovery --workspace output/local-workspace --rollback TRANSACTION_ID
```

Rollback also requires readers to stop and refuses externally modified files.
Retain the recovery directory until acceptance. A persistent disk/write failure
may prevent immediate rollback; the journal remains and the server refuses to
serve until recovery succeeds. This is a short-offline protocol, **not** a
multi-file filesystem transaction or an atomic upgrade for arbitrary concurrent
readers that ignore the lease. No copy of Visual or the complete Workspace is
made.

## Reader and session behavior

- New Viewer + old Workspace: accepted with original legacy diagnostics, including
  optional Dialogue absence.
- New Viewer + coherent v6/v2 group: accepted with recovered evidence.
- Mixed profiles, Context SHA or archive identity: reject the corresponding group
  before adopting replacement geometry. The previously loaded Viewer survives.
- Old v5.11 Viewer + new Manifest: explicitly incompatible; restore the matching
  old group and old Manifest, or use the new Viewer.

Scene decoding remains lazy. Resource owners retain existing query tickets,
generation checks and disposal behavior. Private dialogue bodies never enter
UserState, URLs, public fixtures or source-only Web output. Use the existing Field
event evidence Inspector to inspect recovered references and decoder provenance.
Complete static CFG does not prove a dialogue plays or a reward is obtainable.
