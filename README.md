# GaiaGIS

**A mathematical GIS reconstruction of Final Fantasy VII's polygonal world map.**

FF7 WM0 → raw polygon mesh → inverse Mercator spherical reconstruction → Gaia GIS → interactive Web globe → map projections.

## Overview

GaiaGIS treats the original game's world polygons as spatial data. The current local Viewer lets you rotate Gaia, inspect individual FF7 triangles and smoothly unfold the sphere into standard map projections. Its geometry is reconstructed from the source mesh, not a fan-map texture on a sphere.

Observed source geometry, reconstructed coordinates, assumed physical scales and synthetic polar ocean remain distinct. No claim is made about canonical Gaia radius, equator, poles or physical height units.

## Screenshots

Local QA screenshots, generated from your installed data and excluded from public source distribution:

![Gaia Globe](docs/screenshots/globe.png)

[Equirectangular](docs/screenshots/equirectangular.png) · [Mollweide](docs/screenshots/mollweide.png) · [Mobile](docs/screenshots/mobile.png)

## Web Viewer

- Globe orbit, wheel/pinch zoom, optional gentle auto rotation (default off).
- Equirectangular, spherical Mercator, Mollweide and an interactive Orthographic hemisphere.
- 1.1s eased morph, with pan/zoom controls for maps and drag-to-change-hemisphere for Orthographic.
- FF7 gameplay terrain colors, original triangle grid, 30° graticule and synthetic-cap distinction.
- Click/tap picking with terrain, region, section/mesh/triangle, geometry origin and approximate geographic centroid. Synthetic faces never receive fake FF7 IDs.
- Responsive panels and a mobile inspector sheet; device pixel ratio is capped.
- A persistent compass/north-up button and current hemisphere coordinates help maintain orientation. The labeled 30° graticule starts on, has a direct viewport toggle, and highlights the equator in gold and the 0° longitude line in cyan. Optional Globe depth adds gentle camera-relative shading; flat maps retain unshaded categorical colors.

TypeScript + Vite + Three.js. No UI framework or backend. d3 dependencies are test oracles only; projection math is implemented by GaiaGIS and checked against Stage 1 PROJ outputs. The browser requires only static assets, not Python, QGIS, GDAL or GeoPackage support.

## How it works

`scripts/build_web_assets.py` reads **existing Stage 1 Geographic products** in read-only SQLite mode and exports an indexed geographic mesh plus typed triangle attributes. The Viewer loads it once, creates a small set of Three.js BufferGeometry objects, and computes display positions from one canonical lon/lat/height/topology dataset.

The original base surface contains 142586 triangles. Reconstructed caps add 9792; all 152378 canonical identities survive display tessellation and picking. Source triangle connectivity is preserved; internal source anomalies are not repaired. The existing GLB remains an independent cross-check/reference product.

## Mathematics

Inverse Mercator: `λ=2π(x/W−1/2)`, `φ=atan(sinh((H/2−n)/(W/(2π))))`.

Observed W=294912, H=229376 gives source latitudes **±80.071528814895°**. The N/S cycle is cut and synthetic ocean caps complete the sphere; E/W remains longitude-periodic. Default sphere radius **6371008.8m** and vertical scale **1m/raw unit** are assumptions, not FF7 canon.

The Web reference radius is 1 for rendering precision. GIS radius stays in meters. Globe → map intermediate shapes are visual transitions, not actual projections. See [spherical reconstruction](docs/spherical-reconstruction.md), [Web format](docs/web-data-format.md) and [Viewer validation](docs/web-viewer-validation.md).

## Local build

With the existing Stage 1 outputs:

```powershell
Set-Location D:\Project\FF7Gaia
. .\scripts\use_workspace_environment.ps1
.\.venv\Scripts\python.exe -B scripts\build_web_assets.py
Set-Location web
npm install
npm run dev
```

Open **http://127.0.0.1:5173/**. A missing-dataset page gives the exporter command instead of silently substituting fake geometry. On a fresh clone, generate Stage 0/1 products from your own local installation first; no game or derived binary dataset is supplied.

Node >=22.12 is required; tested with Node 24.19.0. `web/.npmrc` keeps npm cache within the workspace. Dependencies are pinned by package-lock.json; `npm ci` reproduces the installed graph.

Dot-source `scripts/use_workspace_environment.ps1` in the current shell to isolate temporary files and browser/tool caches as shown above; it does not change global settings.

```powershell
npm test
npm run build
npm run preview
npm run assets:measure
npm run notices
```

Python exporter checks: `python -B -m unittest discover -s tests -p test_web_export.py -v` from the root. Browser QA: `node scripts/browser-qa.mjs` from `web/` while the dev server runs. It uses an installed Chrome executable and a workspace-only profile; set GAIA_BROWSER_EXECUTABLE for another location. No browser download is required.

## FF7 source requirements and safety

Local source: `D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition`, strictly read-only. Unique project workspace: `D:\Project\FF7Gaia`.

Common discovery supports the 2026 layout, classic `data/wm`, directly selected wm/workingdir and extracted layouts, with explicit case-insensitive lookup and structural validation. Fingerprints are compatibility references, not parser acceptance gates. Stage 2 reuses Stage 1 products and does not revisit binary research.

MAP/BOT/LGP/TEX/executable assets are not copied, modified or included in Git. Source/core fingerprints are checked before and after work. All project/cache/temp/profile/output files stay in the workspace. Detailed earlier setup is preserved in [local GIS build](docs/local-gis-build.md) and [Stage 0 report](docs/validation-report.md).

## GIS outputs

Stage 1 retains raw/geographic/projection GeoPackages, custom Gaia WKT2, meter-based GLB and QGIS project. Browser data is a separate Float32 visualization transport. The measured binary is 5.40MB, gzip 1.20MB, Brotli 0.70MB, with max 0.424m spherical quantization error against Float64 coordinates. Stage 1 remains the GIS coordinate authority.

## License

**GNU General Public License v3.0 only — GPL-3.0-only.** See [LICENSE](LICENSE).

The GPL license applies to GaiaGIS original source code. It does not grant rights to Final Fantasy VII or Square Enix assets.

## Third-party references

Libraries retain their own licenses and notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Three.js is MIT; d3-geo/d3-geo-projection are ISC; Vite is MIT. Unlicensed FF7 reference repositories are format/behavior references only: no source is vendored or relicensed, and reference caches are excluded from release bundles.

## Legal / trademark disclaimer and deployment

Final Fantasy VII and related assets belong to their respective copyright holders.

GaiaGIS is an independent fan / technical GIS visualization project and is not affiliated with or endorsed by Square Enix.

Game-derived transport, GIS geometry and screenshots require a separate distribution review; they are ignored by Git. See [data and copyright](docs/data-and-copyright.md). This stage does **not** push data, enable Pages or publish a public deployment.

`.github/workflows/deploy-pages.yml` is manual and disabled by default, with an explicit review checkbox, a repository-variable gate and a check for separately reviewed/staged assets. Vite base defaults to `./`; `GAIA_BASE_PATH` configures a Pages subpath. Dataset staging and public-release review remain a separate future step.
