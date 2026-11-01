# Field Dialogue Geography & Conditional Evidence

## Generate and load

The new optional private resource is `gaia-field-dialogue.bin`. It requires the
verified original EN PC Field archive, its exact maplist and an already generated
matching Field Context. Source discovery uses the existing installation layout;
the game directory is read-only. From a configured project Python environment:

```powershell
python -B -m gaiagis.field_dialogue --source "YOUR_FF7_INSTALLATION" --workspace output/local-workspace
# Optional private preview, referenced valid text only:
python -B -m gaiagis.field_dialogue --source "YOUR_FF7_INSTALLATION" --workspace output/local-workspace --with-text
```

Without `--with-text` this generates A, metadata-only; with it, B uses the same
versioned container and includes only verified text referenced by reachable
MESSAGE/ASK. Both modes have identical source queries. Existing Workspace assets
are retained; only Dialogue and its Manifest entry change. The prior Manifest
and, if present, prior Dialogue file are retained in the Workspace recovery
folder. Ordinary supported EN incremental Workspace builds can generate A;
other game-language archives do not acquire EN dialogue support.

Import the updated Workspace folder or use the existing local loopback server.
An old Workspace remains usable in the new Viewer with Dialogue marked missing.
The old v5.10 Viewer rejects a new Manifest containing this asset type. Restore
the saved old inventory to use that Viewer; do not describe this as transparent
backward compatibility. No Context/Walkmesh/Script Evidence/Gameplay revision or
format was changed. [Container and budgets](workspace-format.md).

## Query and evidence levels

Within the existing Field evidence fold, select Dialogue references or browse
Field Text IDs. Filters include Actor, original Slot, Entry, table/main, opcode,
offset and Text ID. Paging is at most 50 items. Selecting a reference opens the
shared Inspector, then its Text ID can reverse-query all original references.
Multiple references and original Entry aliases are retained. Decoded but
Entry-unreachable instructions are explicitly ownerless, not attributed to an
Actor. Unreferenced text means absent from this reachable MESSAGE/ASK index,
not proof that the original game never uses it.

1. **Direct source reference:** MESSAGE/ASK operands → original Text ID.
2. **Script membership:** exact Actor/raw Slot/table-or-main/Entry/offset.
3. **Explicit request:** REQ/REQSW/REQEW → exact target Actor/raw Slot/table
   Entry, with priority and target Entry's statically reachable dialogue. PREQ
   family is not reinterpreted as an Actor request. Scheduling is unknown.
4. **Spatial candidate:** same Actor/Entry Interaction and Gameplay records,
   each retaining its own identity and Section sources. No causal trigger claim.

Selecting a related exact-contact Interaction reuses the existing Canvas,
contact list, Entrance/Arrival validator and directed Walkmesh path evidence.
All contact triangles and original Access slots/offsets remain visible.
XY-only, disjoint and variable endpoints do not become paths. A line has its
own geometry; a dialogue receives no NPC point, marker or inferred coordinate.
Existing Atlas/Gameplay actions remain under their original source owners.

## Private symbolic text

Text IDs and pointers are bounded by the PC text table and first extra/AKAO
boundary. The reader requires a real terminator outside control parameters.
Partial controls, unknown controls, out-of-range pointers and unterminated text
remain unavailable; they never scan into extra data to find a later terminator.
A few scenes have no usable text table; this does not label the entire Field
file corrupt. Known `mds7pb_2 /155 · Text49` remains unavailable.

Previews are folded, EN-labelled and inserted using DOM `textContent`. UI locale
is independent of source game language. Supported Western glyphs are shown;
unknown glyphs have visible placeholders. Newline/page, names/party, colours,
buttons, WAIT, NUM/HEX and memory-string controls are symbolic tokens. Dynamic
values, player answers, names, timing and window state are never evaluated or
translated into claimed official game text. Missing B bodies do not disable A.

The asset and text stay in the ignored private Workspace and current Field
session. They never enter UserState, URL, shares, bookmarks, source-only dist,
public fixtures, documentation or reports. Synthetic tests contain authored
text only. No external implementation or game-derived text was copied into
product source. The reference-format research is documented separately in the
private feasibility report; the new decoder is an independent implementation.

## Limited conditional evidence

ASK exposes original choice-line range and answer-write bank/address. Selected
IFUB/IFUBL/IFSW/IFSWL/IFUW/IFUWL expose raw byte/signed-word/unsigned-word operands,
banks, operators and the existing CFG successors. Adjacent ASK/IF may be labelled
as reading the same exact write address/width in a shared Entry. No answer or
condition truth is inferred.

An explicit bounded check can show a selected record's complete-Entry control
witness: the IF dominates that record and exactly one successor can reach it in
the existing graph. It is not whole-game dataflow, runtime execution, branch
truth or generalization of research samples. Partial CFGs refuse this proof;
work/alias limits are shown. CMUSC remains unsupported by the unchanged production
reader. Its later recovery is a separate parser/asset migration task.

## Lifetime

Encoded asset/source validation occurs on adoption. The Field owner decodes and
retains the current scene only. Search and paging do not scan the archive or all
Fields. Context/archive/member/Section identities and Workspace generation gate
associations; resource replacement and scene exit invalidate tickets and remove
old private Inspector content. Closing Inspector and panning keep the current
valid scene and results. Failed optional data leaves other Field channels usable.
