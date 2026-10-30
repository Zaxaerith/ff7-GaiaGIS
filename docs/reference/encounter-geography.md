# Encounter Geography & Formation Evidence (v5.8)

Open **GIS Analysis → Encounter Geography & Formation Evidence**. This is a
read-only, session-local analysis of the current supported WM0 BASE source.
WM2/WM3, Field, synthetic caps and World Variants are outside this tool's scope.
Existing Workspaces need no new asset or schema.

## Query identities and scopes

- **Encounter Set** uses its original `region:slot` ID. The lookup uses the
  existing historical PC reference: Region 16/17 clamp to 15, Terrain 16→0 and
  24→8, first matching slot, otherwise slot 0. Aggregates retain original
  Region/Terrain IDs; they do not become encounter-table categories.
- **Formation ID** is the legacy Encounter record's `scene_id`, a Battle ID.
  It is **not** Battle Scene ID: `Formation = Scene × 4 + Slot`.
- **Enemy** requires both Scene ID and Enemy ID. Names do not establish spatial
  identity. Repeated enemy placements in a Formation do not multiply coverage.
- **All table references** ignores active/script/tracks gates. Set/all queries
  include zero-weight raw records, clearly separated from positive Enemy links.
  Formation/Enemy queries always use only verified positive-weight references.
- **Historical-rule static candidates** require active Set, `script=0`, positive
  record weight. Ordinary records include normal/back/side/both-side families;
  Chocobo is separate and additionally requires original MAP tracks.

Neither scope proves runtime accessibility or actual encounter selection. Raw
rate and record weight are evidence, not normalized encounter probabilities.
Chocobo Lure, character/model, save conditions and special-battle precedence are
not evaluated. Yuffie and scripted battles are not folded into ordinary coverage.

## Source validation

The existing Encounter owner hashes the actual loaded JSON bytes once. Reverse
links require its exact SHA-256 to match Gameplay's `links.assets` entry, along
with matching World archive and `enc_w.bin` identities. Shared source keys must
agree. Gameplay v1 need not repeat WM0: its Encounter asset digest pins that
file's WM0 source, independently checked against the current WM0Source.

Every positive record is matched exactly once by Set ID and byte offset, kind,
weight, Battle/Formation ID, source kind and matched status. Formation Scene/Slot
and composite Enemy identities must resolve. Missing, extra, duplicate or
conflicting associations reject the reverse index as a whole. The existing
Gameplay reader still verifies Field Context and public Atlas fingerprints.
Set queries remain available without Gameplay or when reverse links are rejected.

## Counts, masks and Inspector

Each selected source face contributes once, even when several Formations or
enemy instances reference it. Its horizontal area is `abs(det(raw X,raw Z))/2`
in raw², borrowed from the existing Source metrics. This is a sum of source
contributions, not unique ground coverage, km² or probability. Zero-area faces
remain in counts and original duplicate faces retain their separate contribution.
Region/Terrain/Set marginal tables use the selected union's total as denominator;
a zero-area denominator is not applicable.

The amber mask has independent state. Hide it or clear this tool without clearing
terrain/Region colouring, Service Area, Region Component, Routing or source
selection. It uses existing render-to-source mapping and projected surface colour
buffers, including projection comparison. No per-face Mesh or new geometry is
created. Region overlays can visually overlap it; their state is preserved.

Source faces and records are paged at most 50 at a time. Select a face to use the
existing Source Inspector and map focus; select a verified positive record or
open the query identity to view the existing Formation/Enemy card. Cards can
return to geography. This does not create a POI, reward marker or Journey target.
World source faces for POI triggers are not automatically random-encounter nodes.

The lookup index is initialized on demand and borrows current WM0Source metrics.
Sorting, grouping and paging do not rebuild geometry or the index. Workspace,
Encounter/Gameplay replacement and incompatible map/Explorer/Variant transitions
invalidate session results and remove this mask. Closing Inspector, collapsing
the tool or changing projection does not recompute or discard a valid result.
No new data is persisted in UserState, URLs, Tours or GaiaJSON. Journey solver
and its existing route-profile interpretation remain unchanged in this version.

Source-only releases retain public guides but cannot compute private coverage.
No research baseline is substituted for missing geometry.
