# GaiaGIS v1.9.0 local release candidate

Validated 2026-10-05 on local main based on published v1.8.0
`0fb78471433f839894a6f61e949da2aed243780a`. No push, tag, GitHub Release or Pages
deployment is performed. V1/projections/topology and sealed climate research
remain unchanged. This delivery stops at Explorer Mode; no v2.0 work is started.

## Model research (final report items 1–15)

The read-only English archive is
`D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition\ff7\workingdir\data\wm\world_us.lgp`.
It contains **29 HRC, 228 RSD, 228 P, 77 A and 415 TEX** entries. All skeleton,
RSD, P and A resources decode successfully. These are resource counts, not 43
unique models. The private inventory retains every hierarchy/resource/animation/
material/texture-dimension/hash and WM0/WM2/WM3 EV model call-table reference.

Verified primary registry identities and actual resources:

| Target | Engine ID | HRC | Bones | Groups | Source triangles | Clips |
|---|---:|---|---:|---:|---:|---:|
| Cloud on foot | 0 | bbe.hrc | 21 | 18 | 534 | 10 |
| Tifa on foot | 1 | dlb.hrc | 24 | 20 | 560 | 11 |
| Cid on foot | 2 | ata.hrc | 21 | 18 | 553 | 10 |
| Highwind | 3 | cgd.hrc | 6 | 4 | 323 | 1 |
| Chocobo | 19 | aja.hrc | 28 | 23 | 318 | 3 |
| Tiny Bronco | 5 | dva.hrc | 7 | 7 | 444 | 1 |
| Buggy | 6 | aba.hrc | 25 | 14 | 380 | 6 |
| Submarine | 13 | ddd.hrc | 7 | 5 | 454 | 1 |

ID4 also maps to aja.hrc in the classic registry. IDs31..40 lack a verified
resource identity; IDs41/42 are Chocobo-related logic with unresolved rendering
resources. Other models retain source skeleton names instead of guessed lore
names. Alternative state/model registries are inventory evidence, not controllable
models. ddd.hrc is not a claim of a particular current save-state submarine tint.

HRC gives rigid bone hierarchy and negative-local-Z parent endpoint offsets;
RSD binds P/TEX. P supplies group-relative polygons, float positions/normals/UV,
BGRA colors and original material words. A uses a 36-byte header with float
root transforms and per-bone rotations. The primary pack's nine TEX images are
32×32; vehicles/Chocobo use original vertex colors. The existing TEX parser is
reused. The renderer's independent source-to-display basis was visually checked
for every primary model after correcting an initially dislocated vehicle pose.

Actual zero-bone HRCs retain one rigid resource attachment. Actual P bounding
boxes include a four-byte marker (28 bytes total), differing from older reference
length descriptions. Reference Euler transformations use different global bases;
source-local angles cannot be indiscriminately negated. These discrepancies and
reference-only licensing are explained in [model research](explorer-model-research.md).
No original source asset, parser implementation or procedural fake animation is
copied into public code. Pixel-perfect lighting/blending is not claimed.

## Local pack (items 16–22)

Optional deterministic `gaia-explorer.bin`, schema gaiagis-explorer/version1,
GAIAEXP magic, bounded JSON metadata, aligned model/animation/RGBA/source-surface
blobs and SHA-256 footer. Details: [transport](explorer-data.md).

| Measure | Observed value |
|---|---:|
| Whole-file size | 9,857,900 bytes |
| Packed primary models | 8 |
| Packed original animation clips | 43 |
| Packed textures | 9 |
| Decoded model RGBA pixel storage | 36,864 bytes |
| Source surface triangles, WM0 / WM2 / WM3 | 142586 / 9967 / 8268 |
| Source surface records | 9,005,976 bytes |

Byte-identical repeated actual-source exports pass the integration test.
Whole-file SHA-256:
`1fdca8a5b67ed9358d8d76e398ac1888e73d131efe99d33379b4e6c59660d7e8`.
The private metadata binds MAP/LGP/EV and read model resource payload fingerprints.
No timestamp or absolute user path enters the pack. EV hashes are:

- wm0.ev: `a020dace94f21b73094c204c54b01e13b3688002f65ffd9b1edf8ada5e372a64`
- wm2.ev: `d1dea5c78225873d07b8c532d74e3bc35aebf4fb4a744906dd9771fbc3c18e64`
- wm3.ev: `df90900e379b547eff8371e234dbf7d5e8fcf290b28ab484994a73ad4e6aef8d`

## Movement (items 23–33)

Barycentric raw-X/Z advancement crosses the first edge into its exact source
neighbor, interpolates raw source height and respects unchanged occupancy rules.
No visual-distance inference or nearest-face teleport exists. Exact XYZ adjacency,
duplicate/non-manifold rejection and guards preserve original source ambiguity.

| Surface | Conservative traversable adjacency edges | Boundary | Non-manifold | Ambiguous | Duplicate faces |
|---|---:|---:|---:|---:|---:|
| WM0 | 213301 | 582 | 124 | 39 | 168 |
| WM2 | 14589 | 182 | 73 | 2 | 155 |
| WM3 | 12274 | 256 | 0 | 0 | 0 |

WM2 additionally has two collapsed edges. Duplicate counts denote all incident
duplicate faces, not duplicate excess. WM0 matches existing v1.5 conservative
edge count; its 224 E/W seam connections are retained and exercised with actual
source geometry. N/S remains cut. Caps and alternatives are not walker candidates.
WM2/WM3 are bounded; geometric WM3 periodicity is not used as gameplay wrap.

Foot, Buggy, Tiny Bronco and all five Chocobo profiles are operational and reuse
v1.3 Allowed-only masks. Conditional and Unknown never become passable. Native
WM3 does not reuse the WM0 Foot mask. Profile changes reject incompatible current
faces without teleport. Multiple-height interpolation and ambiguity guards have
synthetic coverage; actual water/coast/grass/mountain samples have browser QA.

Highwind uses native/source authority with independent air navigation, E/W wrap,
N/S cut clamp and relative preview altitude. Static Allowed landing is required;
unique point-in-triangle lookup rejects overlaps or unresolved ground. Grass
landing/takeoff and blocked sea landing pass actual-source checks. Airborne travel
has no Foot/Buggy terrain gate. It is neither story ownership nor original flight
physics. Landed Highwind does not perform surface driving.

WM2 Submarine operates in native 3D with a bounded geometry walker and nonnegative
relative altitude/floor guard. WM3 party mode is bounded geometry exploration.
Both are explicit previews: original collision/movement **NOT VERIFIED**. The
preview does not promise full hull/wall collision or a global bathymetric transform.
Their actual original models, native texture, movement, camera and exit are checked.

## Explorer UX (items 34–40)

Drop Explorer selects an actual visible source face, using display barycentric
weights inverted at its corners; inverse projection of the curved ray hit alone
is not used. Native picking uses exact native face barycentrics. Invalid placement,
corruption, source fingerprint/extent mismatch and missing model preserve valid
GIS/pack state. Synthetic caps never produce an Explorer anchor.

The radial-up WM0 third-person camera and Y-up native camera follow current
source state. Desktop WASD/arrows, Shift preview speed, wheel distance, drag,
altitude Q/E, Escape and focus guards are implemented. Touch320/390 uses a compact
press/release D-pad and canvas camera drag, with no horizontal overflow. The
mobile panel collapses after placement to keep the scene visible. Reduced motion
removes camera smoothing; it remains fully controllable.

Projection controls are locked during WM0 Globe exploration; comparison is
suspended/restored. Exit restores projection, camera position, up, target and zoom
across all thirteen overview views, and native top-down view after temporary 3D.
Only one original model is active; GPU resources are disposed on exit/change.
Existing v1.8 MapTransition navigation stops Explorer before switching. All104
transition records have unresolved destination-native positions, so manual
placement is required. No invented arrival, radial dive or current vehicle state
is introduced. GIS datasets/Location/Encounter/Traversal/Event/Route analyses
remain separate and intact.

## Animation (items 41–43)

All43 primary clips retain their original frame samples. Party stationary/moving
index0/1 and Chocobo index0/1 follow classic C_0076328F. Buggy moving1/water3
follows C_00763AAE without emulating its boarding/transition/state machine.
Highwind CIC(15 frames), Bronco DYA(15) and Submarine DFE(6) are neutral indexed
loop previews. Other raw clip indices are retained without guessed walk/run/
takeoff/landing names. Five Chocobo tints use separately documented additive
source RGB offsets on the shared original skeleton.

Timing is explicitly **preview30fps**, not verified Steam2026 runtime ticks.
Frame interpolation, one-shot/script override semantics and original animation
state scheduling are not reconstructed. No custom/procedural animation substitutes
for unknown clips. Every packed model has at least one original clip; no primary
placeholder or missing-animation fallback is required.

## Quality and performance (items 44–54)

| Gate | Final result |
|---|---|
| Full nonclimate Python, actual source + QGIS | 229 passed; zero failures/errors/skips |
| New model Python tests | 19 included above; 17 synthetic + 2 actual-source |
| Clean source Python | 199 passed + 30 own-data integration tests skipped; zero failures/errors |
| Web | 449 passed in17files, including49 Explorer tests |
| Clean source Web | 442 passed + 7 own-data tests skipped |
| Explorer browser/production checks | 157 passed; zero page/console errors |
| Existing POI / encounters / traversal / events | 179 / 215 / 403 / 201 passed |
| Existing v1.5 / v1.6 / v1.7 / v1.8 browser checks | 210 / 233 / 137 / 59 passed |
| Existing browser total | 1637 passed |
| Browser total | 1794 passed |
| npm test / build / build:release / audit:release | passed |
| Source-only build | 8 code/license files; zero game-derived files |
| i18n | 529 keys per locale;35new keys; five-locale parity |
| Final public tracked candidate | 332 files |

The first heavily concurrent Web run hit the existing real-data projection test's
5-second timeout; reduced-concurrency and the final default npm test both passed.
An event QA assertion during ongoing hot updates was rechecked in isolation:
all201checks passed. Neither was bypassed by changing projection/source logic.
Clean-source tests were rerun after adding the explicit missing-model/animation
cases. No climate simulation or climate test suite is executed.

Representative local Chrome/headless sanity snapshots, not portable benchmarks:

| Measure | Result |
|---|---|
| Explorer local file validation/load | about934ms for9.86MB |
| Current model geometry buffers | 45,792..80,640 bytes |
| Current model texture pixel allocation | 0..12,288 bytes |
| Model draw groups/calls | 4..23; no shadows or added terrain batch |
| WM0 final snapshot | about240FPS,21calls including current Cid + existing GIS overlays |
| WM2 Submarine snapshot | about220FPS,6calls (one terrain batch + five model groups) |
| WM3 party snapshot | about234FPS,19calls (one terrain batch +18model groups) |
| Explorer step snapshot | about0.1ms |

Texture/geometry numbers are buffer/pixel estimates, not driver-reported total GPU
memory. The encoded pack remains bounded on CPU; native spatial candidate cells
are built lazily for unique landing queries. Only current model GPU resources are
allocated, never all43IDs. Ground display follows the rendered triangular facet;
raw interpolation and frozen V1 mathematical definitions remain authoritative.
Native textures and WM0 original terrain textures retain their previous pipelines.
Visual checks include every primary identity and native/mobile screenshots;
all images/profiles/cache/reports remain private/ignored. The existing nonfatal
main-bundle size warning remains (about869kB/241kB gzip), with no added dependency.

Production source-only QA loads V1 and Explorer through local file inputs,
actually drops Highwind, exits cleanly and observes no automatic game-derived
network request. Explorer itself is unavailable until a local pack is provided.

## Safety (items 55–58)

Before/after size and SHA-256 of seven source files match. All73protected entries
remain unchanged, including frozen GIS/projections and climate results. Core hashes:

| File | Bytes before = after | SHA-256 before = after |
|---|---:|---|
| wm0.map | 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map | 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map | 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp | 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |

An additional legacy `check_web_release_safety.py` comparison against the
pre-v1.0 snapshot reports five differences: three regenerated reconstruction test
outputs and two documents already unchanged against the v1.8 HEAD. It is not a
v1.9 baseline. Its game-source and historical climate-source checks still pass;
the current 73-entry protected baseline and seven-source comparison above have
zero changes. The legacy discrepancy is retained in the private audit log.

These include the actual newly researched archive. Read model payloads are bound
by its unchanged hash and private per-resource manifest. Only read/hash/parse is
used; no game script/program is executed, and no game path receives output.
Public source/index and production artifacts contain no original assets, decoded
meshes/skeletons/animation/pixels, complete derived data, private screenshots,
profiles/cache, secrets or absolute private user paths. .gitignore additionally
excludes Explorer, HRC/RSD/P/A, OBJ/GLTF/GLB and animation dumps.

**Proprietary model assets tracked =0. Public decoded model assets =0.
Public derived data included =NO. FF7 source modified =NO.**

## Local Git and RC (items 59–61)

Version1.9.0 is recorded only after the above gates pass. The local commit SHA is
provided in the delivery message (a commit cannot contain its own SHA). Working
tree cleanliness is checked after that commit. **v1.9.0 local RC=YES** at delivery;
original runtime equivalence, animation timing, complete material blending,
Submarine/WM3 gameplay behavior and transition destination placement remain
explicit unknowns, not silently promoted to verified behavior. No remote write
is performed; publication waits for the user's separate authorization.
