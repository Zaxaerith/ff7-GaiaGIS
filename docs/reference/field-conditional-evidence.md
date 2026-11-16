# Field conditional evidence

Conditional evidence is a **read-only, scene-local static analysis** of an
already loaded, source-authenticated Field CFG. It is not a game interpreter,
quest solver, reachability oracle, or a new geometry product. It never decides
whether an IF is true, whether a player can obtain a reward, or whether a
requested script will run.

The production implementation is
[the conditional analyzer](../../web/src/analysis/fieldConditionalEvidence.ts).
Its inputs come from the existing
[Field event evidence adapter](../../web/src/analysis/fieldEventEvidence.ts),
[Dialogue reader](../../web/src/data/fieldDialogue.ts), and
[Gameplay reader](../../web/src/data/gameplay.ts). An optional
[local verification script](../../web/scripts/check-conditional-evidence.mjs)
compares the production TypeScript results with a private, frozen research CSV.
No original script text, dialogue body, or coordinate collection is distributed
with this reference or with the verifier.

## Identity and fail-closed scope

The analysis revision is `field-conditional-1`. It requires the recovered
`field-cfg-en-cmusc8-1` identity, Context v6 and a coherent source-bound
Dialogue/Gameplay group. Archive and maplist fingerprints, the exact Context
hash, Field/member/Section identities, generation and raw owners must agree.
The analyzer rechecks CFG boundaries, successor membership, reachability,
record correspondence and owner accounting. Scene data is not trusted merely
because it is already in memory. Related Interaction and Script Evidence, when
present, must agree with the same scene identity. A supplied Walkmesh is checked
against the Dialogue Section 5 identity; it cannot add conditional evidence.

The three public entry points are:

`analyzeFieldConditionalEvidence(input: FieldEventInput, options?: ConditionalOptions): ConditionalResult`

`toFieldConditionalInput(input: FieldEventInput): FieldConditionalInput`

`analyzeFieldConditionalSnapshot(snapshot: FieldConditionalInput, options?: ConditionalOptions): ConditionalResult`

The projection is the worker boundary: it excludes the dialogue text table,
Walkmesh coordinates and the global Gameplay index. It carries only the selected
scene data needed for analysis. The synchronous wrapper and the worker use the
same snapshot algorithm, not independently maintained proofs.

A result has an explicit status (`complete`, `unavailable`, `limited` or
`cancelled`), a completeness flag, source identity, rejected-root information,
controls, ASK candidates/local relations, one-hop requests and statistics.
“Complete” means the bounded static procedure finished, **not** that every raw
Entry was accepted or that the game can reach every result. A limit or
cancellation must not be promoted into an exact whole-scene claim.

## Raw Entry roots, aliases and the accepted DAG

A raw Entry root is a distinct script entry **offset**, not an Actor, table slot,
or alias. Several `(Actor, kind, slot, Entry)` aliases may identify the same
root. They remain available as provenance, but the CFG is analyzed once per raw
root. Conversely, events reachable from more than one distinct root retain all
those roots; their ownership is not narrowed to the selected UI alias.

For each raw root, follow all CFG successors. Accept it only when its reachable
subgraph is complete, has verified boundaries and targets, has only known
terminal leaves, and is acyclic. RET, RETTO, MAPJUMP and GAMEOVER are terminal
exits; MAPJUMP is not a recursively followed inter-Field edge. An explicit exit
sentinel joins the terminal paths for postdominance.

**Every cycle is excluded**, including a cycle with a possible exit. An SCC with
an exit is not converted to a DAG, a bounded-unroll proof, or a “probably exits”
claim. Unsupported/unverified nodes and unknown leaves also prevent acceptance.
Exclusions are disclosed; the accepted roots are not a claim that rejected ones
have no conditional behavior.

Current default per-scene safety budgets are:

- 8,192 reachable nodes per raw root;
- 8,000,000 accumulated raw-root visits;
- 32 MiB accounted bitset storage;
- 100,000 accounted output records and references (roots, controls, ASK
  corridors and request targets);
- 100,000,000 accounted operations.

Callers can lower these limits, not use the options to remove the bounds.
Cancellation is separate from a budget limit. The worker can be terminated when
a scene/source generation changes; a stale response must not replace the new
scene's evidence.

## Standard, strong and scene-core controls

For an accepted rooted DAG, let `Dom(t)` be the nodes dominating `t`, and
`Pdom(x)` the nodes postdominating `x` with respect to the explicit exit.
Consider an IF at `i`, one of its **two distinct valid successors** `s`, and
a supported event at `t`.

A **standard** relation holds exactly when:

`t ∈ Pdom(s) && t ∉ Pdom(i) && t != i`

A **strong** relation is standard control with the additional condition:

`i ∈ Dom(t)`

This is a graph statement, not an evaluation of the IF operands. The successor
is identified by its CFG offset, never called a universally true/false branch.
An IF with collapsed successors does not qualify as a two-successor control.
When the decoder coalesces coincident edges at the verified fallthrough, the
containing root can still qualify and support proofs for other IF instructions.
Rejoining paths, multiple exits and bypasses are handled by the complete DAG,
not by finding one path from a branch to an event.

A **scene-core** relation must be the same `(IF, successor, event)` strong
relation under **every raw Entry root that owns the event**. An owning root that
is cyclic, unknown, excluded, or lacks that strong relation prevents promotion
to core. Selecting a favorable alias cannot erase a bypassing owner. Standard
and strong relation statistics retain root-specific rows. Core relation counts
deduplicate `(IF, successor, event)` across those rows; unique core event counts
deduplicate event offsets. The two core counts may differ in other datasets.

Supported event kinds are MESSAGE, ASK, STITM, SMTRA, BATTLE, REQ, REQSW and REQEW.
Being a core event does not add a position, a player action, reward availability,
or an executed-once guarantee.

## ASK: raw-address-local, not a reaching definition

ASK links are deliberately narrower than answer or flag tracing. A candidate
starts with an ASK answer destination and an IF read with the same raw
`(bank, address)`; a local relation also requires a matching byte width,
accepted acyclic root, ASK-to-IF reachability, ASK dominance, and the complete
interior corridor of **all** ASK-to-IF paths to have no modeled clobber.

The corridor is a graph corridor, not the numeric offset interval between the
two instructions. Side branches, backedges, bypasses, and multiple raw owners
cannot be hidden by the order of the byte offsets. SETBYTE, BITON and BITOFF keep
their raw bank/address operands. SETWORD and non-whitelisted effects are
conservative unknowns; the checker must not infer safety from missing modeling.

ASK writes one byte. IF word reads are two bytes, even if the numeric addresses
match. Bank 0 denotes a literal IF operand rather than a variable read. Banks
that might alias physical memory are **not** normalized without an independently
verified addressing model. A local label therefore means only
“same raw address, no intervening modeled write in this static corridor.” It is
not a proof of the physical reaching definition, the player's selected answer,
a persistent flag, or an answer's logical consequence.

Rejected candidates retain a reason category. A candidate, a local relation and
a core-controlled ASK event are different concepts and have different counts.

## REQ: explicit single-hop provenance only

REQ, REQSW and REQEW retain the original source event offset, source owners,
opcode, raw priority, target Actor and table slot. A target is resolved only
when that original `(Actor, table slot)` selects a unique table Entry identity.
Main-entry aliases and incidental shared offsets do not create an alternate
resolver. Missing or ambiguous targets stay explicit.

The result lists the direct target's reachable supported events as **one-hop
references**. It neither recursively expands another REQ nor transfers the
source IF guard onto the target script. An event pair is not a call stack,
scheduler trace, or proof that the request executes. Blocking, yielding,
priorities and cross-Actor timing are not interpreted. PREQ is outside this
relation family. Counts for core-controlled requests refer to the original
source requests, not to newly synthesized target events.

## GIS: retain the original level of evidence

Conditional relations never produce event coordinates. A core event may have
an existing same-Actor association to an Interaction LINE. That line's surface
contact, XY-only relationship, candidate triangles and original coordinate
precision remain properties of the **line**, not of the event or reward.

A same-Actor association is not a same-Entry owner match. Surface contact is not
an enabled trigger; XY overlap is not a ground height. The strict research
baseline found 1,516 core events with a same-Actor LINE association: 1,335 with a
surface-associated line and 181 with only XY association. It found **zero exact
owner matches and zero proven event positions**. Those are contextual aggregate
counts, not a coordinate dataset, and must not be described as 1,516 localized
conditional events.

## Legacy coexistence

The older `dialogueGuards` helper remains an explicitly legacy approximation:
it checks dominance and asymmetric reachability from the two IF successors,
not the complete DAG postdominance condition. Its result is neither an alias
for scene-core evidence nor guaranteed to be a subset or superset of strong
control. On the reviewed accepted-DAG comparison there were 11,457 common
relations, 172 strong-only and 17,217 legacy-only relations. This is a semantic
difference, not a reason to silently relabel old results.

Legacy-stop assets remain readable by their existing views. They are not
silently upgraded into this recovered-CFG analysis. See
[Field Script Recovery and CFG provenance](field-script-recovery.md) and
[Field dialogue evidence](field-dialogue.md) for those compatibility and privacy
boundaries.

## Optional local verifier

Run from the repository root after installing the existing Web dependencies.
The small mode is the normal implementation/performance check:

`node web/scripts/check-conditional-evidence.mjs --fields 345,493`

The full mode is explicit and is intended to be coordinated as **one**
acceptance census, not run independently by every contributor:

`node web/scripts/check-conditional-evidence.mjs --all`

No arguments means no scan. The small mode accepts at most 16 distinct available
Field IDs and reports only those scenes; it must never be labelled a 702-Field
pass. The complete frozen CSV is still loaded for its row identities and the
selected scene comparisons. Unknown options, missing files, corrupt data,
incomplete analyses and mismatches return a nonzero exit status. Error reports
contain an allowlisted stage/code and, where applicable, a numeric Field ID;
they never echo input-derived error messages, stacks, original script bytes or
dialogue text.

The verifier reads only the fixed existing `output/local-workspace` inputs:
Manifest, Context, Dialogue, Gameplay, Interaction, Script Evidence and Walkmesh.
It checks each relevant Manifest SHA-256/byte count and rehashes **all seven**
files after analysis, including the handled-error path for every input read so
far. It also verifies the research CSV, authored Atlas and imported public
sources did not change during the run. It does not discover
installation paths, scan an installation, use recovery copies, build a
Workspace, change a Manifest or write into the Workspace.

Production TypeScript modules are transpiled with the installed TypeScript
package into a unique, ignored temporary directory under
`output/dev/current/conditional-evidence`. Older packages may expose
`transpileModule`; TypeScript 7 uses its installed native CLI against isolated
temporary `.cts` copies with `noResolve` and `noCheck`, explicit standard
libraries, and a per-file temporary configuration. This is transpilation, not a
project typecheck or Workspace rebuild: it does not consume the project's build
configuration or follow arbitrary imports. Only the allowlisted production
runtime graph and public boss-evidence JSON are loaded. Compiler diagnostics
are captured; only numeric diagnostic codes can appear in an error report.

The same exported production analyzer is called once per selected scene. This
is not a duplicate JavaScript or Python implementation of the analysis.
Temporary modules are removed on success and on handled failure. Only numeric
summaries, source fingerprints, completeness information and measurement labels
are kept in the ignored report. An interrupted process may leave its private
temporary directory for cleanup.

The frozen acceptance baseline has 702 available Fields and requires:

- 21,474 IF instructions, including unreachable ones; 21,295 reachable IFs with
  two distinct valid successors;
- 54,545 accepted raw roots out of 58,603, with 5,152 accepted roots containing a
  qualifying IF;
- 11,621 scene-core event relations and 11,621 unique core events in 532 Fields;
- 4,976 ASK raw-address candidates, all byte-width matches in this baseline,
  and 771 accepted raw-address-local pairs;
- 19,944 original reachable requests, all uniquely resolved; 13,692 distinct
  target identities (2,413 with multiple original request sources) and 23,970
  one-hop request/event pairs;
- 6,361 core-controlled source requests and 9,281 event pairs from those sources.

Per-Field CSV checks include nodes, edges, distinct roots, maximum root nodes,
root visits, accepted/cyclic roots, all six IF opcode counts, core relations and
unique core events. Aggregate checks are enforced only by `--all`. The
baseline numbers are **expectations**, not a claim that a run was performed or
passed. The report records actual measurements and every numerical mismatch.

### Performance labels and limitations

`decodeMs` covers the actual production Dialogue, Interaction, Script
Evidence and Walkmesh decoding for that scene. `analyzeMs` is wall-clock time
around the production synchronous TypeScript analyzer, including its snapshot
projection, source checks and analysis. Preparation/transpilation/opening is
reported separately, not hidden in either figure. There is no warm-up run and
no extrapolated 702-Field time.

`peakBitsetAccountedBytes` is the engine's maximum simultaneously accounted
typed Dom + Pdom + Reach storage for one raw Entry. It is **not** measured heap,
RSS or total working-set peak. Per-scene `memoryNetDeltaBytes` reports signed
before/after differences for process RSS, V8 heap used, external storage and
ArrayBuffers around the analysis call. Those differences include allocation,
retained results and garbage-collector noise; negative values are possible.
No forced GC or sampled process-peak claim is made. CSV Python timing and
tracemalloc columns are not compared with these Node measurements.

The report identifies the exact Node/TypeScript versions and explicitly says
`node-production-typescript-not-browser`. It does **not** measure worker
startup, structured cloning, browser heap, UI rendering, cancellation latency,
or main-thread responsiveness. Real browser acceptance must separately exercise
the Web UI worker on the loaded Workspace and verify stale-result/cancellation
behavior. A standalone Node timing is never a browser performance result.
