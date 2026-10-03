# Web v1.0 preparation validation

Date: 2026-10-03. Workspace: `D:\Project\FF7Gaia`. Canonical reconstruction: **V1 Geometric Gaia only**. V2/V2.1/V2.2 are concluded **Experimental / Inconclusive** research. No climate physics, ensemble, latitude mapping, V1 GIS outputs or original game assets were changed or regenerated.

## Initial inspection and completed changes

Initial Web implementation already provided five projections, smooth morphing, triangle picking, graticule, compass, zoom and mobile panels. Its 29 tests, local build and 16 browser checks passed before feature work. Git was an unborn repository with all source untracked. Source was audited and saved as baseline commit `c9f7ccd` before changes; local ignored products were recorded in a 443-file preservation manifest. Work continues on `codex/web-v1-release`.

| Actual gap | Implemented behavior |
|---|---|
| Canonical/research status unclear | V1 in UI/README/About; climate research concluded Experimental / Inconclusive |
| Missing dataset only produced an error | Browser-local two-file chooser, setup help and retry |
| No reconstruction gate at loading | Actual binary SHA-256 pinned to V1; metadata/transport validation; climate and corrupt files rejected |
| No region color/navigation | Observed-region layer, full legend and approximate spherical area-weighted centers |
| Legend only showed eight terrain types | All actually observed terrain categories shown |
| Keyboard/reduced-motion incomplete | Arrow/+/-/N/Home/Escape controls; visible focus; reduced-motion skips morph |
| WebGL context loss had no recovery | Explicit interruption message and cached-dataset retry with a fresh canvas |
| Pages required missing staged private data | Reproducible code-only build, strict static-file audit and manual Pages workflow |
| No source CI | Windows source-only test/build workflow; no FF7/QGIS/climate requirements |
| QA overwrote historic screenshots | All new evidence and browser temp/profile files isolated under output/web_release_v1 |

Package version is 1.0.0; dependency versions are unchanged. Browser File APIs do not upload or persist the selected files. The transport fingerprint pins the current default V1 geometry, not arbitrary future datasets. Stage 1 provenance hashes are retained and structurally validated but not required to equal an old timestamp/path-dependent metadata hash. The actual transport SHA-256 remains required, so changing latitude or geometry cannot pass by asserting V1 provenance.

## Executed verification

- **47/47 Web tests passed**, including transport/projection invariants, real V1 integration, periodic region centering, climate rejection, actual checksum failure and release allowlist negative cases.
- `npm run build` and `npm run build:release` passed TypeScript and production bundling. Local build supports a repository-style `/FF7Gaia/` base; the default relative base also builds.
- **16/16 existing browser checks passed**: all five views, smooth transitions, orbit/zoom, inspector source/cap identity, graticule, north-up and mobile tap/layout.
- **23/23 added browser checks passed**: region coloring/navigation, full legend, keyboard north/arrow, About/Escape, rejected imports retaining an existing map, reduced-motion, real WebGL loss/retry, code-only startup, mobile local import, climate/corrupt rejection, no geometry requests/uploads and 320px/390px layouts.
- **3/3 local production browser checks passed** under `/FF7Gaia/`: correct asset/data base, actual touch rotation and pinch zoom.
- Source-only clean-checkout test/build evidence is recorded in `output/web_release_v1/source-checkout-results.json` after validating the Git source archive.

QA used installed Chrome 154.0.8037.95 with Playwright on Windows, headless desktop and touch/mobile emulation. Screenshots were visually inspected for globe, projected maps, region navigation, inspector, source-only startup and About. These are not native Safari/iOS or Firefox tests. Measured headless FPS is environment-specific and not a device performance guarantee. No browser installation/download was performed.

Evidence: `output/web_release_v1/qa/browser-results.json`, `release-qa/browser-results.json`, `production-qa/production-results.json`, and their screenshots. During initial added QA, Playwright used its default system temporary directory; this was identified and corrected by explicitly setting TEMP/TMP/TMPDIR inside the workspace in all QA scripts, then rerunning the added checks. Persistent project outputs and profiles remain inside the workspace. No game-directory writes occurred.

## Preservation and FF7 source checks

The 443-file historical manifest includes V1 GIS/3D/reconstruction, prior validation, V2/V2.1/V2.2 output/code/docs, original Web data and historical screenshots. **442 files remain byte-identical; the sole intended change is docs/climate/README.md**, whose old content remains in baseline Git. No historical files are missing. Archived climate source/configuration/research/launchers remain unchanged.

FF7 input: `D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition\ff7\workingdir\data\wm`. Current read-only hashes are compared to the last completed V2.2 verification record saved at this task's start; that baseline is identified as historical, without inventing a new observation timestamp. Seven MAP/LGP/BOT files match size and SHA-256.

**FF7 source modified: NO**

| File | Bytes | Saved baseline SHA-256 = current SHA-256 |
|---|---:|---|
| wm0.map | 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C |
| wm2.map | 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 |
| wm3.map | 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 |
| world_us.lgp | 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C |

Full seven-file comparison and preserved-file result: `output/web_release_v1/safety-final.json`. The audit script only hashes/inspects files; it does not execute climate code or generate GIS assets.

## Public artifact and remaining decisions

The code-only production artifact contains index HTML, one JS bundle, one stylesheet, favicon and three license/notice files. It contains **zero game-derived geometry files**. Full runtime MIT/GPL notices are retained; GPL-3.0-only applies only to original GaiaGIS code. Local `dist/` with private data must not be published.

Manual Pages preparation is code-only; no repository, remote, public upload or deployment has been created. External GitHub CI/Pages execution remains unverified until the owner selects a repository and publishes code. Derived FF7 geometry distribution remains **unresolved** and is not authorized by this workflow.

Region centers are navigation approximations, not locations/field entrances. Broad sea regions can have low concentration. Real Safari/Firefox and physical mobile devices remain untested. Additional V1 dataset fingerprints need an explicit compatibility extension. POIs, encounters, scripts and underwater layers are future features, not active v1.0 blockers. No climate continuation is planned.
