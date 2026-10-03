# Web v1.0 release guide

The release is executable source code with a browser-local V1 file chooser. It does not distribute game-derived map data. Canonical means GaiaGIS's V1 project reconstruction, not official FF7 geography.

## Build modes

npm run build creates web/dist/ for local use and includes whatever private data exists in web/public/data/. Do not upload this directory.

npm run build:release explicitly disables Vite's public-directory copy, compiles source-only startup, and copies only favicon plus GPL, Three.js MIT and third-party notices. It audits a strict file/directory allowlist. npm run audit:release repeats the audit. web/dist-release/ has no data directory, dataset JSON, geometry, screenshots or source assets. Runtime licensing notices remain intact.

The release never fetches geometry automatically. Users choose the default local V1 gaia-meta.json and gaia-mesh.bin together; SHA-256 and format invariants are verified before displaying. Files are read through browser File APIs, without network uploads or persistence. Altered binary or climate provenance is rejected. Current fingerprints intentionally support only the existing default V1 export; support for other V1 source datasets needs a future explicit compatibility policy, without changing reconstruction.

For a Pages-like local preview, in PowerShell from web/:

```powershell
$env:GAIA_BASE_PATH='/FF7Gaia/'
npm run build:release
npm run preview:release
```

Open http://127.0.0.1:5175/FF7Gaia/. Unset the environment variable for the default relative base. Keep private asset generation outside the public workflow.

## GitHub preparation

The source baseline was committed locally before changes. Historical V1/V2/V2.1/V2.2 products remain local and hash-checked. .gitignore excludes game inputs, output/, generated browser datasets, screenshots, dependencies and both production directories. Stage only source/docs/configuration; never force-add generated assets.

web-checks.yml tests and builds push/PR source on a Windows runner; local-data integration tests skip when private data is absent. deploy-pages.yml is manual only and uploads audited dist-release/. It never builds GIS data or runs climate models. Its Linux cloud runner is the Pages action environment, not a new local Linux installation.

When the owner elects to publish: create/select the GitHub repository, push the reviewed code branch, enable Pages with GitHub Actions and manually run the Pages workflow. No push, repository creation, Pages setting change or deployment has been performed here. Any geometry or screenshot publication requires a separate decision; this workflow cannot carry those files.

Official action references: [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [upload-pages-artifact](https://github.com/actions/upload-pages-artifact), [deploy-pages](https://github.com/actions/deploy-pages).

## Scope after v1.0

Actual v1.0 local interaction is implemented and validated. Remaining release operations are owner/repository selection, external CI/Pages execution and deciding whether any game-derived data may ever be published. POIs/field entrances, scripts, encounters, underwater layers and alternative datasets remain future thematic features. Climate research is concluded and has no continuation task.
