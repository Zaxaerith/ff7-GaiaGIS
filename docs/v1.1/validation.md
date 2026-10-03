# v1.1 release candidate validation

Validated locally on 2026-10-03, starting from published v1.0.0 main
`f6dc1113b94091809ebf55428584666b826722b8`, on `feature/v1.1-poi`.
Commit authorship remains Zaxaerith. The existing v1.0.0 tag is unchanged.

## Extraction

- Observed: 34 locations, 43 entrances; 66,877-byte private JSON.
- Sources: WM0 base trigger triangles; reachable constant ENTER_FIELD
  call sites in wm0.ev; FIELD.TBL destinations; English flevel.lgp maplist.
- All 34 names use explicit coordinate-free field identity annotations.
- Mythril Mine, Nibelheim, Mt. Nibel, Icicle Inn and conditional field
  variants retain their distinct entries/scenarios.
- Gold Saucer and Northern Cave remain unresolved. Model/system-only
  entries, dynamic arguments and runtime availability are not resolved.
- Coordinates are triangle-derived navigation representatives, not
  visually estimated points or claimed exact trigger centers.
- Generation is deterministic; repeated JSON bytes match.

## Tests and browser QA

| Check | Result |
| --- | --- |
| POI Python unit + real source integration | 17 passed |
| Existing parser/source tests | 35 passed |
| Existing sphere/GIS tests, installed QGIS 4.2.2 | 22 passed |
| Existing Web exporter checks | 3 passed |
| Web/Vitest, including POI schema and mesh binding | 76 passed |
| Browser POI checks | 179 passed, zero page errors |
| npm build | passed |
| npm build:release / audit:release | passed; seven code/notice files, zero derived assets |

A clean Git source archive was installed with `npm ci` and validated
without private files: 72 Web tests passed, four real-data tests skipped;
16 POI Python tests passed, one source integration test skipped. Both
production builds and the source-only audit passed in that checkout.

Browser QA used installed Chrome with isolated workspace profiles/temp.
Midgar, Junon, Mythril Mine and Temple of the Ancients were checked in
each of the five projections at desktop, 390px and 320px touch layouts.
Desktop fly endpoints were within 3 screen pixels of viewport center.
Markers, search, inspector and real touch dispatch were verified for
all these combinations. Multi-entrance navigation, triangle/location
inspector switching, corrupted POI rejection, missing optional file,
unchanged two-file chooser, filters, keyboard, reduced motion and deep
links passed. Labels and inspectors were visually inspected in screenshots.

A mobile failure exposed overlapping marker hit targets: clicks now
select the nearest visible dot, while keyboard activation selects the
focused named button. Selected entrance navigation updates the marker
to that entrance. Location sheets preserve visible map space.

One headless desktop measurement: Viewer + POI ready in 925 ms;
Globe ~240 FPS with locations vs ~239.9 FPS with them hidden. These are
environment-specific samples, not hardware guarantees or an isolated
POI-fetch benchmark. Thirty-four DOM markers add zero Three.js draw calls.
The release browser made only code/favicon GET requests; no dataset GET
or upload occurred after local file selection.

## Preservation and public data boundary

FF7 source modified: **NO**. Before/after size and SHA-256 match for all
four core MAP/LGP files and three BOT files. WM2/WM3 are fingerprinted
only; no underwater layer was added.

| File | Bytes | Before = after SHA-256 |
| --- | ---: | --- |
| wm0.map | 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map | 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map | 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp | 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |

The frozen V1 mesh and metadata, reconstruction module and configuration
hashes match. Projection source files are unchanged. Historical V1 and
V2/V2.1/V2.2 source/data/products were compared with the existing
443-file preservation manifest. The already documented climate status
README and the intentionally updated public-data README differ; the
old empty WKT2 regression fixture was re-created by its existing test.
Canonical GIS products and climate research products are unchanged.
No climate test/simulation or reconstruction build was run.

`gaia-poi.json`, raw assets, output, private screenshots and complete
derived geometry are ignored and excluded from public tracked files
and the code-only release. GPL-3.0-only remains scoped to original code;
LICENSE and third-party notices are retained.

Private logs, source fingerprints, screenshots and machine-readable
audit results are under `output/v1_1/`. Public tests use synthetic
fixtures; real-data tests explicitly skip in a clean source checkout.
The manual Pages workflow and stable v1.0.0 release are not changed.
