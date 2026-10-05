# Presentation research — v2.1

Research precedes styling. All original resources stay private and read-only.

## Observed
English menu_us.lgp is 1,705,214 bytes. The installed sound directory contains audio.dat (71,738,528 bytes) and audio.fmt (54,668 bytes). No original bitmap, font, cursor or recording is required by the public theme. The independently parsed audio.fmt contains 750 records. Three non-looping mono Microsoft ADPCM cues are decoded to private PCM16LE WAV payloads at 44.1 kHz.

## Reference-derived
Classic [world dialog implementation](https://github.com/ergonomy-joe/ff7-worldmap/blob/main/NEWFF7/C_00768C70.cpp) separates dialog allocation, quarter-size expansion, text reveal, selection hand and close states. Its helper plays sound ID 1, but this alone does not establish all menu confirm/cancel/navigation mappings. The menu configuration permits changing window colors: deep-blue defaults must not be treated as a universal asset color.

[Classic sound identifiers](https://github.com/Zaarbs/ff7/blob/d094a23d0b6dde9853fadb9632083d7fbc0e3580/src/sound/sound.h) and [menu call sites](https://github.com/Zaarbs/ff7/blob/d094a23d0b6dde9853fadb9632083d7fbc0e3580/src/menu/menu.cpp) cross-check cursor/navigation ID 1, confirmation ID 2, and cancel ID 4. The corresponding actual records have valid bounds, explicit ADPCM coefficients and non-looping payloads. Menu-open identity is unresolved: opening a summary stays silent. The independent decoder reproduces signed predictor, nibble order and clipping on synthetic tests; Web Audio decodes the resulting PCM WAV in actual browser QA. No decompiled implementation is copied.

The fmt record has six uint32 metadata fields followed by WAVEFORMATEX. Extension length applies to ADPCM; unused records contain 0xCD allocator markers in nominal format fields. Treating every unused cbSize as an extension length would misparse this installation.

[Square Enix's original-game gallery](https://www.jp.square-enix.com/ff7sp/) is an identified cross-platform/mobile visual reference, with [gallery image](https://www.jp.square-enix.com/ff7sp/image/ph04_1.jpg). Direct browser retrieval was unavailable in this environment, so it is not counted as a completed visual/runtime comparison. The completed visual evidence is a controlled v2.0.1 versus v2.1 comparison using the actual installed artwork and model at the same source triangle, camera, relief and texture. Classic-PC lighting/dialog research provides behavior evidence; this does not establish pixel equivalence with that gallery or Steam 2026.

## Reconstructed public design
Use original CSS primitives: blue-to-black panel gradients, bright outer rims, inner highlights, modest corners, selected-row pointer, explicit disabled/focus states. Keep logical six-panel hierarchy, readable scientific tables and long values. No copied bitmaps, font atlas, scanlines, blur or CRT effect. Scientific theme remains available. Exact classic pixel/UI equivalence is not claimed.

## Unknown
Steam 2026 rendering equivalence, full cue registry and runtime timings remain NOT VERIFIED.
