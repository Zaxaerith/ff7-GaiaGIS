# GaiaGIS v2.1.0 local release candidate validation

Scope: FF7-inspired presentation, independent color/lighting/grounding corrections,
optional local original UI audio, and nine-character Explorer. Local main is the
authoritative baseline (`1cc1a7a27a468b9b87c44752d659c5936b61855b`). No remote
mutation, new tag, Release or Pages deployment is authorized/performed.

## Results

| Gate | Result |
|---|---|
| Python with actual local source | 286 passed, 0 failures/errors, 0 skips |
| Python without optional FF7 inputs | 259 passed, 27 explicit optional skips |
| Web | 537 passed, 5 optional skips, 21 files |
| Actual Explorer/presentation browser checks | 70/70 |
| Color, animation, before/after, fallback/focus checks | 14/14 |
| Code-only production / local production checks | 8/8 |
| Desktop / 390px / 320px | PASS; no horizontal overflow |
| Five locales | 602 keys each; 29 additions; parity PASS |
| npm build / build:release / audit:release | PASS; zero derived files in release |
| Application / workspace / Explorer versions | 2.1.0 / schema 1 workspace-1 / v2 |
| Legacy v1/v2 Explorer | regression PASS; real old v2 missing-character fallback PASS |
| Frozen private evidence | all 461 final size/hash bindings unchanged |
| FF7 source size/hash | all 12 inspected inputs unchanged |
| Public proprietary/audio/model/decoded payloads | 0 |
| Public derived data included | NO |
| Audited public tracked files | 382; no private paths/credentials or binary payloads |

The application runner deliberately excludes sealed climate tests. Reconstruction,
original GIS products, 13 projection formulas, walker/traversal/landing, POI,
encounter, event, routing and transition semantics remain unchanged. All fourteen
freshly generated workspace payloads hash-identically reproduce the retained
current workspace. The twelve pre-existing payloads outside Explorer are reused;
only the extended Explorer and new optional presentation pack require generation.

## Source observations and safety

Source is the user's own Steam 2026 installation, discovered from the installation
root with the existing case-insensitive layout detector. Core input hashes match
the known compatible dataset. Additional source records are not hard-coded parser
acceptance gates. Sources are read as binaries only, never served over HTTP.

| Input | Bytes | Before = after SHA-256 |
|---|---:|---|
| wm0.map | 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map | 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map | 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp | 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |
| wm0.bot | 15638528 | 8C4312419869A3ED862F56A53713123ABED4938962E986460E300786D51A719E |
| wm2.bot | 2260992 | D1F90526594F0F70089AE2D71E9A1643C4434414A04FA13CF3B9BEAB2EE43720 |
| wm3.bot | 753664 | B98E10B46D4E8427DEAE3514A4A448C28971E99F584011E7102E61B94F1FC3FF |
| flevel.lgp | 131431170 | af695ccf7c681be222f5f716758160e39469ec02bc0af3dd6f20a5e9c2a34807 |
| char.lgp | 48989867 | 29b336f937e667c7f9b5e6891874a79a8eee95f28922c8909d0f85f27fc267a0 |
| audio.dat | 71738528 | 77ba659ba1f96106e953d966e1f07e427bb14fa1d1994842b58d957ac5320982 |
| audio.fmt | 54668 | 64f9411471d58e7380e82df93f5bedd37df6f3ad0ac55a752f3e203ee7177d64 |
| menu_us.lgp | 1705214 | 2eb6d4257ee362733a31ddf3bcca01babcce09cf58801a691180e2db4182afea |

**FF7 source modified: NO.** All logs, temp data, browser profiles and screenshots
stay under the project. No source cache/import/script is written in the installation.

One early legacy CRS regression rewrote the creation timestamp in the protected
empty `output/reconstruction/test_crs/wkt2.gpkg` test fixture. This was detected by
the independent archived protection ledger. It was restored byte-exact to SHA-256
`d4ccf9b9c28395a15c8c43a2cff3b9160566282b9665d4829e0e954ea475df5d`,
using the archived run timestamp and accepting recovery only on an exact original
SHA match. The runner now isolates the two fixture-generating callbacks in a private
scratch directory; original sphere tests and authoritative GIS/GLB read inputs remain
unchanged. Final complete regressions leave all 461 protection hashes unchanged.
No climate computation, GIS reconstruction repair or physics update was performed.

## Presentation and local audio

Default original-inspired CSS windows use blue/black gradients, outer rim and
inner highlight, compact rounded corners and selected-row pointer. Scientific
theme remains available. All six panels and Inspector retain technical readability;
keyboard focus is explicit and checked, disabled controls remain distinct, theme
preferences survive reload, and reduced-motion presentation remains supported.

Actual audio inventory: 750 format records. The private 124,465-byte schema-1
presentation pack contains cursor 1, confirm 2 and cancel 4, non-looping mono 44.1kHz.
Source bounds/coefficient validation, synthetic predictor/clip/WAV tests and actual
browser decoding pass. Mute, volume, gesture gate, failed-load retention and pending
decode/reset are covered. Open cue remains unresolved and silent. Public production
requests neither local endpoints nor audio/model assets and retains manual loading.
Detailed schema/hash/provenance is in [presentation data](presentation-data.md).

## Lighting, grounding and actual visual QA

Missing sRGB conversion of P vertex colors is independently demonstrated with GPU
readback: source gray 128 previously displays as 188; corrected vertex gray and
properly tagged texture gray both display as 128; white remains 255. Textures were
already correctly sRGB-tagged, so no duplicate decode/global terrain darkening is
introduced. Model lighting uses moderate 0.6 ambient plus 0.4 directional, not PBR;
flat/debug presets remain diagnostic. A Mercator canvas is byte-identical across
model lighting presets. Terrain/sea artwork preserves its former color output.

Private before/after pictures compare actual v2.0.1 source code/old Explorer with
current code at identical triangle 22556, coordinates, camera and target. Cloud's
hair/clothing recover tonal separation and feet no longer rely on an arbitrary
origin. Nine character pictures were inspected; skin, clothing and textures remain
readable. Contact shadows fit rendered triangle normals, are soft-edged and add
one draw call. Vehicle footprints are wider than party footprints. Highwind fades
and widens with altitude; native-map/Submarine shadow remains an approximation.
Source idle pose bounds ground models without altering original A frames.

Original runtime/screenshot pixel equivalence is **not** established. The identified
Square Enix cross-platform gallery could not be retrieved visually in this environment;
it is not counted as a successful runtime comparison. Actual source artwork and
classic-PC lighting/dialog/shadow code remain the primary completed evidence.

## Nine characters and Explorer regression

All nine have valid original idle/move clips and finite bone matrices for every
tested source frame. Cloud/Tifa/Cid keep actual world-map HRCs; the six additions
use actual field HRC→RSD→P→TEX and field-loader A bindings. Red XIII and Cait Sith
use their own non-humanoid animations. Vincent uses its verified 25-bone bindings,
not an incompatible Cloud clip. No fan/AI model, retarget or procedural gait is used.
See [party inventory](party-model-research.md) for all names, skeletons and frame counts.

The compact selector has Party / Vehicles / Chocobos groups, while movement profile
remains independent. Cloud→Aerith, Aerith→Vincent, party→Buggy→party, five Chocobos,
Tiny Bronco on source water and Highwind pass. Compatible switching preserves exact
source position/heading; a party switch from incompatible sea is rejected. WM2
Submarine and WM3 party/native map previews load and ground successfully. Exit
disposes model/texture/material/shadow and restores overview controls. Old v2 packs
show absent characters disabled; they do not fabricate source models.

Scale is reconstructed display metadata, not canonical physical height. Field
animations remain 30fps previews; idle bounds do not guarantee contact throughout
every animated root displacement or cliff crossing. Leader restrictions, ownership,
story/save state, runtime movement timing and Steam 2026 equivalence remain unknown
or explicitly not simulated. No field renderer is implemented.

## Local startup and performance

The recommended one-command launcher is unchanged. Cold generation with retained
Stage 1 cache, empty private workspace and Viewer build: **37.03s** in this run.
Warm reuse: **1.24s**, zero exporters rebuilt, all 14 payloads and code-only Viewer
reused. Subsequent source-code changes correctly trigger only Viewer rebuild.
Production browser adopts 13 component groups without a file picker; WM2/WM3 open
already textured, transitions/Explorer/presentation loaded. Paths are not shown.
All QA servers were stopped after validation; their six ports could be rebound.

The observed Explorer pack grows from 851,560 to 1,545,008 bytes (14 models, 61
clips, 23 textures). Decoding/binding observed approximately 0.8–2.5s while other
QA processes were active. One selected party model uses 85,168–95,808 bytes of
geometry/decoded texture buffers, excluding map atlases, driver overhead and CPU
animation storage. Model parts use 17–23 draw calls plus one shadow. Idle/move
update diagnostics are around 0–0.2ms. Model switches observed about 1–12.5ms;
headless frame counters about 130–240 FPS depending on simultaneous QA/load.
These are local sanity observations, not a device-independent benchmark/guarantee.
Only the active model is uploaded to GPU; every alternate character is not a scene
copy. Main mesh/topology is never duplicated by Explorer or shadows.

## Reproduction and private evidence

```powershell
python -B scripts/test_application.py --source "YOUR_FF7_INSTALLATION" --output output/application-tests
cd web
npm test
npm run build
npm run build:release
npm run audit:release
```

Actual browser scripts require a local generated workspace and corresponding local
servers. `browser-v21-qa.mjs` covers real models, interaction/mobile/old-pack/native
maps and local adoption. `browser-v21-color-qa.mjs` additionally requires an ignored
v2.0.1 source baseline served locally, for controlled private comparison.
Public fixtures contain synthetic data only; actual-source tests explicitly skip
without a supplied installation. No screenshots/game payloads enter Git.

Private evidence is under `output/v2_1/`: source snapshots/safety, Python logs,
browser/color/production reports, screenshots, hash audit and reproduction workspace.
Current authoritative user workspace remains `output/local-workspace`.

Local RC status: **YES after final local commit and clean working-tree audit**.
Publication remains a separate user decision. No v2.2 work is started.
