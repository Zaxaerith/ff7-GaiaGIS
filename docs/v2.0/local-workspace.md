# Local Auto-Workspace — v2.0.1

Validated locally on 2026-10-05, on main after v2.0.0 and the cleanup documentation
commit. This is a launcher/UX patch, with unchanged reconstruction, GIS, gameplay,
projection formulas, source geometry and sealed climate research. No remote publish
is performed as part of this work.

## Recommended command

```powershell
python -m gaiagis.local --source "YOUR_FF7_INSTALLATION"
```

Run from the repository root, after installing Node 22.12+ / Python 3.12+ and running
`npm ci` once in `web/`. The thin root package adapter supports module execution in
a source checkout, including `importlib.resources`; installed distributions use the
normal `src/gaiagis` package. `scripts/start_local.ps1` calls the same entry point.
Its first positional source argument opts into remembering it; thereafter no argument
is required. The Python CLI remembers only with `--remember-source`.

Flags: `--workspace`, `--host`, `--port`, `--no-open`, `--rebuild`, `--clean-invalid`,
`--remember-source`, `--debug`. With no source, use ignored `.gaiagis-local.json` or
an interactive terminal prompt. Non-interactive use without a source produces an
explicit error. Default workspace is `output/local-workspace`, default host is
`127.0.0.1`, default port is 5173; at most 100 successive ports are tried. Port 0
requests an OS-assigned port. A non-loopback bind requires explicit `--host`.

## Discovery and generation

The shared case-insensitive discovery supports Steam 2026, classic/extracted layouts,
and existing direct-data selections. The launcher expects WM0/WM2/WM3 MAP and BOT,
world_us.lgp, and sibling field/flevel.lgp. Readability, nonempty sizes and SHA-256
are checked before generation and again afterwards. Unknown fingerprints are reported
as unknown and pass to structural validation, rather than being hard-rejected by AppID.

The launcher calls `build_workspace`, not a second generator. A component is reused
only if its schema/tool/generator version, relevant input hashes, asset size/hash,
and recursively declared dependency hashes match. Unrelated WM3 source changes do
not invalidate WM0 geometry. Native maps/textures/transitions now run independently
through an additive `--only` option on the existing generator; its default full export
is preserved. An invalid events asset rebuilds events alone in the synthetic test.

`--rebuild` forces all exporters; `--clean-invalid` unlinks only known invalid asset
names before export. Optional failures remove failed/stale output from the new manifest
and are reported as unavailable. Core WM0 failure stops startup. Existing Stage 1 and
workspace-local `.build` caches are reused by the same generator. Fresh GIS uses the
existing QGIS runtime helper when necessary; unavailable GDAL produces a concise
`GAIAGIS_QGIS_ROOT` error, with traceback only under `--debug`.

The transport remains workspace schema 1 / generator `workspace-1` / exporter tool
2.0.0: produced schemas and payload semantics have not changed. Application package
version is 2.0.1. All **13** fresh payload hashes match the retained v2.0 workspace
byte-for-byte. Deleting the new workspace makes it regenerable on the next launch.

## Local HTTP and public boundary

Python serves a compiled, audited code-only `web/dist-release`, with no Vite daemon.
It hashes relevant Web sources and build inputs plus existing bundle outputs; an
unchanged warm launch reuses the build. Editing UI source requires restarting this
launcher. Use the documented Vite/manual workflow for live development.

Read-only endpoints:

- `/__gaiagis_local__/status`: local capability/version, no source paths.
- `/__gaiagis_local__/workspace`: checked workspace manifest, no source paths.
- `/__gaiagis_local__/assets/<filename>`: only manifest-listed, known transport files.

No source installation root is registered with HTTP. Private reports/config, cache,
MAP/BOT/LGP/TEX/HRC/RSD/P/A, unlisted files and disk directories are inaccessible.
Paths are URL-decoded and checked; traversal, encoded traversal, backslash paths,
escaping filesystem links, changed checksums and foreign Host/Origin are rejected.
No directory listings, CORS allowance, upload API or write endpoint exists. HTTP
responses use no-store, nosniff and same-origin resource policy. Windows uses an
exclusive socket bind; shutdown closes the socket. Ctrl+C was tested followed by
successful rebind to the same port; no persistent Node child is used.

Only this private server injects the `gaiagis-local` capability meta tag into HTML.
The Viewer checks that advertisement, then status/manifest and generated assets.
Public HTML has no advertisement and makes **zero** local endpoint probes, avoiding
404 console noise on Pages; it retains code-only/manual operation and never scans
local disks. Nothing is uploaded. Browser localStorage never receives the source path.

## Viewer adoption

Fetched File handles enter the existing WorkspaceLoader with checksum/source/schema
validation and manifest-dependency ordering. Core geometry adopts first and displays
while optional owners decode. Optional network/decoder failures remain isolated.
Page-hide cancels network/adoption. Local mode displays loading/loaded status without
onboarding/file picker, and offers an initially collapsed Advanced / Manual Loading
section. Public manual buttons keep their existing placement.

The following 12 groups / 13 payloads loaded automatically in the real source test:
geometry, locations, encounters, events, routing, textures, WM2, textures-WM2,
WM3, textures-WM3, transitions, Explorer v2. WM0 original texture was ready; switching
to Underwater or Great Glacier selected the already loaded original texture directly.
Public and individual fallback loaders remain supported.

## Actual timings and QA

- Cold workspace export plus first code-only build/server ready: **24.02 s**.
  This uses the retained compatible Stage 1 GIS cache, not a fresh full GIS build.
- Warm ready time: **0.95 s**; all 12 exporter steps / 13 payloads
  reused, no exporters or npm build rerun.
- Generated payload total: 19,124,791 bytes (unchanged from v2.0).
- Browser full automatic adoption: desktop 2998 ms,
  390px 2595 ms, 320px 2579 ms.
- **47/47 browser checks PASS**: no file picker/intro, all data Loaded,
  WM0/native texture rendering, Transitions/Explorer, path-free Data panel, collapsed
  manual controls, no mobile overflow, and public code-only fallback without errors.
- Screenshots of WM0/WM2/WM3 were visually reviewed; screenshots/reports remain private.
  Native maps retained one main draw call. Headless FPS samples are diagnostic only,
  and are not a physical GPU/browser benchmark.
- Python: **266 non-climate tests** total: 241 passed,
  25 explicit optional source/cache skips, zero failures/errors. The three GDAL
  projection tests passed separately with installed QGIS and isolated CRS output.
- New launcher tests: 26 passed, covering layouts/readability errors, persistence,
  cache/dependency reuse, partial rebuild, optional failures, friendly QGIS error,
  browser-open/shutdown, HTTP allowlist, traversal, changed assets, Host/Origin,
  port conflict and rebind. Web: 500 passed / 5 optional skips (505 total), including
  10 new local transport/adoption tests. Both builds and release audit PASS.

Private raw evidence is in `output/local-launcher-validation/`; no evidence payload
or screenshot is included in public Git. The full-sphere/source-only policy remains
unchanged. All 461 protected climate/reconstruction files were hash-checked unchanged.

## Source fingerprints

Actual source layout: Steam 2026 `ff7/workingdir/data/wm`, selected from the user's
read-only FINAL FANTASY VII Steam Edition installation. All four known reference
fingerprints match. The following before/after checks include BOT and flevel as well.

| File | Bytes | Before SHA-256 | After |
|---|---:|---|---|
| wm0.map | 3,250,176 | `43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C` | Same |
| wm2.map | 565,248 | `404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02` | Same |
| wm3.map | 188,416 | `70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3` | Same |
| world_us.lgp | 3,114,259 | `975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C` | Same |
| wm0.bot | 15,638,528 | `8C4312419869A3ED862F56A53713123ABED4938962E986460E300786D51A719E` | Same |
| wm2.bot | 2,260,992 | `D1F90526594F0F70089AE2D71E9A1643C4434414A04FA13CF3B9BEAB2EE43720` | Same |
| wm3.bot | 753,664 | `B98E10B46D4E8427DEAE3514A4A448C28971E99F584011E7102E61B94F1FC3FF` | Same |
| flevel.lgp | 131,431,170 | `AF695CCF7C681BE222F5F716758160E39469EC02BC0AF3DD6F20A5E9C2A34807` | Same |

**FF7 source modified: NO**. Public derived data included = NO. The generated local
workspace and local config are ignored. Only original code, documentation and
synthetic tests are eligible for the local commit. No new reconstruction/version
feature work follows this patch without an explicit request.
