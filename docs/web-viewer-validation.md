# Stage 2 Viewer validation

## Implemented

TypeScript 7.0.2, Vite 8.3.2, Three.js 0.186.1; no UI framework. Geographic transport exporter uses Python standard library and read-only Stage 1 GeoPackage attributes/cap tables. Browser runtime has no GIS/Python dependency. All data, install cache, browser profile, test output and screenshots remain in D:\Project\FF7Gaia.

One canonical indexed geographic dataset drives five display modes. Display geometry uses one terrain Mesh, one indexed original-source LineSegments grid, one graticule and one selected-face highlight, not one object per triangle. CPU targets and cubic interpolation implement ~1100ms morph. A small material hook handles visibility/fade only. Geographic Orthographic orientation is separate from Three.js camera projection.

## Data and numerical checks

94136 vertex records, 152378 triangles = 142586 source + 9792 caps. Binary 5396280 bytes; gzip 1196930; Brotli 696175; metadata 2905. Float32 geographic-to-sphere quantization error ≤0.424211m against Stage 1 Float64. Python tests independently compare all FF7 lineage/coordinates to GPKG and >3000 vertex samples to the existing GLB (<2m visualization tolerance).

Web tests cover header/version/layout, bounds, source/cap null semantics, actual Stage 1 counts, seam clipping/Z interpolation, full polar display sectors, finite target positions, projection math, normalization and morph endpoints. PROJ reference fixtures use Stage 1 custom Gaia WKT2 and arbitrary mathematical points; no game dataset is embedded in the fixtures.

Away from exact poles, Mollweide agrees with d3's raw projection to 1e−8 normalized units. At (180°,90°), d3's iterative routine leaves x≈1.766e−5 while the analytic pole is x=0; GaiaGIS uses the analytic value. Stage 1 PROJ comparisons and the pole equation tests are the numerical authority, rather than forcing code to match d3's stopping tolerance.

**29 Web tests passed** with local real-data tests enabled; **3 Python exporter tests passed** in the Stage 2 exporter validation. Source-only clones skip the two local-data Web checks when assets are absent. TypeScript checking and `npm run build` passed; JS bundle ≈586kB (gzip≈149kB), CSS≈11kB. Three.js MIT notice is retained in the static public files and root notices. No unlicensed reference source is bundled.

## Browser and visual QA

Chrome 154.0.8037.95, headless, installed executable; profile isolated under output/web/qa. Intel UHD Graphics via ANGLE/D3D11, desktop 1440×1000, DPR1. After warmup, 12 auto-rotation samples measured rAF throughput at **about 240 FPS**. This is **headless frame throughput**, not a guarantee for a physical monitor or mobile device; normal display refresh/GPU/DPR can cap the result. The emulated mobile page measured about 96 FPS in the direction-controls run; no physical-phone benchmark is claimed.

Checks: initial Globe, drag/zoom, terrain/cap toggle, source picking, synthetic picking without fake IDs, source grid/graticule, four map projections, animated switching, interactive Orthographic center, mobile tap and overflow-free layout. The final QA run has **no page/console errors**. PNGs are in docs/screenshots; browser-results.json is in output/web/qa.

An additional initial Stage 2 production-build check at `/FF7Gaia/` passed: JavaScript, CSS, favicon and both data assets returned HTTP 200 from the repository base path. Touch-enabled Chrome input checks confirmed one-finger Globe rotation and two-finger pinch zoom, with changed rendered canvas images and no page/console/network errors. The subsequent direction-controls dev-server run passed **16 checks** (including four new checks below); the prior production run records three additional checks. This validates emulated touch handling, not physical-phone performance. The production results are in output/web/qa/production-results.json; Pages remains undeployed.

## Direction and rendering refinement

The follow-up requested easier orientation while moving Gaia. The graticule now starts enabled, with a synchronized viewport/sidebar toggle, 30° coordinate labels, a gold equator and cyan 0° longitude line. Labels are projected from the same reconstructed coordinates; back-side labels, offscreen labels and colliding labels are hidden. A compass/north-up button preserves current longitude and zoom while returning Globe/Orthographic to an equatorial view. The view-center readout uses N/S/E/W and does not invent a longitude at a pole. Flat maps stay north-up.

Optional Globe depth uses gentle, camera-relative radial shading, faded out when morphing into a map; this does not alter triangle attributes, geographic coordinates, Stage 1 products or the transport binary. There is no solar/time model. Turn off Globe depth to see the original unshaded terrain palette. The additional browser checks cover labeled grid/toolbar synchronization, the north-up readout, shading toggle and the mobile grid button; all pass with no console/page errors. The numerical direction tests cover coordinate quadrants, hemispheres, pole singularity and rounded-zero labels.

Design references, used for interaction guidance only: [Google Maps controls and compass reset](https://developers.google.com/maps/documentation/android-sdk/controls), [Apple Maps interface guidance](https://developer.apple.com/design/human-interface-guidelines/maps) and [Apple MapKit compass control](https://developer.apple.com/documentation/mapkit/mkmapview/showscompass). No provider tiles, images, SDK or source code were incorporated.

Visual inspection compared Globe, Equirectangular and Mollweide to Stage 1 maps: continent outlines/terrain regions match, full synthetic polar rows are present, longitude cuts have no giant polygons. Orthographic disc/horizon and rotation were checked; Mercator contains no infinite/polar coordinates. Grid follows real FF7 triangle perimeters; cap display tessellation is separate.

## Explicit first-version limits

- Mercator hides any triangle with a corner beyond the cutoff rather than clipping to the exact Stage 1 GIS boundary. Target coordinates remain finite; a narrow strip may be omitted.
- Orthographic uses linear interpolated visibility over small display faces; horizon is a triangulated approximation, not analytic curved-edge clipping.
- Graticule lines use 2° samples; source internal overlaps/holes remain untouched.
- Base Raycaster is used on click/tap, not continuously per frame; no BVH yet.
- Physical-phone performance and public Pages deployment remain untested. Keyboard focus/labels are provided, but there is no nonvisual geographic navigation mode.
- Public redistribution/staging of geometry and screenshots is intentionally unresolved. Dataset is local-only and Git-ignored; the manual workflow is disabled by default.

## Reproduce

From root: `python -B scripts/build_web_assets.py`; then from web: `npm ci`, `npm test`, `npm run build`, `npm run dev`. With the server running, `node scripts/browser-qa.mjs` captures QA. `npm run assets:measure` creates local compressed measurements; `npm run notices` regenerates third-party notices from pinned installed packages.

To repeat the production subpath/touch check, build with `GAIA_BASE_PATH=/FF7Gaia/`, start Vite preview on port 5174 with the same environment setting, and run `node scripts/browser-production-qa.mjs`. Remove that environment setting and rebuild afterwards for the default relative-base output.
