# Multilingual game sources

GaiaGIS v5.2 selects **game data language** independently of its EN/简中/繁中/日本語/한국어 UI. Select it explicitly in the Local Launcher, or use `--game-language en|fr|de|es` with `local`, `build-workspace`, `validate`, or the Field pack generation commands. Omitting it retains English defaults; a remembered launcher selection is shown in the chooser.

| Data language | World archive | Field archive |
|---|---|---|
| EN | world_us.lgp | flevel.lgp |
| FR | world_fr.lgp | fflevel.lgp |
| DE | world_gm.lgp | gflevel.lgp |
| ES | world_sp.lgp | sflevel.lgp |

The pair must exist in the selected installation. GaiaGIS neither renames nor modifies game files. Four coexisting pairs are not an automatic language detector. MAP/BOT files remain the actual shared files in `data/wm`; the verified Steam 2026 installation has one physical set. Classic/extracted directory discovery remains supported, but other editions require their own source checks.

For separate outputs, for example:

```powershell
python -m gaiagis build-workspace --source "YOUR_FF7_FOLDER" --game-language fr --output output/workspace-fr
python -m gaiagis local --source "YOUR_FF7_FOLDER" --game-language fr --workspace output/workspace-fr
```

The Data panel identifies the active archive pair; diagnostics retain content fingerprints without private installation paths. Changing game language does not translate the UI. Source builders use one resolved pair throughout. Manifest `sources` retains actual archive keys and SHA-256 values; member keys such as `wm0.ev`, `field.tbl` and `maplist` identify content from that selected pair. `KNOWN` remains the English reference table. A foreign archive hash is never assigned to an English key.

Cache dependencies distinguish World and Field roles by basename **and** content hash, including when a previous language lacks an English filename key. Pure MAP geometry/routing can be reused for identical MAP hashes. Events, textures, POI, Field and Explorer products obey their actual archive dependencies. Browser imports reject conflicting roles across different filenames as well as conflicting hashes under the same name.

Field Context v4 adds actual paired archive identity to the existing v3 fields. V5 adds bounded Section-1 recovery diagnostics; geometry pools and coordinates are unchanged. The viewer still reads Context v1–v4 and Manifest v1. Multilingual Field subpacks use their actual Field source key plus `maplist`; every subpack must match its Context. Old readers may reject new packs rather than misidentify them as English.

## Evidence levels and limits

- **L1:** four actual Steam 2026 archive pairs have been identified.
- **L2:** shared WM0/WM2/WM3 geometry, World resources and actual language Workspace generation are supported. Six focused Field samples are `mds5_1`, `church`, `elm`, `ghotin_4`, `las0_5`, `bugin1c`.
- **Limited L3:** the verified source set has identical `maplist`/`field.tbl` and 48 WM0 ENTER_FIELD relationships. Scripts are parsed from the selected language: FR World offsets and FR/DE `church` Field offsets differ. Evidence retains each source SHA and its own offsets. Neither matching names nor nearby geometry supplies a missing relationship.

These levels describe individual data/evidence capabilities, not full-game multilingual or original-runtime equivalence. Full Field L3 coverage, `.nx`/`.xone` override selection and other editions/languages remain unverified. The normal maplist member is used; extra suffix members are not automatically substituted.

The full build found six additional members rejected by the current strict
Section-1 length/next-offset check: FR `losin3`, `trnad_2`, `itown_w`, `itown_i`,
`itown_m`; DE `cosmin7`. V5.3 recovers scripts, Walkmesh, graph and interaction
evidence only for the six reviewed original compressed member hashes, paired
with the actual archive and member name. Section 1 uses the adjacent offset
span instead of the inconsistent declared length. Both lengths and the original
member hash are recorded in Context v5 and the existing Inspector. Offset,
entry, code/jump, text and AKAO bounds remain checked; unknown anomalies still
fail. No source bytes, script offsets or Triangle IDs are repaired.

Strict Visual succeeds for FR `losin3`, `trnad_2` and DE `cosmin7`; `trnad_2`
retains its partial static-background status. FR `itown_w/i/m` still have no
complete Visual: their external `FINAL FANTASY7Y7` trailer is not an accepted
footer. The Inspector retains the rejection reason. Their scripts and local
geometry do not depend on accepting that trailer. These results do not prove
that the original game executes the scenes correctly.

Atlas retains its existing precision and identity gates. Save Field placement requires the reviewed maplist/Save ID binding, the actual Field archive and Walkmesh, and containment in the original saved Triangle. An outside point is not snapped to another triangle. Interpolated Z belongs to the current Walkmesh, not the save's stored actor height. Foreign-language real-save placement has not gained runtime validation merely because a pack loads.

WM0 static initialization prediction accepts these exact complete `wm0.ev` SHA-256 values:

| Source | SHA-256 |
|---|---|
| EN | `a020dace94f21b73094c204c54b01e13b3688002f65ffd9b1edf8ada5e372a64` |
| FR | `7664bf39da3f7f46474bcce29aa39f9ffd044e88b587e1c251a4acd23bd506bd` |
| DE | `c11d93aff555088368f432ed0c0f08d6fb0b5d0d40123d5681f83c3d0083be7f` |
| ES | `b92798f1b5fb9adbfd495a23d44655822e256023251f267ca43fff14ceb912db` |

The four system-0 code regions are byte-identical and their initialization
branches were independently reviewed. This does not authorize an unlisted EV
with the same fragment, nor mixed loaded EV identities. Missing, changed or
conflicting sources remain **Unknown**. Prediction never switches visible
terrain or BASE routing automatically. Original game runtime behavior remains
unverified.

Other world scripts are not wholly semantically equivalent: FR WM0 adds a
dialogue/wait block and relocates later evidence offsets. FR/DE/ES WM2 are equal
to each other but differ from EN in variable banks/addresses, including a
temporary-byte versus save-mapped `0xF24` access. Its gameplay significance is
unknown; GaiaGIS does not execute or simulate that script.
