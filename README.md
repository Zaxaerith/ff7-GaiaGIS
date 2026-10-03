# GaiaGIS

An interactive globe and GIS reconstruction of Final Fantasy VII's original world polygons. **Web v1.0 uses V1 Geometric Gaia only.** Five projections display the same geometric dataset; climate warps are not offered.

V2/V2.1/V2.2 climate research has concluded as **Experimental / Inconclusive**. Code and reports remain preserved in [Research](docs/climate/README.md). There is no active climate modeling roadmap.

## Viewer

- Globe, Equirectangular, Mercator, Mollweide and draggable Orthographic hemisphere.
- Orbit/pan, wheel and touch pinch zoom, projection morphing, reset and north-up compass.
- Labeled 30-degree graticule, equator/0-degree longitude highlights, hemisphere coordinates and optional globe shading.
- FF7 gameplay terrain or region colors, complete observed-category legend, approximate region-center navigation, triangle grid and synthetic-cap distinction.
- Click/tap inspector retains source map/section/mesh/triangle lineage. Synthetic caps have no fabricated FF7 attributes.
- Responsive mobile sheets, keyboard map navigation, reduced-motion handling, loading retry and graphics-context recovery.
- About/help explains local setup, reconstruction assumptions, research status and licenses.
- Browser-local loading of gaia-meta.json + gaia-mesh.bin. Files are verified with SHA-256 and never uploaded.

TypeScript, Vite and Three.js; no backend or UI framework. d3 is a test oracle only. The browser needs WebGL2 and HTTPS or localhost for checksum verification. GPU/device performance varies.

## Run locally

Node.js 24 is used for validation (package minimum 22.12). From the project root:

```powershell
Set-Location web
npm ci
npm test
npm run dev
```

Open http://127.0.0.1:5173/. Existing locally generated V1 data in web/public/data/ loads automatically. A fresh source checkout shows a local-file chooser and setup help; it contains no game-derived geometry.

To generate the default V1 dataset on your own computer, follow [local GIS setup](docs/local-gis-build.md). With the existing Python/QGIS environment, from the project root:

```powershell
. .\scripts\use_workspace_environment.ps1
.\.venv\Scripts\python.exe -B scripts\build_gaia.py --source 'YOUR_FF7_INSTALLATION' --output output
.\.venv\Scripts\python.exe -B scripts\build_web_assets.py
```

The source installation stays read-only. This Web phase uses existing V1 outputs and does not rebuild them. Viewer v1.0 accepts the fingerprinted default V1 transport, not arbitrary reconstructed or climate-modified datasets. The core FF7 parser independently discovers compatible layouts without an AppID or fingerprint-only rejection rule.

## Production and release

```powershell
Set-Location web
npm run build          # local production; includes locally present data
npm run preview        # local production preview
npm run build:release  # public code-only artifact; excludes ALL public data
npm run audit:release
npm run preview:release
```

dist/ is for private local use. **Publish only dist-release/**: it contains application code and license notices, with no game-derived geometry, metadata or screenshots. Users open their private V1 files in the browser. Both directories are ignored by Git. GAIA_BASE_PATH configures a repository subpath; the default is ./.

The manual [Pages workflow](.github/workflows/deploy-pages.yml) builds and audits the code-only artifact. [Web CI](.github/workflows/web-checks.yml) tests and builds a clean source checkout without FF7, QGIS or climate runs. No repository is created, pushed or deployed by the local preparation work. See [release guide](docs/web-release.md) and [release validation](docs/web-v1-release-validation.md).

## Geometry and assumptions

WM0 has 142586 base triangles; V1 adds 9792 synthetic ocean cap triangles. Source connectivity and lineage are retained. Observed W=294912, H=229376 raw units lead to source latitudes +/-80.071528814895 degrees through inverse Mercator. The N/S cycle is cut; E/W stays longitude-periodic. Radius 6371008.8 m, vertical scale 1 m/raw unit and geographic orientation are reconstruction assumptions, not FF7 canon.

Stage 1 Float64 GIS products remain the coordinate authority. Web transport is Float32, 5.40 MB, with previously measured maximum spherical quantization error 0.424 m. Region navigation uses area-weighted spherical chord centroids and can be diffuse for broad sea regions; these are not POIs or field entrances. Gameplay terrain is not GIS land cover.

See [Stage 0 validation](docs/validation-report.md), [spherical reconstruction](docs/spherical-reconstruction.md), [Web format](docs/web-data-format.md) and [earlier Viewer validation](docs/web-viewer-validation.md). Historic screenshots and generated datasets remain local, ignored artifacts.

## Source and licensing boundaries

FF7 datasets are read-only inputs. All local source, output, caches, browser profiles and temporary files stay in the project workspace. No proprietary MAP/BOT/LGP/TEX/executable assets, GIS products, transport binaries or screenshots enter Git.

**GPL-3.0-only applies to GaiaGIS original code**, see [LICENSE](LICENSE). Third-party code retains its own licenses and notices, including Three.js MIT; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This license grants no rights to FF7 or Square Enix assets.

Game-derived geometry publication status is **unresolved and separate** from code licensing. The code-only Pages workflow does not authorize future data publication. See [data and copyright](docs/data-and-copyright.md). GaiaGIS is an independent technical/fan project, not affiliated with or endorsed by Square Enix.
