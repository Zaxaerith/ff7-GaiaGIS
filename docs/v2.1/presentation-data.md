# v2.1 presentation and extended Explorer data

GaiaGIS original code/CSS remains GPL-3.0-only. Original game audio, meshes,
textures and animations remain private, ignored, locally generated inputs.
No original UI bitmap, font or cursor is distributed. Nothing is uploaded.

## Local workflow

```powershell
python -m gaiagis.local --source "YOUR_FF7_INSTALLATION"
```

The existing launcher discovers field/char.lgp, field/flevel.lgp and
sound/audio.dat/audio.fmt as optional sources. It incrementally generates and
automatically adopts the extended Explorer and presentation assets. Missing
audio leaves the public CSS theme usable and silent; missing field character
sources leaves the original eight-model Explorer usable. Individual/manual
loading and the existing public workspace chooser remain supported.

Workspace schema 1, generator workspace-1 and tool compatibility version 2.0.0
remain unchanged. These identify transport compatibility, not application version
2.1.0. Only Explorer's per-asset generator marker becomes explorer-party-1,
invalidating old Explorer output without invalidating independent geometry,
POI/gameplay/native-map/texture payloads. Relevant source hashes, output size/hash
and dependency hashes are still required for reuse. Presentation depends only on
audio.dat/fmt; Explorer additionally depends on char.lgp/flevel.lgp. A missing or
invalid optional component is reported instead of fabricating a replacement.

## Private presentation JSON

`gaia-presentation.json` is a small optional asset:

| Field | Meaning |
|---|---|
| schema / version | gaiagis-presentation / 1 |
| sources | path-free original audio.dat and audio.fmt SHA-256 |
| audio[].id | cursor, confirm, cancel |
| wav | base64 RIFF PCM16LE WAV, locally decoded |
| source_record | actual zero-based fmt record index |
| fmt_byte_offset / data_byte_offset | source provenance |
| compressed_bytes / decoded_samples | bounded source/output sizes |
| sample_rate / channels / loop | 44100 / 1 / false for observed three cues |
| original_codec / evidence | Microsoft ADPCM / classic-PC reference and actual record |
| unresolved_cues | open; no guessed sound |
| runtime_equivalence | NOT VERIFIED |

The actual pack is 124,465 bytes; SHA-256
`88388c5de29b574b331ee6e5ceff657a63aecc5b3747b732f76a1b7a7ee181e3`.
Deterministic ordering omits dates and absolute paths. Loader validates IDs,
hash names, version, WAV header, size limits, duplicate IDs and loop flag before
Web Audio decoding. Failed adoption retains good audio; workspace reset clears
it and guards pending decode races. No sound plays before a user gesture,
when muted or at zero volume. Default volume is 25%, sounds off. Preferences
are browser-local and contain no game path. Debounce prevents noisy repeated
feedback. Unidentified dialog-open cues stay silent. Public Pages does not probe
localhost and cannot discover a local sound pack automatically.

## Extended Explorer registry

Explorer transport remains v2. Optional registry_version 2 adds characterId,
displayNameKey, sourceKind, sourceResource, evidence, animation_tier,
compatibility_class, field_binding and display_transform. Six field-source
characters have null model_id; no fictional WM model ID is assigned.
Original world leaders retain IDs 0/1/2. The asset retains only original HRC/P/TEX/A
data and the existing map hash bindings, not another copy of source surfaces.

The observed v2 pack is 1,545,008 bytes; SHA-256
`5d853f61af264aa45fdecb2ecde1996ee5fff59521fb875c8b4f1c48df14d653`.
It contains 14 models, 61 animation clips and 23 texture resources. One shared
Chocobo source supplies five existing tint variants. All nine party characters
are available, including six explicit Extended field models. Source HRC→RSD→P→TEX
and field-loader A bindings are preserved in the private inventory. No retarget,
fan model or generated walk cycle is used. Legacy v1 and old eight-model v2 packs
remain readable; unavailable extended characters are disabled visibly.

Character and movement profile are separate: party selection uses the existing
Foot preview (WM3 native party profile), not invented per-character movement
rules. Compatible switches retain source point/triangle/heading; incompatible
switches are rejected. Party ownership and original leader restrictions are not
simulated. Scale/ground-origin/light/shadow are rendering metadata; source walker,
coordinates, UVs, projection formulas and gameplay rules remain unchanged.

## Public boundaries

The repository/build includes independent parsers, rules, CSS, translations,
synthetic fixtures and documentation only. Both packs, raw audio/character data,
private screenshots and QA evidence stay ignored. The HTTP server still exposes
only manifest-listed generated assets, never source archives or arbitrary paths.
