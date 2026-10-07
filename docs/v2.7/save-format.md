# Read-only FF7 PC save format

GaiaGIS accepts the classic PC container used by Steam 2013: exactly **65,109
bytes**, nine header bytes followed by **15 slots of 4,340 bytes**. The first
four header bytes are `71 73 27 06`. The remaining header bytes are not treated
as an edition signature. A compatible file cannot prove which executable last
wrote it. PSX/card wrappers, other sizes and signatures are rejected; Steam 2026
runtime equivalence remains NOT VERIFIED.

The independent reader is `web/src/data/save.ts`. File API reads are explicit,
browser-local and read-only. Parsed summaries live in one session owner; raw
bytes, filename and private path are not persisted. Reload or Clear forgets the
save. Failed replacement is atomic; a late import cannot undo Clear. No save is
uploaded, repaired, exported or written back, and no Steam Cloud files are used.

## Evidence

Cross-checks use the [Qhimm savemap](https://wiki.ffrtt.ru/index.php/FF7/Savemap),
[ff7tk](https://github.com/sithlord48/ff7tk/tree/cb876ba93f384b3a90a06ece216ccd1a160fbbcf)
(`FF7Save.cpp`, `FF7Save_Types.h`, `FF7SaveInfo.*`, `Type_FF7CHAR.h`), and the
[classic-PC world-map reference](https://github.com/ergonomy-joe/ff7-worldmap/tree/bc7576e68b118e776ccefecfbc982a702a7f9e0f).
These are consulted format/behavior sources, not incorporated implementations.
No wiki article, reference cache or decompiled source is distributed.

All offsets below are relative to a slot, little-endian. CRC-16 starts at
`FFFF`, uses polynomial `1021` over bytes 4–4339, and ends with XOR `FFFF`.
The low word at 0 stores the result; the upper word must be zero. This checksum
detects corruption; it does not authenticate a save. A wholly zero slot or a
zero body with checksum `4D1D` is empty; a CRC collision alone is not emptiness.

| Field | Offset / shape | Interpretation |
|---|---|---|
| Location preview | `0028`, 32 bytes | Terminated Western printable FF text only; unsupported glyphs Unknown |
| Character records | `0054 + 132 × ID` | Ordinary IDs 0–8; level +1, HP +2C, MP +30, max HP +38, max MP +3A |
| Current party | `04F8`, three bytes | FF means unused; out-of-range character records are not read |
| Gil | `0B7C`, uint32 | Authoritative value rather than preview copy |
| Play time | `0B80`, uint32 | Elapsed seconds; never used to infer story |
| Module / location | `0B94` / `0B96`, uint16 | Field module 1, world module 3; unknown module unavailable |
| Progress counter | `0BA4`, uint16 | Raw counter, no inferred chapter or availability |
| Recorded visibility masks | `0C22` / `0C23`, byte | Chocobo / vehicle world visibility, **not ownership/unlock flags** |
| Disc | `0EA4`, byte | Only 1–3 recognized |
| World objects | `0F5C`, six eight-byte records | Packed positions; see spatial binding document |
| Current model / map | `0FA1` / `0FA2`, byte | Cross-checked against world save/load code |

Invalid checksum, upper checksum word, unsupported module or impossible bounded
party data makes the slot unavailable. Other slots remain independently usable.
No unknown byte is assigned a story or vehicle meaning. Acquired vehicles,
breeding/stable Chocobo status, story flag-to-Atlas relations and runtime
availability remain Unknown/Unverified. The raw masks are labeled accordingly.

## Private real-save observations

Four owner-provided files were read, not copied into public fixtures. All four
match the supported header/length. Ten populated slots have valid CRCs; fifty
are empty. All ten populated slots are field-module saves. Browser import was
exercised on private samples; their checksums and source hashes are recorded only
under ignored local evidence. Synthetic public Web fixtures cover world slots,
malformed containers, empty slots, CRC mismatches, bounds and unsupported cases.
