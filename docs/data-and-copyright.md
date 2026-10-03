# Code, dependencies and data boundaries

## A. GaiaGIS original code

GaiaGIS original source code is licensed under **GNU General Public License v3.0 only**, SPDX **GPL-3.0-only**. The root LICENSE is the complete official GNU GPLv3 text downloaded from https://www.gnu.org/licenses/gpl-3.0.txt, unmodified. Project licensing is v3 **only**; the license document's example “or later” wording does not change the project's SPDX declaration.

The GPL license applies to GaiaGIS original source code. It does not grant rights to Final Fantasy VII or Square Enix assets. This is not a blanket statement that every local file or dataset is GPL.

## B. Third-party libraries and references

Third-party libraries retain their licenses, copyrights and notices. See THIRD_PARTY_NOTICES.md for exact installed versions and verbatim notices. Three.js is the browser runtime library; d3-geo/d3-geo-projection are independent projection test dependencies; Vite, TypeScript, Vitest and Playwright are build/test tooling. Their licenses are not changed to GPL.

ff7-landscaper and ff7-worldmap are reverse-engineering references and validation oracles only. Their reference caches are ignored; no reference code is vendored or relicensed in this Viewer. The parser, transport format, projections and UI are GaiaGIS implementations.

## C. FF7 proprietary input

Final Fantasy VII and related assets belong to their respective copyright holders.

GaiaGIS is an independent fan / technical GIS visualization project and is not affiliated with or endorsed by Square Enix.

MAP, BOT, LGP, TEX, executable/DLL and other proprietary source assets are **not distributed**. The local FF7 installation is read-only. Stage 2 reads existing Stage 1 products, not the game's binaries, except optional read-only fingerprint checks. No textures are extracted, copied or bundled.

## D. Derived geometry and Web assets

GeoPackage, GLB, transport binaries, metadata containing game geometry, rendered screenshots and any future dataset releases require a **separate distribution review**. Original code licensing does not automatically determine the rights or license of game-derived data. This stage makes no claim that those products are freely redistributable.

Local generation is permitted by this project's workflow. `output/`, `web/public/data/` generated files, `web/dist/`, screenshot PNGs and research caches are ignored by Git. The public data directory's README is source documentation and is retained.

**Web v1.0 preparation: no push, no public upload of derived data, no Pages activation or deployment.** Source/tooling and a manual code-only workflow are prepared locally.

## Later Pages deployment

The Pages workflow has no push/PR trigger. It builds only `web/dist-release/`, with public-directory copying disabled, a strict asset allowlist and no geometry requests at startup. Users open their own local V1 files in the browser; no upload is made. This replaces the historical workflow that required separately staged derived data. No derived-data distribution permission is inferred or bypassed: the artifact contains no such data.

The workflow uses GitHub Pages environment deployment and Vite's configurable base. It is a preparation artifact, not an executed public release. Source-only builds and browser-local loading are tested locally under a repository subpath; external GitHub execution remains unverified. Full geometry integration tests require locally generated assets. Both `web/dist/` and `web/dist-release/` are ignored; only the latter is eligible for code-only publication.
